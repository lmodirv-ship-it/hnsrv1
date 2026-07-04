// HN Hub core executor. SERVER-ONLY.
// The hidden engine that receives requests from any HN site, resolves the
// best-matching service, executes it (with fallback), and returns the result
// — without exposing upstream URLs or HN credentials to the caller.

import bcrypt from "bcryptjs";

export type ExecRequest = {
  requester_site?: string;
  intent?: string;
  service_id?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path?: string;
  query?: Record<string, string | number | boolean>;
  payload?: unknown;
  timeout_ms?: number;
};

export type AuthedKey = {
  id: string;
  client_id: string;
  client?: {
    name?: string | null;
    rate_limit_per_min: number | null;
    allowed_services: string[] | null;
  } | null;
};

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
  } as const;
}

export function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

export async function authenticateKey(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token || !token.includes(".")) return { error: "Missing API key" as const };
  const [prefix, secret] = token.split(".");
  if (!prefix || !secret) return { error: "Malformed API key" as const };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: keys, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, client_id, key_hash, revoked_at, expires_at, api_clients(name, rate_limit_per_min, allowed_services)")
    .eq("key_prefix", prefix)
    .limit(5);
  if (error) return { error: error.message };

  for (const k of keys ?? []) {
    if (k.revoked_at) continue;
    if (k.expires_at && new Date(k.expires_at) < new Date()) continue;
    if (await bcrypt.compare(secret, (k as any).key_hash)) {
      return {
        key: {
          id: k.id,
          client_id: k.client_id,
          client: (k as any).api_clients ?? null,
        } as AuthedKey,
      };
    }
  }
  return { error: "Invalid API key" as const };
}

export async function checkRateLimit(key: AuthedKey) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabaseAdmin
    .from("service_requests")
    .select("id", { count: "exact", head: true })
    .eq("api_key_id", key.id)
    .gte("created_at", oneMinAgo);
  const limit = key.client?.rate_limit_per_min ?? 60;
  return (count ?? 0) < limit ? { ok: true as const, limit } : { ok: false as const, limit };
}

// Score-and-rank services matching an intent. Returns up to `top` candidates.
async function rankServicesByIntent(intent: string, top = 5) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const terms = intent.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const { data: services } = await supabaseAdmin
    .from("services")
    .select("*, sites(base_url, metadata, category, name, slug)")
    .eq("is_active", true)
    .eq("approval_status", "approved");
  const scored = (services ?? []).map((s: any) => {
    const hay = [s.name, s.description, s.category, s.slug, ...(s.tags ?? [])]
      .filter(Boolean).join(" ").toLowerCase();
    let score = 0;
    for (const t of terms) if (hay.includes(t)) score += 1;
    return { service: s, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, top);
}

// Fetch fallback services for a primary service or matching an intent pattern.
async function fetchFallbacks(primaryId: string, intent: string | undefined) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("fallback_rules")
    .select("fallback_service_id, priority, intent_pattern, primary_service_id, enabled, services:fallback_service_id(*, sites(base_url, metadata, category, name, slug))")
    .eq("enabled", true);
  const rules = (data ?? []).filter((r: any) => {
    if (r.primary_service_id && r.primary_service_id === primaryId) return true;
    if (intent && r.intent_pattern) {
      try { return new RegExp(r.intent_pattern, "i").test(intent); } catch { return false; }
    }
    return false;
  });
  rules.sort((a: any, b: any) => a.priority - b.priority);
  return rules.map((r: any) => r.services).filter(Boolean);
}

function buildUpstreamUrl(service: any, req: ExecRequest): string {
  const baseSite = String(service.sites?.base_url ?? "").replace(/\/+$/, "");
  const tvccBase = process.env.TVCC_API_URL?.replace(/\/+$/, "");
  let url = service.endpoint_url || (baseSite + (service.endpoint_path ?? "/"));
  if (service.routing_mode === "via_tvcc" && tvccBase) {
    url = `${tvccBase}/proxy/${service.slug ?? service.id}`;
  } else if (service.routing_mode === "auto" && service.gateway_url) {
    url = service.gateway_url;
  }
  if (req.path) {
    url = url.replace(/\/+$/, "") + (req.path.startsWith("/") ? req.path : "/" + req.path);
  }
  if (req.query && Object.keys(req.query).length) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) qs.set(k, String(v));
    url += (url.includes("?") ? "&" : "?") + qs.toString();
  }
  return url;
}

