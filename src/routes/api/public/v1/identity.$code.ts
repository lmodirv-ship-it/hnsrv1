import { createFileRoute } from "@tanstack/react-router";

// GET /api/public/v1/identity/<CODE> — public ownership lookup for a group ID.
// Returns only non-sensitive identity fields.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });

export const Route = createFileRoute("/api/public/v1/identity/$code")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ params }) => {
        const code = String(params.code ?? "").trim().toUpperCase();
        if (!/^[A-Z][0-9]{6}$/.test(code)) {
          return json({ ok: false, error: "invalid_code_format" }, 400);
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("group_identifiers")
          .select("code, service_number, service_name, site_url, status, last_signal_at")
          .eq("code", code)
          .maybeSingle();
        if (error) return json({ ok: false, error: "lookup_failed" }, 500);
        if (!data) return json({ ok: false, error: "unknown_code" }, 404);
        return json({
          ok: true,
          identity: data,
          group: "HN",
          owner: "TVCC",
          hub: "https://hnsrv1.lovable.app",
        });
      },
    },
  },
});
