import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// POST /api/public/v1/task-center — a group site asks for a service.
// The hub resolves which site owns that service, dispatches the task,
// stores it and returns the result (also pushed back through TVCC).
export const Route = createFileRoute("/api/public/v1/task-center")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "*",
          },
        }),
      POST: async ({ request }) => {
        const schema = z.object({
          requester_site: z.string().min(1).max(255),
          requester_code: z.string().max(32).optional().nullable(),
          service_intent: z.string().min(1).max(200),
          payload: z.record(z.string(), z.unknown()).optional(),
          callback_url: z.string().url().max(500).optional().nullable(),
          origin: z.enum(["direct", "tvcc", "manara"]).optional(),
        });
        let parsed;
        try {
          parsed = schema.parse(await request.json());
        } catch (e: any) {
          return json(400, { ok: false, error: "invalid_request", detail: e?.message });
        }
        const { handleTask } = await import("@/lib/task-center.server");
        const result = await handleTask(parsed);
        return json(result.ok ? 200 : 502, result);
      },
    },
  },
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
