import { createFileRoute } from "@tanstack/react-router";

// POST /api/public/v1/orchestrate
// Body: { prompt: string, requester_site?: string }
// Runs the 5-engine HN Service Hub orchestrator: Request Analyzer →
// Task Planner → Task Dispatcher → Result Collector → Response Builder.
export const Route = createFileRoute("/api/public/v1/orchestrate")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { corsHeaders } = await import("@/lib/hub-executor.server");
        return new Response(null, { status: 204, headers: corsHeaders() });
      },
      POST: async ({ request }) => {
        const { authenticate, checkRateLimit, jsonResponse } = await import(
          "@/lib/hub-executor.server"
        );
        const { orchestrate } = await import("@/lib/hub-orchestrator.server");

        const auth = await authenticate(request);
        if ("error" in auth) return jsonResponse(401, { ok: false, error: auth.error });

        const rl = await checkRateLimit(auth.key);
        if (!rl.ok) {
          return jsonResponse(429, { ok: false, error: "Rate limit exceeded", limit: rl.limit });
        }

        let body: any = {};
        try {
          body = await request.json();
        } catch {
          return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
        }
        const prompt = String(body.prompt ?? "").trim();
        if (!prompt) return jsonResponse(400, { ok: false, error: "Missing `prompt`" });

        const result = await orchestrate(auth.key, {
          prompt,
          requester_site: body.requester_site ?? null,
        });
        return jsonResponse(result.ok ? 200 : 500, result);
      },
    },
  },
});
