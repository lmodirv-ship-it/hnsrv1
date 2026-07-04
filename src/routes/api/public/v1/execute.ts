import { createFileRoute } from "@tanstack/react-router";

// POST /api/public/v1/execute — the hidden brain of the HN mesh.
// Header: Authorization: Bearer <api_key>  (format: hn_xxxx.<secret>)
// Body: { requester_site?, intent?, service_id?, payload?, method?, path?, query?, timeout_ms? }
export const Route = createFileRoute("/api/public/v1/execute")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { corsHeaders } = await import("@/lib/hub-executor.server");
        return new Response(null, { status: 204, headers: corsHeaders() });
      },
      POST: async ({ request }) => {
        const {
          authenticateKey, checkRateLimit, executeAgainstService, jsonResponse,
        } = await import("@/lib/hub-executor.server");

        const auth = await authenticateKey(request);
        if ("error" in auth) return jsonResponse(401, { ok: false, error: auth.error });

        const rl = await checkRateLimit(auth.key);
        if (!rl.ok) return jsonResponse(429, { ok: false, error: "Rate limit exceeded", limit: rl.limit });

        let body: any = {};
        try { body = await request.json(); } catch {
          return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
        }
        if (!body.intent && !body.service_id) {
          return jsonResponse(400, { ok: false, error: "Provide `intent` or `service_id`" });
        }

        return executeAgainstService(auth.key, {
          requester_site: body.requester_site,
          intent: body.intent,
          service_id: body.service_id,
          method: body.method,
          path: body.path,
          query: body.query,
          payload: body.payload,
          timeout_ms: body.timeout_ms,
        });
      },
    },
  },
});
