import { createFileRoute } from "@tanstack/react-router";

// GET /api/public/v1/health — unauthenticated liveness probe.
// Lets partner sites (TVCC, HN-DB, HN-Cloud) flip their integration card from
// "بانتظار الفحص" to "متصل" without holding a Hub-issued token.
// Returns no sensitive data: only hub identity + endpoint map + counts.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Hn-Site-Id, X-Hn-Internal-Token, X-Hn-Gateway, X-Hn-Requester-Site",
  "Access-Control-Max-Age": "86400",
} as const;

async function handle() {
  let sites = 0;
  let services = 0;
  let db: "ok" | "error" = "ok";
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [s1, s2] = await Promise.all([
      supabaseAdmin.from("sites").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("services").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]);
    sites = s1.count ?? 0;
    services = s2.count ?? 0;
    if (s1.error || s2.error) db = "error";
  } catch {
    db = "error";
  }

  return new Response(
    JSON.stringify({
      ok: true,
      status: "online",
      hub: {
        name: "HN Service Hub",
        slug: "hn-service-hub",
        base_url: "https://hnsrv1.lovable.app",
        version: "1.0",
      },
      database: db,
      counts: { sites, active_services: services },
      endpoints: {
        health: "/api/public/v1/health",
        catalog: "/api/public/v1/catalog",
        execute: "/api/public/v1/execute",
        ask: "/api/public/v1/ask",
        orchestrate: "/api/public/v1/orchestrate",
        verify_domain: "/api/public/v1/verify-domain",
      },
      auth: {
        catalog_requires_token: true,
        modes: ["Authorization: Bearer <prefix>.<secret>", "X-Hn-Site-Id + X-Hn-Internal-Token"],
        note: "Internal tokens must be issued by the Hub (Internal Connectors page). Tokens generated on the caller side will never validate.",
      },
      checked_at: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json", ...cors } },
  );
}

export const Route = createFileRoute("/api/public/v1/health")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async () => handle(),
      POST: async () => handle(),
    },
  },
});
