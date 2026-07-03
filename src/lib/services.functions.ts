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
  description: z.string().trim().max(1000).optional().nullable(),
  tags: z.array(z.string().trim().max(40)).max(20).default([]),
  is_active: z.boolean().default(true),
});

export const listServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("services")
      .select("*, sites(name, slug)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
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
