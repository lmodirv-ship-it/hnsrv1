import { createFileRoute } from "@tanstack/react-router";
import { createHmac } from "crypto";

// POST /api/public/v1/identity/announce
// Any HN-group site embeds its group ID (letter + 6 digits) with a "connect"
// button. Pressing it signals the Hub, which records the signal and forwards
// it to TVCC (the group's center) as ownership proof.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });

const CODE_RE = /^[A-Z][0-9]{6}$/;

async function handle(request: Request) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const code = String(body?.code ?? "").trim().toUpperCase();
  if (!CODE_RE.test(code)) return json({ ok: false, error: "invalid_code_format" }, 400);

  const origin =
    typeof body?.origin === "string" && body.origin.length <= 300
      ? body.origin
      : request.headers.get("origin");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: identifier, error } = await supabaseAdmin
    .from("group_identifiers")
    .select("id, code, service_name, service_number, site_url, status, last_signal_at, site_id")
    .eq("code", code)
    .maybeSingle();

  if (error) return json({ ok: false, error: "lookup_failed" }, 500);
  if (!identifier) return json({ ok: false, error: "unknown_code" }, 404);
  if (identifier.status === "revoked") return json({ ok: false, error: "revoked" }, 403);

  // Simple per-code rate limit: one signal every 10 seconds.
  if (
    identifier.last_signal_at &&
    Date.now() - new Date(identifier.last_signal_at).getTime() < 10_000
  ) {
    return json({ ok: true, code, status: identifier.status, throttled: true });
  }

  const payload = {
    type: "hn.group.identity.announce",
    code: identifier.code,
    service_number: identifier.service_number,
    service_name: identifier.service_name,
    site_url: identifier.site_url,
    origin,
    hub: "hn-service-hub",
    announced_at: new Date().toISOString(),
  };

  let tvccStatus = "tvcc_unconfigured";
  let forwarded = false;
  let tvccResponse: Record<string, unknown> = {};

  const tvccUrl = process.env["TVCC_API_URL"];
  if (tvccUrl) {
    try {
      const raw = JSON.stringify(payload);
      const secret = process.env["HN_HUB_VERIFICATION_SALT"] ?? "";
      const signature = secret ? createHmac("sha256", secret).update(raw).digest("hex") : "";
      const res = await fetch(`${tvccUrl.replace(/\/+$/, "")}/api/public/hn/announce`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Hn-Signature": signature,
          "X-Hn-Source": "hn-service-hub",
        },
        body: raw,
      });
      forwarded = res.ok;
      tvccStatus = res.ok ? `ok_${res.status}` : `error_${res.status}`;
      tvccResponse = { status: res.status, body: (await res.text()).slice(0, 500) };
    } catch (e) {
      tvccStatus = "network_error";
      tvccResponse = { message: e instanceof Error ? e.message : "unknown" };
    }
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("group_identifiers")
    .update({
      status: "connected",
      last_signal_at: now,
      last_tvcc_status: tvccStatus,
      last_tvcc_response: tvccResponse as any,
    })
    .eq("id", identifier.id);

  await supabaseAdmin.from("group_identifier_signals").insert({
    identifier_id: identifier.id,
    origin,
    user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    forwarded_to_tvcc: forwarded,
    tvcc_status: tvccStatus,
    payload: payload as any,
  });

  return json({
    ok: true,
    code: identifier.code,
    service_name: identifier.service_name,
    status: "connected",
    tvcc: { forwarded, status: tvccStatus },
    announced_at: now,
  });
}

export const Route = createFileRoute("/api/public/v1/identity/announce")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => handle(request),
    },
  },
});
