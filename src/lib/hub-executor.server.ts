// HN Hub core executor. SERVER-ONLY.
// Given an authenticated API key and a routing request, it:
//   1. Resolves the target service (by service_id or intent)
//   2. Enforces client scoping (allowed_services)
//   3. Builds the upstream URL from routing_mode / endpoint_url / site.base_url
//   4. Forwards the request with HN identity (never the caller's identity)
//   5. Logs the attempt in service_requests
//   6. Returns a sanitised response for the caller
//
// The caller never learns the upstream URL, HN credentials, or raw upstream
// error bodies. This module is the "hidden brain" of the mesh.

import bcrypt from "bcryptjs";

export type ExecRequest = {
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

// Verify Authorization: Bearer hn_xxx.secret against api_keys.
export async function authenticateKey(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token || !token.includes(".")) return { error: "Missing API key" as const };
  const [prefix, secret] = token.split(".");
  if (!prefix || !secret) return { error: "Malformed API key" as const };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: keys, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, client_id, key_hash, revoked_at, expires_at, api_clients(rate_limit_per_min, allowed_services)")
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

// Simple per-minute rolling counter.
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

async function resolveService(req: ExecRequest) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (req.service_id) {
    const { data } = await supabaseAdmin
      .from("services")
      .select("*, sites(base_url, metadata, category)")
      .eq("id", req.service_id)
      .eq("is_active", true)
      .eq("approval_status", "approved")
      .maybeSingle();
    return data;
  }

  if (req.intent) {
    const terms = String(req.intent).toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const { data: services } = await supabaseAdmin
      .from("services")
      .select("*, sites(base_url, metadata, category)")
      .eq("is_active", true)
      .eq("approval_status", "approved");
    const scored = (services ?? []).map((s: any) => {
      const hay = [s.name, s.description, s.category, ...(s.tags ?? [])].filter(Boolean).join(" ").toLowerCase();
      let score = 0;
      for (const t of terms) if (hay.includes(t)) score += 1;
      return { s, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.score > 0 ? scored[0].s : null;
  }
  return null;
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
  // Fallback: universal HN key if the site declares HN_API_KEY use.
  const universal = process.env.HN_API_KEY;
  if (universal) {
    headers.set("authorization", `Bearer ${universal}`);
    headers.set("x-api-key", universal);
  }
}

// Core: run the request against the upstream service and log it.
export async function executeAgainstService(
  key: AuthedKey,
  req: ExecRequest,
): Promise<Response> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const start = Date.now();

  const service = await resolveService(req);
  if (!service) {
    await supabaseAdmin.from("service_requests").insert({
      api_key_id: key.id, client_id: key.client_id, service_id: null,
      status_code: 404, latency_ms: Date.now() - start, error: "No matching service",
    });
    return jsonResponse(404, { ok: false, error: "No matching service" });
  }

  const allowed = key.client?.allowed_services ?? null;
  if (Array.isArray(allowed) && allowed.length > 0 && !allowed.includes(service.id)) {
    await supabaseAdmin.from("service_requests").insert({
      api_key_id: key.id, client_id: key.client_id, service_id: service.id,
      status_code: 403, latency_ms: Date.now() - start, error: "Service not allowed",
    });
    return jsonResponse(403, { ok: false, error: "Service not allowed for this client" });
  }

  const method = (req.method ?? service.method ?? "POST").toUpperCase();
  const url = buildUpstreamUrl(service, req);

  const requestId = crypto.randomUUID();
  const upstreamHeaders = new Headers();
  upstreamHeaders.set("content-type", "application/json");
  upstreamHeaders.set("user-agent", "HN-Hub/1.0");
  upstreamHeaders.set("x-hn-request-id", requestId);
  upstreamHeaders.set("x-forwarded-by", "hn-service-hub");
  injectHnCredentials(service, upstreamHeaders);

  const timeout = Math.min(Math.max(req.timeout_ms ?? 15_000, 1000), 30_000);
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeout);

  let status = 502;
  let responseData: unknown = null;
  let errorMsg: string | null = null;

  try {
    const upstreamInit: RequestInit = { method, headers: upstreamHeaders, signal: ctrl.signal };
    if (method !== "GET" && method !== "HEAD" && req.payload !== undefined) {
      upstreamInit.body = JSON.stringify(req.payload);
    }
    const upstream = await fetch(url, upstreamInit);
    status = upstream.status;
    const ct = upstream.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      try { responseData = await upstream.json(); } catch { responseData = null; }
    } else {
      const text = await upstream.text();
      responseData = text.slice(0, 200_000);
    }
    if (!upstream.ok) errorMsg = `Upstream ${status}`;
  } catch (e: any) {
    status = e?.name === "AbortError" ? 504 : 502;
    errorMsg = e?.name === "AbortError" ? "Upstream timeout" : "Upstream fetch failed";
  } finally {
    clearTimeout(to);
  }

  const latency = Date.now() - start;
  await supabaseAdmin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);
  await supabaseAdmin.from("service_requests").insert({
    api_key_id: key.id,
    client_id: key.client_id,
    service_id: service.id,
    method,
    status_code: status,
    latency_ms: latency,
    error: errorMsg,
  });

  if (errorMsg && (status >= 500 || status === 0)) {
    return jsonResponse(status || 502, {
      ok: false,
      request_id: requestId,
      status,
      error: errorMsg,
      service: { id: service.id, name: service.name },
      latency_ms: latency,
    });
  }

  return jsonResponse(200, {
    ok: status >= 200 && status < 400,
    request_id: requestId,
    service: { id: service.id, name: service.name, category: service.category },
    status,
    latency_ms: latency,
    data: responseData,
  });
}
