// Owner-only: activate every task/service/site in the HN mesh in one click.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { userId: string; supabase: any }) {
  const { data: isAdmin, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Forbidden: admin role required");
}

export type ActivateAllResult = {
  ok: true;
  services_activated: number;
  service_capabilities_activated: number;
  site_capabilities_online: number;
  sites_active: number;
  router_rules_active: number;
};

export const activateAllTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ActivateAllResult> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const svc = await supabaseAdmin
      .from("services")
      .update({ is_active: true })
      .eq("is_active", false)
      .select("id");
    if (svc.error) throw new Error(svc.error.message);

    const scaps = await supabaseAdmin
      .from("service_capabilities")
      .update({ is_active: true })
      .eq("is_active", false)
      .select("id");
    if (scaps.error) throw new Error(scaps.error.message);

    const siteCaps = await supabaseAdmin
      .from("site_capabilities")
      .update({ status: "online" })
      .neq("status", "online")
      .select("id");
    if (siteCaps.error) throw new Error(siteCaps.error.message);

    const sites = await supabaseAdmin
      .from("sites")
      .update({ status: "active" })
      .neq("status", "active")
      .select("id");
    if (sites.error) throw new Error(sites.error.message);

    const rules = await supabaseAdmin
      .from("task_router_rules")
      .update({ is_active: true })
      .eq("is_active", false)
      .select("id");
    if (rules.error) throw new Error(rules.error.message);

    return {
      ok: true,
      services_activated: svc.data?.length ?? 0,
      service_capabilities_activated: scaps.data?.length ?? 0,
      site_capabilities_online: siteCaps.data?.length ?? 0,
      sites_active: sites.data?.length ?? 0,
      router_rules_active: rules.data?.length ?? 0,
    };
  });
