import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// منارة — شبكة تبادل الشيفرات بين مواقع مجموعة HN.
// كل تغيير نطاق/مسار يُسجَّل في جدول التصدير ويُنسخ كـ import لكل موقع مستهدف.

const SIGNAL_TYPES = [
  "domain_change",
  "route_change",
  "status",
  "announcement",
  "asset",
] as const;

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("هذه العملية متاحة للمدراء فقط");
}

export const listManaraExports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("manara_exports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listManaraImports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("manara_imports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listManaraNodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sites")
      .select("id, name, slug, base_url, status, layer")
      .order("name", { ascending: true })
      .limit(60);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const publishManaraSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        source_site: z.string().min(2).max(200),
        signal_type: z.enum(SIGNAL_TYPES).default("announcement"),
        signal_key: z.string().min(1).max(160),
        old_value: z.string().max(500).nullable().optional(),
        new_value: z.string().max(500).nullable().optional(),
        targets: z.array(z.string().min(1).max(200)).max(50).default([]),
        site_id: z.string().uuid().nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);

    const { data: exp, error } = await context.supabase
      .from("manara_exports")
      .insert({
        source_site: data.source_site,
        site_id: data.site_id ?? null,
        signal_type: data.signal_type,
        signal_key: data.signal_key,
        old_value: data.old_value ?? null,
        new_value: data.new_value ?? null,
        targets: data.targets,
        status: data.targets.length ? "delivered" : "pending",
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    if (data.targets.length) {
      const rows = data.targets.map((t) => ({
        sender_site: data.source_site,
        target_site: t,
        export_id: exp.id,
        signal_type: data.signal_type,
        signal_key: data.signal_key,
        value: data.new_value ?? null,
      }));
      const { error: impErr } = await context.supabase.from("manara_imports").insert(rows);
      if (impErr) throw new Error(impErr.message);
    }

    return exp;
  });

export const setImportStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid(),
        process_status: z.enum(["received", "applied", "ignored", "rejected"]),
        reject_reason: z.string().max(300).nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { error } = await context.supabase
      .from("manara_imports")
      .update({
        process_status: data.process_status,
        reject_reason: data.reject_reason ?? null,
        applied_at: data.process_status === "applied" ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteManaraExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { error } = await context.supabase.from("manara_exports").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
