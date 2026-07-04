import { createFileRoute } from "@tanstack/react-router";

// POST /api/public/v1/ask — one-shot natural-language interface for HN sites.
// Body: { prompt: string, payload?: any }
// The hub picks the best-matching service by intent and executes it.
export const Route = createFileRoute("/api/public/v1/ask")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { corsHeaders } = await import("@/lib/hub-executor.server");
        return new Response(null, { status: 204, headers: corsHeaders() });
      },
      POST: async ({ request }) => {
        const {
          authenticate,
          checkRateLimit,
          executeAgainstService,
          jsonResponse,
        } = await import("@/lib/hub-executor.server");

        const auth = await authenticate(request);
        if ("error" in auth) return jsonResponse(401, { ok: false, error: auth.error });

        const rl = await checkRateLimit(auth.key);
        if (!rl.ok) return jsonResponse(429, { ok: false, error: "Rate limit exceeded", limit: rl.limit });

        let body: any = {};
        try { body = await request.json(); } catch {
          return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
        }
        const prompt = String(body.prompt ?? "").trim();
        if (!prompt) return jsonResponse(400, { ok: false, error: "Missing `prompt`" });

        return executeAgainstService(auth.key, {
          intent: prompt,
          payload: body.payload ?? { prompt },
          timeout_ms: body.timeout_ms,
        });
      },
    },
  },
});
