import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// List internal connectors visible to the current user (RLS handles filtering).
export const listInternalConnectors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("internal_connectors")
      .select(
        "id, site_id, name, token_prefix, trust_level, allowed_internal_services, connector_status, last_used_at, created_at, sites(name, slug, layer, network_type)",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Create a new internal connector for an HN site.
// Returns the plaintext token ONCE — the caller must store it immediately.
export const createInternalConnector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        site_id: z.string().uuid(),
        name: z.string().min(2).max(120),
        trust_level: z.enum(["trusted", "verified", "restricted"]).default("trusted"),
        allowed_internal_services: z.array(z.string()).default([]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    // Verify caller is admin OR owns the site
    const { data: site } = await context.supabase
      .from("sites")
      .select("id, owner_id, network_type")
      .eq("id", data.site_id)
      .maybeSingle();
    if (!site) throw new Error("Site not found");

    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin && site.owner_id !== context.userId) {
      throw new Error("Not authorized to create a connector for this site");
    }

    if (site.network_type !== "internal") {
      // Auto-promote site to internal since we're issuing an internal token
      await context.supabase
        .from("sites")
        .update({ network_type: "internal" })
        .eq("id", site.id);
    }

    // Generate token: prefix (hnint_XXXXXXXX) + secret (32 hex).
    const prefix =
      "hnint_" +
      Array.from(crypto.getRandomValues(new Uint8Array(6)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    const secret = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bcrypt = (await import("bcryptjs")).default;
    const token_hash = await bcrypt.hash(secret, 10);

    const { data: created, error } = await supabaseAdmin
      .from("internal_connectors")
      .insert({
        site_id: data.site_id,
        name: data.name,
        token_prefix: prefix,
        token_hash,
        trust_level: data.trust_level,
        allowed_internal_services: data.allowed_internal_services as any,
        connector_status: "active",
        created_by: context.userId,
      })
      .select("id, token_prefix")
      .single();
    if (error || !created) throw new Error(error?.message ?? "insert failed");

    return {
      id: created.id,
      token_prefix: created.token_prefix,
      // ONE-TIME plaintext token, format expected by X-Hn-Internal-Token header
      token: `${prefix}.${secret}`,
    };
  });

export const revokeInternalConnector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) {
      // Only owners of the connector's site can revoke
      const { data: conn } = await context.supabase
        .from("internal_connectors")
        .select("id, sites(owner_id)")
        .eq("id", data.id)
        .maybeSingle();
      const ownerId = (conn as any)?.sites?.owner_id;
      if (ownerId !== context.userId) throw new Error("Not authorized");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("internal_connectors")
      .update({ connector_status: "revoked" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listInternalSites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("sites")
      .select("id, name, slug, layer, network_type")
      .order("name");
    return data ?? [];
  });
