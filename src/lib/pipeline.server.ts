// HN Service Hub — Multi-Service Orchestrator (Pipeline Engine).
// SERVER-ONLY. Decomposes a high-level intent into subtasks, assigns each
// subtask to the best-matching service across the HN mesh, executes them,
// then aggregates all outputs into a final package returned to the caller.

type Kind =
  | "text"
  | "image"
  | "video"
  | "script"
  | "voice"
  | "storage"
  | "database"
  | "code"
  | "generic";

type SubtaskPlan = {
  order: number;
  kind: Kind;
  intent: string;
  input: Record<string, unknown>;
};

const KIND_KEYWORDS: Record<Kind, string[]> = {
  text:     ["text", "content", "copy", "article", "medical", "نص", "نصوص", "مقال", "طبي", "طبية", "محتوى"],
  image:    ["image", "photo", "picture", "gallery", "banner", "صورة", "صور", "معرض"],
  video:    ["video", "clip", "reel", "فيديو", "فيديوهات", "مقطع"],
  script:   ["script", "code", "js", "ts", "html", "css", "سكربت", "سكريبت", "كود", "برمجة"],
  voice:    ["voice", "audio", "speech", "narration", "voiceover", "صوت", "تعليق"],
  storage:  ["storage", "upload", "file", "asset", "bucket", "cdn", "cloud", "تخزين", "ملفات"],
  database: ["database", "db", "record", "table", "sql", "قاعدة", "بيانات"],
  code:     ["build", "site", "website", "template", "بناء", "موقع", "قالب"],
  generic:  [],
};

function detectKinds(intent: string): Kind[] {
  const t = intent.toLowerCase();
  const kinds: Kind[] = [];
  for (const [k, kws] of Object.entries(KIND_KEYWORDS) as [Kind, string[]][]) {
    if (k === "generic") continue;
    if (kws.some((kw) => t.includes(kw))) kinds.push(k);
  }
  // Common composite intents
  const isSite = /(موقع|website|site|landing|طبيب|doctor|clinic|عيادة)/i.test(intent);
  if (isSite) {
    for (const k of ["text", "image", "video", "script", "voice", "storage", "database"] as Kind[]) {
      if (!kinds.includes(k)) kinds.push(k);
    }
  }
  return kinds.length ? kinds : ["generic"];
}

function subtaskIntentFor(kind: Kind, base: string): string {
  const map: Record<Kind, string> = {
    text: `generate medical text content for: ${base}`,
    image: `generate images for: ${base}`,
    video: `generate video clips for: ${base}`,
    script: `generate scripts and code for: ${base}`,
    voice: `generate voice narration for: ${base}`,
    storage: `store website files for: ${base}`,
    database: `persist site metadata for: ${base}`,
    code: `assemble website files for: ${base}`,
    generic: base,
  };
  return map[kind];
}

export function planSubtasks(intent: string, prompt?: string): SubtaskPlan[] {
  const base = (prompt ?? intent).trim().slice(0, 500);
  const kinds = detectKinds(intent + " " + (prompt ?? ""));
  return kinds.map((kind, i) => ({
    order: i + 1,
    kind,
    intent: subtaskIntentFor(kind, base),
    input: { prompt: base, kind },
  }));
}