function injectHnCredentials(service: any, headers: Headers) {
  const meta = service.sites?.metadata ?? {};
  const envNames: string[] = [meta.keyEnv, meta.keyFallbackEnv].filter(Boolean);
  for (const name of envNames) {
    const val = process.env[name];
    if (val) {
      headers.set("authorization", `Bearer ${val}`);
      headers.set("x-api-key", val);
      return;
    }
  }
  const universal = process.env.HN_API_KEY;
  if (universal) {
    headers.set("authorization", `Bearer ${universal}`);
    headers.set("x-api-key", universal);
  }
}

// Single upstream call. Returns { status, data, error }.
async function callService(service: any, req: ExecRequest, requestId: string) {
  const method = (req.method ?? service.method ?? "POST").toUpperCase();
  const url = buildUpstreamUrl(service, req);
  const headers = new Headers();
  headers.set("content-type", "application/json");
  headers.set("user-agent", "HN-Hub/1.0");
  headers.set("x-hn-request-id", requestId);
  headers.set("x-forwarded-by", "hn-service-hub");
  if (req.requester_site) headers.set("x-hn-requester", req.requester_site);
  injectHnCredentials(service, headers);

  const timeout = Math.min(Math.max(req.timeout_ms ?? 15_000, 1000), 30_000);
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeout);
  const t0 = Date.now();
  try {
    const init: RequestInit = { method, headers, signal: ctrl.signal };
    if (method !== "GET" && method !== "HEAD" && req.payload !== undefined) {
      init.body = JSON.stringify(req.payload);
    }
    const upstream = await fetch(url, init);
    const status = upstream.status;
    const ct = upstream.headers.get("content-type") ?? "";
    let data: unknown = null;
    if (ct.includes("application/json")) {
      try { data = await upstream.json(); } catch { data = null; }
    } else {
      const text = await upstream.text();
      data = text.slice(0, 200_000);
    }
    return { status, data, latency: Date.now() - t0, error: upstream.ok ? null : `Upstream ${status}` };
  } catch (e: any) {
    const abort = e?.name === "AbortError";
    return { status: abort ? 504 : 502, data: null, latency: Date.now() - t0, error: abort ? "Upstream timeout" : "Upstream fetch failed" };
  } finally {
    clearTimeout(to);
  }
}

