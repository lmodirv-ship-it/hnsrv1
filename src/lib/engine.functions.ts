import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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
