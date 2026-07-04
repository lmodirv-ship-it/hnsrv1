import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Billing / Payments server functions.
 * Provider (Paddle/Stripe) is NOT wired yet — this is scaffolding only.
 * Once the provider is enabled, add checkout URL generation + webhook route
 * under src/routes/api/public/ to persist rows.
 */

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("hn_payment_products")
      .select("*")
      .eq("active", true)
      .order("price_cents", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const listMySubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("hn_payment_subscriptions")
      .select("*, hn_payment_products(name, price_cents, currency, interval)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const listMyTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("hn_payment_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  });

export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1),
        description: z.string().optional().nullable(),
        provider: z.string().default("paddle"),
        provider_product_id: z.string().optional().nullable(),
        provider_price_id: z.string().optional().nullable(),
        price_cents: z.number().int().nonnegative(),
        currency: z.string().default("USD"),
        interval: z.string().optional().nullable(),
        active: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("hn_payment_products")
      .upsert(data)
      .select()
      .single();
    if (error) throw error;
    return row;
  });
