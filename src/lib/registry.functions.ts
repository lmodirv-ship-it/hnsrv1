// Client-callable server fns for the Site Registry (Site Inventory,
// Service Discovery, Capability Registry).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdminOrDeveloper(ctx: { userId: string; supabase: any }) {
  const { data: isAdmin } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  const { data: isDev } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "developer" });
  if (!isAdmin && !isDev) throw new Error("Forbidden");
  return { isAdmin: !!isAdmin };
}

export const listRegistrySites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminOrDeveloper(context);
    const { data, error } = await context.supabase
      .from("sites")
      .select("id, name, slug, base_url, manifest_path, network_type")
      .eq("network_type", "internal")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listCapabilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminOrDeveloper(context);
    const { data, error } = await context.supabase
      .from("site_capabilities")
      .select(
        "id, task_type, status, source, last_probed_at, last_ok_at, probe_error, input_schema, output_schema, services(id, name, slug), sites(id, name, slug)",
      )
      .order("task_type", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listDiscoveryRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminOrDeveloper(context);
    const { data, error } = await context.supabase
      .from("discovery_runs")
      .select("id, site_id, status, started_at, finished_at, services_found, capabilities_found, errors_count, errors")
      .order("started_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const runSiteDiscovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ site_id: z.string().uuid().nullable().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { isAdmin } = await assertAdminOrDeveloper(context);
    if (!isAdmin) throw new Error("Forbidden");
    const { runDiscovery } = await import("@/lib/hub-engines/service-discovery.server");
    return runDiscovery({ siteId: data.site_id ?? null, initiatedBy: context.userId });
  });

export const previewSiteManifest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ site_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminOrDeveloper(context);
    const { previewSiteManifest: preview } = await import("@/lib/hub-engines/service-discovery.server");
    return (await preview(data.site_id)) as any;
  });

export const listAvailableTaskTypesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminOrDeveloper(context);
    const { listAvailableTaskTypes } = await import("@/lib/hub-engines/capability-registry.server");
    return (await listAvailableTaskTypes()) as any;
  });
