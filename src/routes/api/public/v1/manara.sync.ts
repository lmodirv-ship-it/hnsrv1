import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

// POST /api/public/v1/manara/sync  — نقطة تبادل الشيفرات بين مواقع مجموعة HN
//   { action: "publish" | "pull" | "ack", ... }
// كل الطلبات موقّعة بـ HMAC-SHA256 عبر المفتاح المشترك HN_SERVICE_HUB_SECRET.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-HN-Signature",
  "Access-Control-Max-Age": "86400",
} as const;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });

function verify(raw: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(signature.replace(/^sha256=/, ""));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const SIGNAL_TYPES = ["domain_change", "route_change", "status", "announcement", "asset"];

async function handle(request: Request) {
  const secret = process.env["HN_SERVICE_HUB_SECRET"];
  if (!secret) return json({ ok: false, error: "hub_secret_not_configured" }, 503);

  const raw = await request.text();
  if (!verify(raw, request.headers.get("x-hn-signature"), secret)) {
    return json({ ok: false, error: "invalid_signature" }, 401);
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const action = String(body?.action ?? "");

  if (action === "publish") {
    const source_site = String(body?.source_site ?? "").trim();
    const signal_key = String(body?.signal_key ?? "").trim();
    const signal_type = SIGNAL_TYPES.includes(body?.signal_type) ? body.signal_type : "announcement";
    if (!source_site || !signal_key) return json({ ok: false, error: "missing_fields" }, 400);

    const targets: string[] = Array.isArray(body?.targets)
      ? body.targets.filter((t: unknown) => typeof t === "string").slice(0, 50)
      : [];

    const { data: exp, error } = await supabaseAdmin
      .from("manara_exports")
      .insert({
        source_site,
        signal_type,
        signal_key,
        old_value: body?.old_value ?? null,
        new_value: body?.new_value ?? null,
        payload: body?.payload ?? {},
        targets,
        status: targets.length ? "delivered" : "pending",
        signature: request.headers.get("x-hn-signature"),
      })
      .select("id")
      .single();
    if (error) return json({ ok: false, error: error.message }, 500);

    if (targets.length) {
      await supabaseAdmin.from("manara_imports").insert(
        targets.map((t) => ({
          sender_site: source_site,
          target_site: t,
          export_id: exp.id,
          signal_type,
          signal_key,
          value: body?.new_value ?? null,
          payload: body?.payload ?? {},
        })),
      );
    }
    return json({ ok: true, export_id: exp.id, delivered_to: targets.length });
  }

  if (action === "pull") {
    const site = String(body?.site ?? "").trim();
    if (!site) return json({ ok: false, error: "missing_site" }, 400);
    const { data, error } = await supabaseAdmin
      .from("manara_imports")
      .select("id, sender_site, signal_type, signal_key, value, payload, created_at")
      .eq("target_site", site)
      .eq("process_status", "received")
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, signals: data ?? [] });
  }

  if (action === "ack") {
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.slice(0, 100) : [];
    if (!ids.length) return json({ ok: false, error: "missing_ids" }, 400);
    const { error } = await supabaseAdmin
      .from("manara_imports")
      .update({ process_status: "applied", applied_at: new Date().toISOString() })
      .in("id", ids);
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, applied: ids.length });
  }

  return json({ ok: false, error: "unknown_action" }, 400);
}

export const Route = createFileRoute("/api/public/v1/manara/sync")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => handle(request),
    },
  },
});