// Core: pick service(s), execute with fallback, log everything.
export async function executeAgainstService(key: AuthedKey, req: ExecRequest): Promise<Response> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  // 1) Resolve candidates
  let candidates: any[] = [];
  let matchScores: Array<{ id: string; score: number; name: string }> = [];
  if (req.service_id) {
    const { data } = await supabaseAdmin
      .from("services")
      .select("*, sites(base_url, metadata, category, name, slug)")
      .eq("id", req.service_id)
      .eq("is_active", true)
      .eq("approval_status", "approved")
      .maybeSingle();
    if (data) candidates.push(data);
  } else if (req.intent) {
    const ranked = await rankServicesByIntent(req.intent, 5);
    matchScores = ranked.map((r) => ({ id: r.service.id, score: r.score, name: r.service.name }));
    candidates = ranked.map((r) => r.service);
  }

  if (!candidates.length) {
    await supabaseAdmin.from("service_requests").insert({
      api_key_id: key.id,
      client_id: key.client_id,
      requester_site: req.requester_site ?? key.client?.name ?? null,
      service_intent: req.intent ?? null,
      request_payload: (req.payload ?? null) as any,
      execution_status: "no_service",
      status_code: 404,
      latency_ms: Date.now() - startedAt,
      error: "No matching service",
      routing_decision: { candidates: matchScores, reason: "no_match" },
    });
    return jsonResponse(404, {
      ok: false, request_id: requestId,
      error: "No matching service. Consider registering one that handles: " + (req.intent ?? "this intent"),
      suggestion: "create_service",
    });
  }

  // 2) Enforce scope (allowed_services) on the *first* candidate; skip disallowed.
  const allowed = key.client?.allowed_services ?? null;
  if (Array.isArray(allowed) && allowed.length > 0) {
    candidates = candidates.filter((s) => allowed.includes(s.id));
    if (!candidates.length) {
      await supabaseAdmin.from("service_requests").insert({
        api_key_id: key.id, client_id: key.client_id,
        requester_site: req.requester_site ?? null,
        service_intent: req.intent ?? null,
        execution_status: "forbidden",
        status_code: 403, latency_ms: Date.now() - startedAt,
        error: "No allowed service matches",
      });
      return jsonResponse(403, { ok: false, error: "No service in your allowed scope matches" });
    }
  }

  // 3) Add configured fallbacks after the primary
  const primary = candidates[0];
  const fallbacks = await fetchFallbacks(primary.id, req.intent);
  const chain: any[] = [...candidates];
  for (const f of fallbacks) if (!chain.find((c) => c.id === f.id)) chain.push(f);

  // 4) Execute chain until success (2xx/3xx) or exhaustion
  let attempt = 0;
  let lastResult: Awaited<ReturnType<typeof callService>> | null = null;
  let chosen: any = null;
  const attemptsLog: Array<{ service_id: string; name: string; status: number; error: string | null }> = [];

  for (const svc of chain) {
    attempt++;
    chosen = svc;
    const r = await callService(svc, req, requestId);
    lastResult = r;
    attemptsLog.push({ service_id: svc.id, name: svc.name, status: r.status, error: r.error });
    if (r.status >= 200 && r.status < 400) break;
  }

  if (!lastResult) lastResult = { status: 500, data: null, latency: 0, error: "No attempt made" };

  const ok = lastResult.status >= 200 && lastResult.status < 400;
  const executionStatus = ok
    ? (attempt > 1 ? "fallback" : "success")
    : "failed";

  const routingDecision = {
    intent: req.intent ?? null,
    requester_site: req.requester_site ?? null,
    candidates: matchScores,
    chain: chain.map((c) => ({ id: c.id, name: c.name, site: c.sites?.slug })),
    attempts: attemptsLog,
    chose: chosen ? { id: chosen.id, name: chosen.name, site: chosen.sites?.slug, category: chosen.category } : null,
    reason: req.service_id
      ? "explicit_service_id"
      : (attempt > 1 ? "primary_failed_used_fallback" : "best_intent_match"),
  };

  await supabaseAdmin.from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id);
  await supabaseAdmin.from("service_requests").insert({
    api_key_id: key.id,
    client_id: key.client_id,
    service_id: chosen?.id ?? null,
    method: (req.method ?? chosen?.method ?? "POST").toUpperCase(),
    status_code: lastResult.status,
    latency_ms: Date.now() - startedAt,
    error: lastResult.error,
    requester_site: req.requester_site ?? key.client?.name ?? null,
    provider_site: chosen?.sites?.slug ?? null,
    service_intent: req.intent ?? null,
    request_payload: req.payload ?? null,
    response_payload: ok ? lastResult.data : null,
    execution_status: executionStatus,
    fallback_used: attempt > 1,
    attempts: attempt,
    routing_decision: routingDecision,
  });

  return jsonResponse(200, {
    ok,
    request_id: requestId,
    execution_status: executionStatus,
    fallback_used: attempt > 1,
    attempts: attempt,
    service: chosen ? { id: chosen.id, name: chosen.name, category: chosen.category } : null,
    status: lastResult.status,
    latency_ms: Date.now() - startedAt,
    data: ok ? lastResult.data : null,
    error: ok ? null : (lastResult.error ?? "Upstream failed"),
  });
}
