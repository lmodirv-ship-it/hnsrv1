// Owner/admin control-panel server functions.
// - Read/write platform_settings feature flags
// - Log every admin action to admin_actions
// - Expose whoami (roles) and recent actions
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function isAdmin(ctx: { userId: string; supabase: any }): Promise<boolean> {
  const { data } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  return !!data;
}

async function assertAdmin(ctx: { userId: string; supabase: any }) {
  if (!(await isAdmin(ctx))) throw new Error("Forbidden: admin role required");
}

async function logAction(
  ctx: { userId: string },
  action: string,
  target: string | null,
  payload: Record<string, unknown>,
  result: Record<string, unknown>,
  status: "success" | "failed" = "success",
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("admin_actions").insert({
    actor_id: ctx.userId,
    action,
    target,
    payload,
    result,
    status,
  });
}

/** Current user + roles (any signed-in user can call). */
export const whoAmI = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roleList = (roles ?? []).map((r: any) => r.role as string);
    return {
      user_id: context.userId,
      email: (context.claims as any)?.email ?? null,
      roles: roleList,
      is_admin: roleList.includes("admin"),
    };
  });

/** All platform settings (auth). */
export const listPlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("platform_settings")
      .select("*")
      .order("key");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Update a setting's JSON value (admin). Logged. */
export const updatePlatformSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        key: z.string().min(1).max(80),
        value: z.record(z.string(), z.any()),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("platform_settings")
      .update({ value: data.value, updated_by: context.userId })
      .eq("key", data.key)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logAction(context, "update_setting", data.key, data.value, row);
    return row;
  });

/** Recent admin actions (admin only). */
export const recentAdminActions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("admin_actions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/**
 * Bootstrap the first admin — usable ONLY when no admin exists yet.
 * Any authenticated user can call it; after the first admin is set,
 * subsequent calls fail. Prevents the empty-project lockout.
 */
export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: cErr } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) > 0) throw new Error("An admin already exists");

    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error(error.message);

    await logAction(context, "claim_first_admin", context.userId, {}, { ok: true });
    return { ok: true };
  });

/**
 * Wrapper that logs any admin action performed through other server fns.
 * The caller passes an action label + payload; we just record it.
 * Useful for buttons whose real work happens in a different server fn.
 */
export const recordAdminAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        action: z.string().min(1).max(80),
        target: z.string().max(200).optional().nullable(),
        payload: z.record(z.string(), z.any()).default({}),
        result: z.record(z.string(), z.any()).default({}),
        status: z.enum(["success", "failed"]).default("success"),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    await logAction(
      context,
      data.action,
      data.target ?? null,
      data.payload,
      data.result,
      data.status,
    );
    return { ok: true };
  });
