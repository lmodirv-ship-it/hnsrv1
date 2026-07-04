import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const serviceInput = z.object({
  site_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/),
  category: z.string().trim().max(80).optional().nullable(),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).default("POST"),
  endpoint_path: z.string().trim().max(500).optional().nullable(),
  endpoint_url: z.string().trim().url().max(500).optional().nullable(),
  gateway_url: z.string().trim().url().max(500).optional().nullable(),
  routing_mode: z.enum(["direct", "via_tvcc", "auto"]).default("auto"),
  scopes: z.array(z.string().trim().max(60)).max(20).default([]),
  rate_limit_per_min: z.number().int().min(1).max(100000).default(60),
  description: z.string().trim().max(1000).optional().nullable(),
  tags: z.array(z.string().trim().max(40)).max(20).default([]),
  is_active: z.boolean().default(true),
});

export const listServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("services")
      .select("*, sites(id, name, slug, base_url, logo_url, category)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const list = data ?? [];
    if (!list.length) return [];

    const ids = list.map((s: any) => s.id);
    const { data: depsData } = await context.supabase
      .from("service_dependencies" as any)
      .select("service_id, depends_on_system, depends_on_service_id, consumer_site_id, relation_type")
      .in("service_id", ids);
    const deps = ((depsData ?? []) as unknown) as Array<{
      service_id: string;
      depends_on_system: string | null;
      depends_on_service_id: string | null;
      consumer_site_id: string | null;
      relation_type: string;
    }>;

    const depsByService = new Map<string, Set<string>>();
    const consumersByService = new Map<string, Set<string>>();
    for (const d of deps) {
      if (d.relation_type === "consumes" && d.consumer_site_id) {
        const s = consumersByService.get(d.service_id) ?? new Set<string>();
        s.add(d.consumer_site_id);
        consumersByService.set(d.service_id, s);
      } else if (d.depends_on_system) {
        const s = depsByService.get(d.service_id) ?? new Set<string>();
        s.add(d.depends_on_system);
        depsByService.set(d.service_id, s);
      }
    }


    return list.map((s: any) => ({
      ...s,
      depends_on: Array.from(depsByService.get(s.id) ?? []),
      consumer_count: (consumersByService.get(s.id) ?? new Set()).size,
    }));
  });


export const approveService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("services")
      .update({ approval_status: "approved", is_active: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rejectService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("services")
      .update({ approval_status: "rejected", is_active: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: Partial<{ name: string; category: string | null; description: string | null; endpoint_path: string | null; method: string; api_required: boolean; is_active: boolean }> }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("services")
      .update(data.patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => serviceInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("services")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("services").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const findServiceByIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { intent: string }) => d)
  .handler(async ({ data, context }) => {
    const terms = data.intent
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const { data: services, error } = await context.supabase
      .from("services")
      .select("*, sites(name, slug)")
      .eq("is_active", true);
    if (error) throw new Error(error.message);

    const scored = (services ?? []).map((s: any) => {
      const hay = [s.name, s.description, s.category, ...(s.tags ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      let score = 0;
      for (const t of terms) if (hay.includes(t)) score += 1;
      return { service: s, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.filter((x) => x.score > 0).slice(0, 5);
  });
