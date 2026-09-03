import { createFileRoute } from "@tanstack/react-router";

// GET /api/public/v1/sites — public export of the HN group site list.
// Any HN group site can pull this to stay in sync (no auth needed: the list
// contains only public catalogue data).
export const Route = createFileRoute("/api/public/v1/sites")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
          },
        }),
      GET: async () => {
        const { buildExportPayload } = await import("@/lib/tvcc-sync.server");
        const payload = await buildExportPayload();
        return new Response(JSON.stringify({ ok: true, ...payload }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=60",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});
