import { createFileRoute } from "@tanstack/react-router";

// POST /api/public/v1/discovery/refresh
// Body: { site_id?: string | null }
// Auth: internal token (X-Hn-Internal-Token) — external API keys are rejected.
export const Route = createFileRoute("/api/public/v1/discovery/refresh")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { corsHeaders } = await import("@/lib/hub-executor.server");
        return new Response(null, { status: 204, headers: corsHeaders() });
      },
      POST: async ({ request }) => {
        const { authenticateInternal, jsonResponse } = await import("@/lib/hub-executor.server");
        const auth = await authenticateInternal(request);
        if ("error" in auth) return jsonResponse(401, { ok: false, error: auth.error });
        if (auth.key.connector?.trust_level !== "trusted") {
          return jsonResponse(403, { ok: false, error: "Trusted internal connector required" });
        }
        let body: any = {};
        try { body = await request.json(); } catch { /* empty body ok */ }
        const siteId = body?.site_id ?? null;
        const { runDiscovery } = await import("@/lib/hub-engines/service-discovery.server");
        const summary = await runDiscovery({ siteId, initiatedBy: null });
        return jsonResponse(200, { ok: true, ...summary });
      },
    },
  },
});
