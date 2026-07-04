import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ecosystemMap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: sites } = await context.supabase
      .from("sites")
      .select("id, slug, name, category, base_url, updated_at, last_health_status")
      .not("category", "is", null);
    const { data: healths } = await context.supabase
      .from("service_health")
      .select("service_id, status, checked_at, services(site_id)")
      .order("checked_at", { ascending: false })
      .limit(500);
    const { data: subs } = await context.supabase
      .from("pipeline_subtasks")
      .select("assigned_service_id, updated_at, services(site_id)")
      .not("assigned_service_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1000);

    // group by category
    const byCat = new Map<string, {
      category: string;
      sites: number;
      representative: { slug: string; name: string } | null;
      last_activity: string | null;
      online: number;
      tasks: number;
      status: "online" | "degraded" | "offline" | "unknown";
    }>();

    for (const s of sites ?? []) {
      const cat = (s as any).category as string;
      if (!cat) continue;
      const cur = byCat.get(cat) ?? {
        category: cat,
        sites: 0,
        representative: null,
        last_activity: null,
        online: 0,
        tasks: 0,
        status: "unknown" as const,
      };
      cur.sites += 1;
      if (!cur.representative) cur.representative = { slug: s.slug!, name: s.name! };
      if ((s as any).last_health_status === "online") cur.online += 1;
      const upd = (s as any).updated_at;
      if (upd && (!cur.last_activity || upd > cur.last_activity)) cur.last_activity = upd;
      byCat.set(cat, cur);
    }

    // Overlay latest health via services→site
    const siteHealth = new Map<string, string>();
    for (const h of healths ?? []) {
      const siteId = (h as any).services?.site_id;
      if (!siteId || siteHealth.has(siteId)) continue;
      siteHealth.set(siteId, (h as any).status);
    }
    const siteById = new Map((sites ?? []).map((s: any) => [s.id, s]));
    for (const [siteId, status] of siteHealth) {
      const s = siteById.get(siteId);
      if (!s) continue;
      const cur = byCat.get((s as any).category);
      if (!cur) continue;
      if (status === "online" && cur.status !== "online") cur.status = "online";
      else if (status === "degraded" && cur.status === "unknown") cur.status = "degraded";
      else if (status === "offline" && cur.status === "unknown") cur.status = "offline";
    }
    // If online sites recorded, mark online
    for (const cur of byCat.values()) {
      if (cur.status === "unknown" && cur.online > 0) cur.status = "online";
    }

    // Task counts by category (via subtasks → service.site_id → site.category)
    for (const st of subs ?? []) {
      const siteId = (st as any).services?.site_id;
      if (!siteId) continue;
      const s: any = siteById.get(siteId);
      if (!s) continue;
      const cur = byCat.get(s.category);
      if (!cur) continue;
      cur.tasks += 1;
      const upd = (st as any).updated_at;
      if (upd && (!cur.last_activity || upd > cur.last_activity)) cur.last_activity = upd;
    }

    return [...byCat.values()].sort((a, b) => b.sites - a.sites);
  });



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
