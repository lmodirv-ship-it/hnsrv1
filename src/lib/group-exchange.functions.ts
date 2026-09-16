import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Run the full import/export cycle with TVCC on demand.
export const runGroupSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { runGroupSyncCycle } = await import("./tvcc-sync.server");
    return runGroupSyncCycle(context.userId);
  });

// Manual fallback: import a pasted/uploaded site list (JSON array, {sites:[]} or CSV).
export const importSitesText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ text: z.string().min(1).max(2_000_000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { parseSiteList, importRawSites } = await import("./tvcc-sync.server");
    const raw = parseSiteList(data.text);
    if (!raw.length) throw new Error("لم يتم التعرف على أي موقع في اللائحة");
    const r = await importRawSites(raw, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("group_sync_runs").insert({
      source: "manual-upload",
      direction: "import",
      status: "success",
      imported: r.imported,
      updated: r.updated,
      detail: { count: r.count, skipped: r.skipped },
    } as any);
    return r;
  });

// Merge duplicate site rows for the same domain (www vs non-www).
export const mergeDuplicates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { mergeDuplicateSites } = await import("./tvcc-sync.server");
    return mergeDuplicateSites();
  });

// Summary shown at the top of the exchange page.
export const exchangeStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count: sitesCount } = await context.supabase
      .from("sites")
      .select("id", { count: "exact", head: true });
    const { count: fromTvcc } = await context.supabase
      .from("sites")
      .select("id", { count: "exact", head: true })
      .not("tvcc_id", "is", null);
    const { data: lastImport } = await context.supabase
      .from("group_sync_runs")
      .select("*")
      .eq("direction", "import")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: lastExport } = await context.supabase
      .from("group_sync_runs")
      .select("*")
      .eq("direction", "export")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return {
      sites: sitesCount ?? 0,
      fromTvcc: fromTvcc ?? 0,
      lastImport: lastImport ?? null,
      lastExport: lastExport ?? null,
    };
  });

export const listSyncRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("group_sync_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Sites + their active services — the "exchanged services" catalogue.
export const listExchangeCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: sites, error } = await context.supabase
      .from("sites")
      .select("id, name, slug, base_url, category, logo_url")
      .order("name");
    if (error) throw new Error(error.message);
    const list = sites ?? [];
    const { data: services } = await context.supabase
      .from("services")
      .select("id, site_id, name, category, method, endpoint_path, description, is_active")
      .eq("is_active", true);
    const byId = new Map<string, any[]>();
    for (const s of services ?? []) {
      const arr = byId.get(s.site_id) ?? [];
      arr.push(s);
      byId.set(s.site_id, arr);
    }
    return list.map((s: any) => ({ ...s, services: byId.get(s.id) ?? [] }));
  });

export const listTaskCenterTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("task_center_tasks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Send a service request into the task center from the dashboard.
export const submitTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        requester_site: z.string().trim().min(1).max(255),
        service_intent: z.string().trim().min(1).max(200),
        payload: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { handleTask } = await import("./task-center.server");
    return handleTask({ ...data, origin: "direct" });
  });
