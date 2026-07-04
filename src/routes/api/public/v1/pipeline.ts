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
        const { authenticateKey, checkRateLimit, jsonResponse } =
          await import("@/lib/hub-executor.server");
        const { runPipeline } = await import("@/lib/pipeline.server");

        const auth = await authenticateKey(request);
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

        try {
          const result = await runPipeline({
            intent: body.intent,
            prompt: body.prompt,
            requester_site: body.requester_site ?? auth.key.client?.name ?? null,
            api_key_id: auth.key.id,
            client_id: auth.key.client_id,
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
