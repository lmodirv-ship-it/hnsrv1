import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Group identifiers: a unique "letter + six digits" code (e.g. H000001) issued
// by the Hub for every HN site/service. The code can be embedded on any site
// with a "connect" button that signals TVCC (the group's center).

export const listIdentifiers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("group_identifiers")
      .select(
        "id, code, service_number, service_name, site_id, service_id, site_url, status, last_signal_at, last_tvcc_status, created_at, sites(name, slug, base_url)",
      )
      .order("service_number", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listIdentifierSignals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ identifier_id: z.string().uuid().optional() }).parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("group_identifier_signals")
      .select("id, identifier_id, origin, forwarded_to_tvcc, tvcc_status, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data.identifier_id) q = q.eq("identifier_id", data.identifier_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("هذه العملية متاحة للمدراء فقط");
}

export const issueIdentifier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        service_name: z.string().min(2).max(140),
        site_id: z.string().uuid().nullable().optional(),
        service_id: z.string().uuid().nullable().optional(),
        site_url: z.string().url().max(300).nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: next, error: nextErr } = await supabaseAdmin.rpc("next_group_identifier");
    if (nextErr) throw new Error(nextErr.message);
    const row = Array.isArray(next) ? next[0] : next;
    if (!row) throw new Error("تعذّر توليد الرمز");

    const { data: inserted, error } = await supabaseAdmin
      .from("group_identifiers")
      .insert({
        code: row.code,
        service_number: row.service_number,
        service_name: data.service_name,
        site_id: data.site_id ?? null,
        service_id: data.service_id ?? null,
        site_url: data.site_url ?? null,
        created_by: context.userId,
      })
      .select("id, code, service_number, service_name, site_url, status, created_at")
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const revokeIdentifier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { error } = await context.supabase
      .from("group_identifiers")
      .update({ status: "revoked" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
