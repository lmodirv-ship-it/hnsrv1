import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import bcrypt from "bcryptjs";

const clientInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  rate_limit_per_min: z.number().int().min(1).max(10000).default(60),
  allowed_services: z.array(z.string().uuid()).default([]),
});

function generateKeyMaterial() {
  const prefix = "hn_" + Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const secret = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { prefix, secret, full: `${prefix}.${secret}` };
}

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("api_clients")
      .select("*, api_keys(id, key_prefix, scopes, created_at, revoked_at, last_used_at, expires_at)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => clientInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("api_clients")
      .insert({ ...data, owner_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("api_clients").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const issueKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { client_id: string; scopes?: string[] }) => d)
  .handler(async ({ data, context }) => {
    // Verify ownership
    const { data: client, error: cErr } = await context.supabase
      .from("api_clients")
      .select("id, owner_id")
      .eq("id", data.client_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!client || client.owner_id !== context.userId) throw new Error("Forbidden");

    const { prefix, secret, full } = generateKeyMaterial();
    const key_hash = await bcrypt.hash(secret, 10);
    const { error } = await context.supabase.from("api_keys").insert({
      client_id: data.client_id,
      key_prefix: prefix,
      key_hash,
      scopes: data.scopes ?? [],
    });
    if (error) throw new Error(error.message);
    return { key: full, prefix };
  });

export const revokeKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recentRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("service_requests")
      .select("*, services(name, slug), api_clients(name)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Issue one API client + key per HN site in the mesh so each site can call
// the hub. The raw key is returned only once and stored in sites.metadata.hn_hub_key
// (prefix only kept afterwards on subsequent runs).
export const provisionMeshKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: sites, error: sErr } = await context.supabase
      .from("sites")
      .select("id, name, slug, metadata")
      .or("tvcc_id.not.is.null,hn_db_id.not.is.null,hn_cloud_id.not.is.null,base_url.ilike.%hn-%,base_url.ilike.%hn.%,slug.ilike.hn-%,category.eq.consumer,category.eq.coordinator");
    if (sErr) throw new Error(sErr.message);

    let issued = 0;
    let skipped = 0;
    const results: Array<{ slug: string; key?: string; prefix?: string; skipped?: boolean }> = [];

    for (const site of sites ?? []) {
      const meta = (site.metadata ?? {}) as any;
      if (meta.hn_hub_key_prefix) {
        skipped++;
        results.push({ slug: site.slug, prefix: meta.hn_hub_key_prefix, skipped: true });
        continue;
      }
      const clientName = `mesh:${site.slug}`;
      let clientId: string;
      const { data: existingClient } = await context.supabase
        .from("api_clients").select("id").eq("name", clientName).eq("owner_id", context.userId).maybeSingle();
      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const { data: newClient, error: cErr } = await context.supabase
          .from("api_clients").insert({
            name: clientName,
            description: `Auto-issued for HN mesh site ${site.name}`,
            rate_limit_per_min: 120,
            allowed_services: [],
            owner_id: context.userId,
          }).select("id").single();
        if (cErr) throw new Error(cErr.message);
        clientId = newClient.id;
      }

      const { prefix, secret, full } = generateKeyMaterial();
      const key_hash = await bcrypt.hash(secret, 10);
      const { error: kErr } = await context.supabase.from("api_keys").insert({
        client_id: clientId, key_prefix: prefix, key_hash, scopes: [],
      });
      if (kErr) throw new Error(kErr.message);

      // SECURITY: never persist the plaintext key in DB — prefix only.
      // The full key is returned once in the response below.
      await context.supabase.from("sites").update({
        metadata: { ...meta, hn_hub_key_prefix: prefix, hn_hub_provisioned_at: new Date().toISOString() },
      }).eq("id", site.id);

      issued++;
      results.push({ slug: site.slug, key: full, prefix });
    }

    return { issued, skipped, total: sites?.length ?? 0, results: results.slice(0, 20) };
  });

