import { createFileRoute } from "@tanstack/react-router";

// POST /api/public/v1/pipeline — Multi-Service Orchestrator entrypoint.
// The Hub decomposes the intent into subtasks, dispatches each to the best
// specialized service across the HN mesh, aggregates all outputs, and
// returns a single final package to the caller.
// Header: Authorization: Bearer <api_key>   (format: hn_xxxx.<secret>)
// Body:   { intent: string, prompt?: string, requester_site?: string, payload?: object }
export const Route = createFileRoute("/api/public/v1/pipeline")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { corsHeaders } = await import("@/lib/hub-executor.server");
        return new Response(null, { status: 204, headers: corsHeaders() });
      },
      POST: async ({ request }) => {
        const { authenticate, checkRateLimit, extractGatewayContext, jsonResponse } =
          await import("@/lib/hub-executor.server");
        const { runPipeline } = await import("@/lib/pipeline.server");

        const auth = await authenticate(request);
        if ("error" in auth) return jsonResponse(401, { ok: false, error: auth.error });
        const rl = await checkRateLimit(auth.key);
        if (!rl.ok) return jsonResponse(429, { ok: false, error: "Rate limit exceeded", limit: rl.limit });

        let body: any = {};
        try { body = await request.json(); } catch {
          return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
        }
        if (!body.intent || typeof body.intent !== "string") {
          return jsonResponse(400, { ok: false, error: "`intent` is required" });
        }

        const ctx = extractGatewayContext(request);
        const isInternal = auth.key.auth_mode === "internal";
        try {
          const result = await runPipeline({
            intent: body.intent,
            prompt: body.prompt,
            requester_site:
              ctx.requester_site ??
              body.requester_site ??
              (isInternal ? auth.key.connector?.site_slug ?? null : auth.key.client?.name ?? null),
            gateway_site: ctx.gateway_site,
            api_key_id: isInternal ? null : auth.key.id,
            client_id: isInternal ? null : auth.key.client_id,
            internal_connector_id: isInternal ? auth.key.id : null,
            auth_mode: auth.key.auth_mode,
            input_payload: body.payload ?? null,
          });
          return jsonResponse(200, result);
        } catch (e: any) {
          return jsonResponse(500, { ok: false, error: e?.message ?? "pipeline failed" });
        }
      },
    },
  },
});
