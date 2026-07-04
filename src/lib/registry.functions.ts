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

// Seed site_capabilities from currently approved+active services, using a
// keyword heuristic to infer task_type. Marks entries as "online / inferred"
// so the Dispatcher immediately has providers to route to. Existing rows are
// left untouched.
export const seedRegistryFromServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminOrDeveloper(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: services, error } = await supabaseAdmin
      .from("services")
      .select("id, site_id, name, category, tags, description")
      .eq("is_active", true)
      .eq("approval_status", "approved");
    if (error) throw new Error(error.message);

    const infer = (s: any): string => {
      const cat = String(s.category ?? "").toLowerCase();
      const hay = [s.name, s.category, s.description, ...(Array.isArray(s.tags) ? s.tags : [])]
        .filter(Boolean).join(" ").toLowerCase();
      const has = (...w: string[]) => w.some((k) => hay.includes(k));
      if (has("logo")) return "logo_design";
      if (has("translate", "translat", "ترجم")) return "translation";
      if (has("image", "picture", "photo", "صور")) return "image_generation";
      if (has("video", "فيديو")) return "video_generation";
      if (has("audio", "voice", "tts", "speech", "صوت")) return "audio_generation";
      if (cat === "chat" || has("chat", "conversation", "assistant", "دردش", "محادث")) return "chat";
      if (has("deploy", "publish", "نشر")) return "deployment";
      if (has("build", "website", "site builder", "بناء", "موقع")) return "website_building";
      if (cat === "database" || has("database", " db ", "sql", "postgres", "supabase", "قاعدة")) return "database_creation";
      if (cat === "ai" || has("text", "write", "copy", "blog", "article", "gpt", "llm", "نص", "مقال")) return "text_generation";
      return "generic";
    };

    const rows = (services ?? []).map((s: any) => ({
      site_id: s.site_id,
      service_id: s.id,
      task_type: infer(s),
      status: "online" as const,
      source: "inferred" as const,
      input_schema: {},
      output_schema: {},
      metadata: { seeded_from: "services", inferred_at: new Date().toISOString() },
      last_probed_at: new Date().toISOString(),
      last_ok_at: new Date().toISOString(),
    }));

    // Skip services that already have a capability row.
    const { data: existing } = await supabaseAdmin
      .from("site_capabilities")
      .select("service_id");
    const seen = new Set((existing ?? []).map((r: any) => r.service_id));
    const toInsert = rows.filter((r) => !seen.has(r.service_id));
    if (!toInsert.length) return { ok: true, inserted: 0, total_services: rows.length };

    const { error: iErr } = await supabaseAdmin.from("site_capabilities").insert(toInsert as any);
    if (iErr) throw new Error(iErr.message);
    return { ok: true, inserted: toInsert.length, total_services: rows.length };
  });
