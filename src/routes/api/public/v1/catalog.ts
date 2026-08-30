import { createFileRoute } from "@tanstack/react-router";

// GET /api/public/v1/catalog — service catalog of the HN Service Hub.
// Auth: Authorization: Bearer <hn_prefix>.<secret>
//   or  X-Hn-Site-Id + X-Hn-Internal-Token (internal HN network)
// Used by partner sites (TVCC, HN-DB, HN-Cloud) to verify the link and
// discover which services the Hub exposes.
export const Route = createFileRoute("/api/public/v1/catalog")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { corsHeaders } = await import("@/lib/hub-executor.server");
        return new Response(null, {
          status: 204,
          headers: { ...corsHeaders(), "Access-Control-Allow-Methods": "GET, POST, OPTIONS" },
        });
      },
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request) {
  const { authenticate, jsonResponse, extractGatewayContext } = await import(
    "@/lib/hub-executor.server"
  );

  const auth = await authenticate(request);
  if ("error" in auth) return jsonResponse(401, { ok: false, error: auth.error });

  const ctx = extractGatewayContext(request);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [{ data: sites }, { data: services }] = await Promise.all([
    supabaseAdmin
      .from("sites")
      .select("id, name, slug, base_url, category, layer, network_type")
      .order("name"),
    supabaseAdmin
      .from("services")
      .select("id, site_id, name, category, method, description, approval_status, is_active")
      .eq("is_active", true)
      .order("name"),
  ]);

  const allowed = auth.key.auth_mode === "internal"
    ? auth.key.connector?.allowed_internal_services ?? []
    : auth.key.client?.allowed_services ?? [];
  const filter = (id: string) => allowed.length === 0 || allowed.includes(id);

  const siteById = new Map((sites ?? []).map((s: any) => [s.id, s]));

  return jsonResponse(200, {
    ok: true,
    hub: {
      name: "HN Service Hub",
      execute_url: "/api/public/v1/execute",
      ask_url: "/api/public/v1/ask",
      orchestrate_url: "/api/public/v1/orchestrate",
    },
    caller: {
      mode: auth.key.auth_mode,
      site: auth.key.connector?.site_slug ?? auth.key.client?.name ?? null,
      gateway: ctx.gateway_site,
      requester_site: ctx.requester_site,
    },
    generated_at: new Date().toISOString(),
    sites: (sites ?? []).map((s: any) => ({
      name: s.name,
      slug: s.slug,
      base_url: s.base_url,
      category: s.category,
      layer: s.layer,
      network_type: s.network_type,
    })),
    services: (services ?? [])
      .filter((s: any) => filter(s.id))
      .map((s: any) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        method: s.method,
        description: s.description,
        status: s.approval_status,
        site: siteById.get(s.site_id)?.slug ?? null,
      })),
  });
}
