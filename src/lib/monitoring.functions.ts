import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ping(url: string): Promise<{ status: string; latency_ms: number; error?: string }> {
  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, { signal: ctrl.signal, method: "GET" });
    clearTimeout(to);
    const latency = Date.now() - start;
    return { status: res.ok ? "online" : "degraded", latency_ms: latency, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (e: any) {
    return { status: "offline", latency_ms: Date.now() - start, error: e?.message ?? "unreachable" };
  }
}

export const checkServiceHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { service_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: svc, error } = await context.supabase
      .from("services")
      .select("id, endpoint_path, sites(base_url)")
      .eq("id", data.service_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!svc || !svc.sites) throw new Error("Service not found");
    const site: any = svc.sites;
    const url = (site.base_url as string).replace(/\/$/, "") + (svc.endpoint_path ?? "/");
    const result = await ping(url);
    await context.supabase.from("service_health").insert({
      service_id: data.service_id,
      status: result.status,
      latency_ms: result.latency_ms,
      error: result.error ?? null,
    });
    return result;
  });

export const checkAllHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: svcs, error } = await context.supabase
      .from("services")
      .select("id, endpoint_path, sites(base_url)")
      .eq("is_active", true);
    if (error) throw new Error(error.message);
    let checked = 0;
    let online = 0;
    let failed = 0;
    for (const svc of svcs ?? []) {
      const site: any = (svc as any).sites;
      if (!site?.base_url) continue;
      const url = String(site.base_url).replace(/\/$/, "") + ((svc as any).endpoint_path ?? "/");
      const r = await ping(url);
      await context.supabase.from("service_health").insert({
        service_id: (svc as any).id,
        status: r.status,
        latency_ms: r.latency_ms,
        error: r.error ?? null,
      });
      checked++;
      if (r.status === "online") online++; else failed++;
    }
    return { checked, online, failed };
  });



export const latestHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("service_health")
      .select("*, services(name, slug, sites(name))")
      .order("checked_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const dashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [
      sites,
      services,
      keys,
      requests,
      pipelinesTotal,
      pipelinesRunning,
      pipelinesDone,
      users,
      sitesList,
      healthLatest,
      recentPipelines,
    ] = await Promise.all([
      context.supabase.from("sites").select("id", { count: "exact", head: true }),
      context.supabase.from("services").select("id", { count: "exact", head: true }),
      context.supabase.from("api_keys").select("id", { count: "exact", head: true }).is("revoked_at", null),
      context.supabase
        .from("service_requests")
        .select("*, services(name), api_clients(name)")
        .order("created_at", { ascending: false })
        .limit(10),
      context.supabase.from("pipelines").select("id", { count: "exact", head: true }),
      context.supabase.from("pipelines").select("id", { count: "exact", head: true }).in("status", ["running", "planning", "dispatching", "collecting"]),
      context.supabase.from("pipelines").select("id", { count: "exact", head: true }).eq("status", "done"),
      context.supabase.from("profiles").select("id", { count: "exact", head: true }),
      context.supabase.from("sites").select("id, name, slug, base_url, network_type, metadata"),
      context.supabase.from("service_health").select("service_id, status, latency_ms, checked_at, services(name, slug)").order("checked_at", { ascending: false }).limit(50),
      context.supabase.from("pipelines").select("id, intent, status, created_at, finished_at").order("created_at", { ascending: false }).limit(8),
    ]);

    // Avg latency + success rate across recent requests
    const recent = requests.data ?? [];
    const withLatency = recent.filter((r: any) => typeof r.latency_ms === "number");
    const avgLatency = withLatency.length
      ? Math.round(withLatency.reduce((a: number, r: any) => a + r.latency_ms, 0) / withLatency.length)
      : 0;
    const successCount = recent.filter((r: any) => r.status_code && r.status_code < 400).length;
    const successRate = recent.length ? Math.round((successCount / recent.length) * 100) : 100;

    return {
      sites: sites.count ?? 0,
      services: services.count ?? 0,
      keys: keys.count ?? 0,
      recent,
      pipelines: {
        total: pipelinesTotal.count ?? 0,
        running: pipelinesRunning.count ?? 0,
        completed: pipelinesDone.count ?? 0,
      },
      users: users.count ?? 0,
      avgLatencyMs: avgLatency,
      successRate,
      sitesList: sitesList.data ?? [],
      health: healthLatest.data ?? [],
      recentPipelines: recentPipelines.data ?? [],
    };
  });
