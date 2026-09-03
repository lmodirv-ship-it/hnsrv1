import { createFileRoute } from "@tanstack/react-router";

// POST /api/public/v1/sync/daily — daily group synchronisation:
// imports the master site list from TVCC then exports the exchange catalogue
// back to the group. Protected with the shared hub secret when configured.
export const Route = createFileRoute("/api/public/v1/sync/daily")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "*",
          },
        }),
      GET: async ({ request }) => run(request),
      POST: async ({ request }) => run(request),
    },
  },
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

async function run(request: Request) {
  const secret = process.env["HN_SERVICE_HUB_SECRET"];
  if (secret) {
    const provided =
      request.headers.get("x-hn-cron-key") ??
      (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (provided !== secret) return json(401, { ok: false, error: "unauthorized" });
  }
  const { runGroupSyncCycle } = await import("@/lib/tvcc-sync.server");
  const result = await runGroupSyncCycle(null);
  return json(200, { ok: true, ...result });
}
