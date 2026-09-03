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
