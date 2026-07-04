import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getMyOrganization = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("organizations")
      .select("*")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  });

const upsertSchema = z.object({
  name: z.string().trim().min(1, "الاسم مطلوب").max(120),
  slug: z
    .string()
    .trim()
    .min(2, "المعرّف قصير جدًا")
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "استخدم أحرف صغيرة وأرقام وشرطات فقط"),
  logo_url: z
    .string()
    .trim()
    .url("رابط غير صالح")
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const upsertMyOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => upsertSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("organizations")
      .select("id")
      .eq("owner_id", context.userId)
      .maybeSingle();

    const payload = {
      owner_id: context.userId,
      name: data.name,
      slug: data.slug,
      logo_url: data.logo_url ?? null,
    };

    if (existing) {
      const { data: updated, error } = await context.supabase
        .from("organizations")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return updated;
    }
    const { data: inserted, error } = await context.supabase
      .from("organizations")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return inserted;
  });
