// Hub engines: list, toggle, and activate all 5 orchestrator engines.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type HubEngine = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  stage_order: number;
  is_enabled: boolean;
  last_activated_at: string | null;
  updated_at: string;
};

async function assertAdmin(ctx: { userId: string; supabase: any }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const listHubEngines = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HubEngine[]> => {
    const { data, error } = await context.supabase
      .from("hub_engines")
      .select("id,slug,name,description,stage_order,is_enabled,last_activated_at,updated_at")
      .order("stage_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as HubEngine[];
  });

export const setHubEngineEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string; enabled: boolean }) =>
    z.object({ slug: z.string().min(1), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { is_enabled: data.enabled };
    if (data.enabled) patch.last_activated_at = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("hub_engines")
      .update(patch)
      .eq("slug", data.slug);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const activateAllHubEngines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("hub_engines")
      .update({ is_enabled: true, last_activated_at: new Date().toISOString() })
      .neq("slug", "__none__")
      .select("slug");
    if (error) throw new Error(error.message);
    return { ok: true, activated: data?.length ?? 0 };
  });
