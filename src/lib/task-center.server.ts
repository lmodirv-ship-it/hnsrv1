// Task Center: receives a service request from any HN group site, resolves the
// site responsible for the service, dispatches the task, stores the result and
// returns it (optionally forwarding it back to TVCC for delivery).

export type IncomingTask = {
  requester_site: string;
  requester_code?: string | null;
  service_intent: string;
  payload?: Record<string, unknown>;
  callback_url?: string | null;
  origin?: string;
};

function normalize(text: string) {
  return text.toLowerCase().trim();
}

/** Find the site + service that should execute this intent. */
export async function resolveProvider(intent: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const term = normalize(intent);

  const { data: services } = await supabaseAdmin
    .from("services")
    .select("id, site_id, name, category, method, endpoint_path, description, is_active")
    .eq("is_active", true);

  const candidates = services ?? [];
  const scored = candidates
    .map((s: any) => {
      const name = normalize(s.name ?? "");
      const cat = normalize(s.category ?? "");
      const desc = normalize(s.description ?? "");
      let score = 0;
      if (name === term) score = 100;
      else if (name.includes(term) || term.includes(name)) score = 80;
      else if (cat === term) score = 70;
      else if (cat.includes(term) || term.includes(cat)) score = 55;
      else if (desc.includes(term)) score = 40;
      return { service: s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best) return { ok: false as const, reason: "no_provider" };

  const { data: site } = await supabaseAdmin
    .from("sites")
    .select("id, name, slug, base_url")
    .eq("id", best.service.site_id)
    .maybeSingle();

  if (!site) return { ok: false as const, reason: "provider_site_missing" };
  return { ok: true as const, site, service: best.service, score: best.score };
}

async function dispatch(site: any, service: any, payload: Record<string, unknown>) {
  const path = service.endpoint_path || "/";
  const url = String(site.base_url).replace(/\/+$/, "") + (path.startsWith("/") ? path : `/${path}`);
  const method = (service.method || "POST").toUpperCase();
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 15000);
  const started = Date.now();
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "HN-Service-Hub/1.0",
      "X-HN-Task": "task-center",
    };
    const hnKey = process.env["HN_API_KEY"];
    if (hnKey) headers["X-HN-API-Key"] = hnKey;
    const res = await fetch(url, {
      method,
      headers,
      body: method === "GET" ? undefined : JSON.stringify(payload ?? {}),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* keep raw text */
    }
    return { ok: res.ok, status: res.status, body, url, latency_ms: Date.now() - started };
  } catch (e: any) {
    return { ok: false, status: 0, body: null, url, latency_ms: Date.now() - started, error: e?.message ?? String(e) };
  } finally {
    clearTimeout(to);
  }
}

async function deliverBack(callbackUrl: string | null | undefined, body: unknown) {
  const { tvccBaseUrl } = await import("./tvcc-sync.server");
  const target = callbackUrl || `${tvccBaseUrl()}/api/public/v1/task-result`;
  try {
    await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env["HN_API_KEY"] ? { "X-HN-API-Key": process.env["HN_API_KEY"]! } : {}),
      },
      body: JSON.stringify(body),
    });
    return target;
  } catch {
    return null;
  }
}

/** Full lifecycle: record → route → dispatch → store result → return to requester. */
export async function handleTask(input: IncomingTask) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: task, error } = await supabaseAdmin
    .from("task_center_tasks")
    .insert({
      requester_site: input.requester_site,
      requester_code: input.requester_code ?? null,
      service_intent: input.service_intent,
      payload: input.payload ?? {},
      callback_url: input.callback_url ?? null,
      origin: input.origin ?? "direct",
      status: "received",
    })
    .select("id")
    .single();
  if (error || !task) throw new Error(error?.message ?? "Could not create task");

  const routed = await resolveProvider(input.service_intent);
  if (!routed.ok) {
    await supabaseAdmin
      .from("task_center_tasks")
      .update({ status: "failed", error: routed.reason, routing: { reason: routed.reason } })
      .eq("id", task.id);
    return { ok: false, task_id: task.id, status: "failed", error: routed.reason };
  }

  await supabaseAdmin
    .from("task_center_tasks")
    .update({
      status: "routed",
      provider_site_id: routed.site.id,
      provider_site: routed.site.slug,
      provider_service_id: routed.service.id,
      routing: { score: routed.score, service: routed.service.name, site: routed.site.slug },
    })
    .eq("id", task.id);

  const run = await dispatch(routed.site, routed.service, input.payload ?? {});

  const status = run.ok ? "completed" : "failed";
  await supabaseAdmin
    .from("task_center_tasks")
    .update({
      status,
      result: run.ok ? ({ status: run.status, body: run.body, url: run.url } as any) : null,
      error: run.ok ? null : ((run as any).error ?? `HTTP ${run.status}`),
      latency_ms: run.latency_ms,
    })
    .eq("id", task.id);

  const response = {
    ok: run.ok,
    task_id: task.id,
    status,
    provider: { site: routed.site.slug, base_url: routed.site.base_url, service: routed.service.name },
    result: run.ok ? run.body : null,
    error: run.ok ? null : ((run as any).error ?? `HTTP ${run.status}`),
    latency_ms: run.latency_ms,
  };

  const delivered = await deliverBack(input.callback_url, {
    requester_site: input.requester_site,
    ...response,
  });
  if (delivered) {
    await supabaseAdmin.from("task_center_tasks").update({ status: "returned" }).eq("id", task.id);
  }

  return response;
}
