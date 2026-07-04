import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ServiceCandidate = {
  service_id: string;
  service_name: string;
  site_id: string | null;
  capability: string;
  task_type: string;
  priority: number;
  confidence: number;
  score: number;
  health: string | null;
  is_active: boolean;
  approval_status: string | null;
  reason: string;
};

/**
 * Decision Engine — picks the best service for a task_type.
 * Reads: task_router_rules → service_capabilities → services (health/status)
 * Returns: best candidate + alternatives + human-readable reason.
 */
export const pickBestService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { taskType: string; category?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { taskType, category } = data;

    // 1) Routing rules
    const { data: rules } = await supabase
      .from("task_router_rules")
      .select("*")
      .eq("task_type", taskType)
      .eq("is_active", true)
      .order("priority", { ascending: true });

    // 2) Capabilities matching task_type
    let capsQuery = supabase
      .from("service_capabilities")
      .select("*")
      .eq("task_type", taskType)
      .eq("is_active", true);
    if (category) capsQuery = capsQuery.eq("category", category);
    const { data: caps, error: capsErr } = await capsQuery;
    if (capsErr) throw capsErr;

    const serviceIds = Array.from(new Set((caps ?? []).map((c) => c.service_id)));
    if (serviceIds.length === 0) {
      return {
        best: null,
        alternatives: [] as ServiceCandidate[],
        rules: rules ?? [],
        reason: `No service capability registered for task_type='${taskType}'.`,
      };
    }

    // 3) Services + health
    const { data: services, error: svcErr } = await supabase
      .from("services")
      .select("id, name, site_id, is_active, approval_status, last_health_status, confidence_score")
      .in("id", serviceIds);
    if (svcErr) throw svcErr;

    const svcMap = new Map((services ?? []).map((s) => [s.id, s]));

    // 4) Score & rank
    const preferredId = rules?.[0]?.preferred_service_id ?? null;
    const fallbackIds: string[] = rules?.[0]?.fallback_service_ids ?? [];

    const candidates: ServiceCandidate[] = (caps ?? [])
      .map((cap) => {
        const svc = svcMap.get(cap.service_id);
        if (!svc) return null;
        const healthy = (svc.last_health_status ?? "unknown") === "healthy";
        const activeApproved = svc.is_active && svc.approval_status === "approved";
        const baseScore =
          (Number(cap.confidence) || 0) +
          (Number(svc.confidence_score) || 0) * 10 -
          (Number(cap.priority) || 100);
        const bonus =
          (preferredId === svc.id ? 1000 : 0) +
          (fallbackIds.includes(svc.id) ? 200 : 0) +
          (healthy ? 100 : 0) +
          (activeApproved ? 50 : -500);
        return {
          service_id: svc.id,
          service_name: svc.name,
          site_id: svc.site_id ?? null,
          capability: cap.capability,
          task_type: cap.task_type,
          priority: cap.priority,
          confidence: Number(cap.confidence),
          score: baseScore + bonus,
          health: svc.last_health_status,
          is_active: svc.is_active,
          approval_status: svc.approval_status,
          reason: [
            preferredId === svc.id ? "preferred-by-rule" : null,
            fallbackIds.includes(svc.id) ? "fallback-by-rule" : null,
            healthy ? "healthy" : "unhealthy",
            activeApproved ? "active+approved" : "inactive-or-unapproved",
          ]
            .filter(Boolean)
            .join(", "),
        } as ServiceCandidate;
      })
      .filter((c): c is ServiceCandidate => c !== null)
      .sort((a, b) => b.score - a.score);

    return {
      best: candidates[0] ?? null,
      alternatives: candidates.slice(1, 6),
      rules: rules ?? [],
      reason: candidates[0]
        ? `Selected ${candidates[0].service_name} (${candidates[0].reason})`
        : `No eligible active/approved service for '${taskType}'.`,
    };
  });

/**
 * Ecosystem Map — reads registry + capabilities + dependencies + health,
 * returns a graph the frontend can render.
 */
export const buildEcosystemMap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ data: services }, { data: caps }, { data: deps }, { data: sites }] =
      await Promise.all([
        supabase
          .from("services")
          .select("id, name, site_id, category, is_active, approval_status, last_health_status")
          .eq("is_active", true),
        supabase.from("service_capabilities").select("service_id, task_type, capability").eq("is_active", true),
        supabase.from("service_dependencies").select("service_id, depends_on_service_id, relation_type"),
        supabase.from("sites").select("id, name, domain"),
      ]);

    const capsByService = new Map<string, { task_type: string; capability: string }[]>();
    for (const c of caps ?? []) {
      const list = capsByService.get(c.service_id) ?? [];
      list.push({ task_type: c.task_type, capability: c.capability });
      capsByService.set(c.service_id, list);
    }

    const nodes = (services ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      site_id: s.site_id,
      health: s.last_health_status ?? "unknown",
      capabilities: capsByService.get(s.id) ?? [],
    }));

    const edges = (deps ?? [])
      .filter((d) => d.depends_on_service_id)
      .map((d) => ({
        from: d.service_id,
        to: d.depends_on_service_id!,
        type: d.relation_type ?? "depends_on",
      }));

    return { nodes, edges, sites: sites ?? [] };
  });