// Rank services by an intent string; reused by pipeline planner.
async function pickServiceForKind(kind: Kind, intent: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: services } = await supabaseAdmin
    .from("services")
    .select("*, sites(base_url, metadata, category, name, slug)")
    .eq("is_active", true)
    .eq("approval_status", "approved");
  const kws = KIND_KEYWORDS[kind];
  const terms = intent.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const scored = (services ?? []).map((s: any) => {
    const hay = [
      s.name, s.description, s.category, s.slug,
      s.sites?.name, s.sites?.slug, s.sites?.category,
      ...(s.tags ?? []),
    ].filter(Boolean).join(" ").toLowerCase();
    let score = 0;
    for (const kw of kws) if (hay.includes(kw)) score += 3;
    for (const t of terms) if (hay.includes(t)) score += 1;
    return { service: s, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.service ?? null;
}

async function callUpstream(service: any, input: unknown, requestId: string) {
  const meta = service.sites?.metadata ?? {};
  const baseSite = String(service.sites?.base_url ?? "").replace(/\/+$/, "");
  const url = service.endpoint_url || (baseSite + (service.endpoint_path ?? "/"));
  const method = (service.method ?? "POST").toUpperCase();
  const headers = new Headers({
    "content-type": "application/json",
    "user-agent": "HN-Hub-Pipeline/1.0",
    "x-hn-request-id": requestId,
    "x-forwarded-by": "hn-service-hub",
  });
  const envNames: string[] = [meta.keyEnv, meta.keyFallbackEnv].filter(Boolean);
  for (const name of envNames) {
    const val = process.env[name];
    if (val) { headers.set("authorization", `Bearer ${val}`); headers.set("x-api-key", val); break; }
  }
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 20_000);
  const t0 = Date.now();
  try {
    const init: RequestInit = { method, headers, signal: ctrl.signal };
    if (method !== "GET" && method !== "HEAD") init.body = JSON.stringify(input);
    const r = await fetch(url, init);
    const ct = r.headers.get("content-type") ?? "";
    let data: unknown = null;
    if (ct.includes("application/json")) { try { data = await r.json(); } catch { data = null; } }
    else data = (await r.text()).slice(0, 100_000);
    return { status: r.status, data, latency: Date.now() - t0, error: r.ok ? null : `Upstream ${r.status}` };
  } catch (e: any) {
    const abort = e?.name === "AbortError";
    return { status: abort ? 504 : 502, data: null, latency: Date.now() - t0, error: abort ? "timeout" : "fetch failed" };
  } finally { clearTimeout(to); }
}

export type RunPipelineArgs = {
  intent: string;
  prompt?: string;
  requester_site?: string | null;
  gateway_site?: string | null;
  owner_id?: string | null;
  api_key_id?: string | null;
  client_id?: string | null;
  internal_connector_id?: string | null;
  auth_mode?: "internal" | "external" | null;
  input_payload?: Record<string, unknown>;
};

export async function runPipeline(args: RunPipelineArgs) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const plan = planSubtasks(args.intent, args.prompt);
  const requestId = crypto.randomUUID();
  const startedAt = new Date();
  const gatewaySite = args.gateway_site ?? null;
  const requesterSite = args.requester_site ?? null;

  // Create pipeline row
  const { data: pipeline, error: pErr } = await supabaseAdmin
    .from("pipelines")
    .insert({
      owner_id: args.owner_id ?? null,
      api_key_id: args.api_key_id ?? null,
      client_id: args.client_id ?? null,
      requester_site: requesterSite,
      gateway_site: gatewaySite,
      intent: args.intent,
      prompt: args.prompt ?? null,
      input_payload: (args.input_payload ?? null) as any,
      status: "running",
      subtasks_total: plan.length,
      started_at: startedAt.toISOString(),
      journey_path: [
        { step: "received_from", site: requesterSite, via: gatewaySite ?? "tvcc" },
        { step: "hub_planned_subtasks", count: plan.length },
      ] as any,
    })
    .select("*")
    .single();
  if (pErr || !pipeline) throw new Error(pErr?.message ?? "pipeline create failed");

  // Create subtask rows (pending)
  const subtaskRows = plan.map((p) => ({
    pipeline_id: pipeline.id,
    task_order: p.order,
    kind: p.kind,
    intent: p.intent,
    input_payload: p.input as any,
    status: "pending",
  }));
  const { data: createdSubs } = await supabaseAdmin
    .from("pipeline_subtasks")
    .insert(subtaskRows)
    .select("*");

  const finalPackage: Record<string, unknown> = {};
  let done = 0;
  let anyFailed = false;

  for (const sub of createdSubs ?? []) {
    const kind = sub.kind as Kind;
    const svc = await pickServiceForKind(kind, sub.intent ?? args.intent);
    const subStarted = new Date();
    if (!svc) {
      await supabaseAdmin.from("pipeline_subtasks").update({
        status: "no_service",
        error: `No service found for kind '${kind}'`,
        started_at: subStarted.toISOString(),
        finished_at: new Date().toISOString(),
      }).eq("id", sub.id);
      anyFailed = true;
      finalPackage[kind] = { ok: false, error: `No provider for ${kind}` };
      continue;
    }

    await supabaseAdmin.from("pipeline_subtasks").update({
      status: "running",
      assigned_service_id: svc.id,
      assigned_provider_site: svc.sites?.slug ?? null,
      started_at: subStarted.toISOString(),
    }).eq("id", sub.id);

    const res = await callUpstream(svc, sub.input_payload ?? {}, requestId);
    const ok = res.status >= 200 && res.status < 400;
    if (!ok) anyFailed = true;
    done += ok ? 1 : 0;

    await supabaseAdmin.from("pipeline_subtasks").update({
      status: ok ? "success" : "failed",
      status_code: res.status,
      output_payload: (ok ? res.data : null) as any,
      error: ok ? null : res.error,
      latency_ms: res.latency,
      attempts: 1,
      finished_at: new Date().toISOString(),
    }).eq("id", sub.id);

    finalPackage[kind] = {
      ok,
      service: { id: svc.id, name: svc.name, site: svc.sites?.slug },
      status: res.status,
      data: ok ? res.data : null,
      error: ok ? null : res.error,
    };

    await supabaseAdmin.from("pipelines")
      .update({ subtasks_done: done })
      .eq("id", pipeline.id);
  }

  const finishedAt = new Date();
  const latencyMs = finishedAt.getTime() - startedAt.getTime();
  const status = anyFailed ? (done > 0 ? "partial" : "failed") : "success";
  const journeyPath = [
    { step: "received_from", site: requesterSite, via: gatewaySite ?? "tvcc" },
    { step: "hub_planned_subtasks", count: plan.length },
    { step: "hub_dispatched", providers: Object.keys(finalPackage) },
    { step: "hub_aggregated", status },
    { step: "returned_via_gateway", via: gatewaySite ?? "tvcc" },
    { step: "delivered_to", site: requesterSite },
  ];
  await supabaseAdmin.from("pipelines").update({
    status,
    subtasks_done: done,
    final_package: finalPackage as any,
    latency_ms: latencyMs,
    finished_at: finishedAt.toISOString(),
    journey_path: journeyPath as any,
  }).eq("id", pipeline.id);

  return {
    ok: !anyFailed,
    pipeline_id: pipeline.id,
    request_id: requestId,
    status,
    subtasks_total: plan.length,
    subtasks_done: done,
    latency_ms: latencyMs,
    final_package: finalPackage,
    return_via: gatewaySite ?? "tvcc",
    deliver_to: requesterSite,
    journey_path: journeyPath,
  };
}
