import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---------- Pipelines (Multi-Service Orchestrator) ----------

export const listPipelines = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; limit?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("pipelines")
      .select("id, created_at, requester_site, intent, prompt, status, subtasks_total, subtasks_done, latency_ms")
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? 100, 500));
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const { data: stats } = await context.supabase
      .from("pipelines")
      .select("status")
      .gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString());
    const counts: Record<string, number> = {};
    for (const r of stats ?? []) counts[r.status ?? "unknown"] = (counts[r.status ?? "unknown"] ?? 0) + 1;
    return { rows: rows ?? [], counts };
  });

export const getPipeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: pipeline, error } = await context.supabase
      .from("pipelines")
      .select("*, api_clients(name)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const { data: subtasks } = await context.supabase
      .from("pipeline_subtasks")
      .select("*, services(name, slug, category)")
      .eq("pipeline_id", data.id)
      .order("task_order", { ascending: true });
    return { pipeline, subtasks: subtasks ?? [] };
  });

export const listRecentSubtasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("pipeline_subtasks")
      .select("id, pipeline_id, task_order, kind, intent, status, status_code, latency_ms, assigned_provider_site, created_at, services(name)")
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? 200, 500));
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listProviderUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("pipeline_subtasks")
      .select("assigned_provider_site, status, kind, latency_ms")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 3600_000).toISOString());
    if (error) throw new Error(error.message);
    const agg = new Map<string, { site: string; total: number; success: number; failed: number; avg_ms: number; kinds: Record<string, number>; _sum: number }>();
    for (const r of rows ?? []) {
      const site = r.assigned_provider_site ?? "—";
      const cur = agg.get(site) ?? { site, total: 0, success: 0, failed: 0, avg_ms: 0, kinds: {}, _sum: 0 };
      cur.total += 1;
      cur._sum += r.latency_ms ?? 0;
      if (r.status === "success") cur.success += 1;
      else if (r.status === "failed" || r.status === "no_service") cur.failed += 1;
      cur.kinds[r.kind] = (cur.kinds[r.kind] ?? 0) + 1;
      agg.set(site, cur);
    }
    return Array.from(agg.values()).map((x) => ({
      site: x.site, total: x.total, success: x.success, failed: x.failed,
      avg_ms: x.total ? Math.round(x._sum / x.total) : 0, kinds: x.kinds,
    })).sort((a, b) => b.total - a.total);
  });

export const runPipelineNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    intent: z.string().min(3).max(500),
    prompt: z.string().max(2000).optional(),
    requester_site: z.string().max(200).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { runPipeline } = await import("@/lib/pipeline.server");
    return runPipeline({
      intent: data.intent,
      prompt: data.prompt,
      requester_site: data.requester_site ?? "hn-hub-console",
      owner_id: context.userId,
    });
  });

// ---------- Requests engine / routing decisions (existing) ----------

export const listEngineRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; limit?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("service_requests")
      .select("id, created_at, requester_site, provider_site, service_intent, execution_status, status_code, latency_ms, attempts, fallback_used, error, services(name, slug), api_clients(name)")
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? 100, 500));
    if (data.status) q = q.eq("execution_status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const { data: stats } = await context.supabase
      .from("service_requests")
      .select("execution_status")
      .gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString());
    const counts: Record<string, number> = {};
    for (const r of stats ?? []) counts[r.execution_status ?? "unknown"] = (counts[r.execution_status ?? "unknown"] ?? 0) + 1;

    return { rows: rows ?? [], counts };
  });

export const getRoutingDecisions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("service_requests")
      .select("id, created_at, requester_site, provider_site, service_intent, execution_status, fallback_used, attempts, routing_decision, services(name)")
      .not("routing_decision", "is", null)
      .order("created_at", { ascending: false })
      .limit(80);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Fallback rules CRUD
const ruleInput = z.object({
  id: z.string().uuid().optional(),
  intent_pattern: z.string().trim().min(1).max(300),
  primary_service_id: z.string().uuid().nullable().optional(),
  fallback_service_id: z.string().uuid(),
  priority: z.number().int().min(0).max(1000).default(100),
  enabled: z.boolean().default(true),
  notes: z.string().max(500).nullable().optional(),
});

export const listFallbackRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("fallback_rules")
      .select("*, primary:primary_service_id(name, slug), fallback:fallback_service_id(name, slug)")
      .order("priority", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertFallbackRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ruleInput.parse(d))
  .handler(async ({ data, context }) => {
    const row: any = { ...data, owner_id: context.userId };
    if (row.id) {
      const { error } = await context.supabase.from("fallback_rules").update(row).eq("id", row.id);
      if (error) throw new Error(error.message);
    } else {
      delete row.id;
      const { error } = await context.supabase.from("fallback_rules").insert(row);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteFallbackRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("fallback_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listServicesLite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("services")
      .select("id, name, slug, category, sites(slug, name)")
      .eq("is_active", true)
      .eq("approval_status", "approved")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });
