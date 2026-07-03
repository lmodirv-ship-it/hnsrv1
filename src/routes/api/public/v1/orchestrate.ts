import { createFileRoute } from "@tanstack/react-router";
import bcrypt from "bcryptjs";

// POST /api/public/v1/orchestrate
// Header: Authorization: Bearer <api_key>  (format: hn_xxxx.<secret>)
// Body:   { intent: string }  OR  { service_id: string, payload?: any }
export const Route = createFileRoute("/api/public/v1/orchestrate")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
        },
      }),
      POST: async ({ request }) => {
        const cors = {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        };
        const respond = (status: number, body: unknown) =>
          new Response(JSON.stringify(body), { status, headers: cors });

        const auth = request.headers.get("authorization") ?? "";
        const token = auth.replace(/^Bearer\s+/i, "").trim();
        if (!token || !token.includes(".")) return respond(401, { error: "Missing API key" });

        const [prefix, secret] = token.split(".");
        if (!prefix || !secret) return respond(401, { error: "Malformed API key" });

        let body: any = {};
        try {
          body = await request.json();
        } catch {
          return respond(400, { error: "Invalid JSON body" });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Lookup key
        const { data: keys, error: kErr } = await supabaseAdmin
          .from("api_keys")
          .select("id, client_id, key_hash, revoked_at, expires_at")
          .eq("key_prefix", prefix)
          .limit(5);
        if (kErr) return respond(500, { error: kErr.message });

        let matchedKey: any = null;
        for (const k of keys ?? []) {
          if (k.revoked_at) continue;
          if (k.expires_at && new Date(k.expires_at) < new Date()) continue;
          if (await bcrypt.compare(secret, k.key_hash)) { matchedKey = k; break; }
        }
        if (!matchedKey) return respond(401, { error: "Invalid API key" });

        // Rate limit: count last-minute requests
        const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
        const { count: recentCount } = await supabaseAdmin
          .from("service_requests")
          .select("id", { count: "exact", head: true })
          .eq("api_key_id", matchedKey.id)
          .gte("created_at", oneMinAgo);

        const { data: client } = await supabaseAdmin
          .from("api_clients")
          .select("rate_limit_per_min, allowed_services")
          .eq("id", matchedKey.client_id)
          .maybeSingle();
        const limit = client?.rate_limit_per_min ?? 60;
        if ((recentCount ?? 0) >= limit) return respond(429, { error: "Rate limit exceeded" });

        const start = Date.now();
        let service: any = null;

        if (body.service_id) {
          const { data } = await supabaseAdmin
            .from("services")
            .select("*, sites(base_url)")
            .eq("id", body.service_id)
            .eq("is_active", true)
            .maybeSingle();
          service = data;
        } else if (body.intent) {
          const terms = String(body.intent).toLowerCase().split(/\s+/).filter((w) => w.length > 2);
          const { data: services } = await supabaseAdmin
            .from("services")
            .select("*, sites(base_url)")
            .eq("is_active", true);
          const scored = (services ?? []).map((s: any) => {
            const hay = [s.name, s.description, s.category, ...(s.tags ?? [])].filter(Boolean).join(" ").toLowerCase();
            let score = 0;
            for (const t of terms) if (hay.includes(t)) score += 1;
            return { s, score };
          });
          scored.sort((a, b) => b.score - a.score);
          service = scored[0]?.score > 0 ? scored[0].s : null;
        } else {
          return respond(400, { error: "Provide `intent` or `service_id`" });
        }

        if (!service) {
          await supabaseAdmin.from("service_requests").insert({
            api_key_id: matchedKey.id, client_id: matchedKey.client_id, service_id: null,
            status_code: 404, latency_ms: Date.now() - start, error: "No matching service",
          });
          return respond(404, { error: "No matching service" });
        }

        if (client?.allowed_services?.length && !client.allowed_services.includes(service.id)) {
          return respond(403, { error: "Service not allowed for this client" });
        }

        // Update key usage
        await supabaseAdmin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", matchedKey.id);

        // Decide routing: HN Service Hub owns this decision.
        // - `direct`     → hit service.endpoint_url (or fall back to sites.base_url + endpoint_path)
        // - `via_tvcc`   → route through TVCC gateway using TVCC_API_URL
        // - `auto`       → prefer gateway_url, else endpoint_url, else site + endpoint_path
        const baseSite = (service.sites?.base_url ?? "").replace(/\/$/, "");
        const directUrl = service.endpoint_url || (baseSite + (service.endpoint_path ?? "/"));
        const tvccBase = process.env.TVCC_API_URL?.replace(/\/+$/, "");

        let routeUrl = directUrl;
        let via: "direct" | "via_tvcc" | "gateway" = "direct";
        if (service.routing_mode === "via_tvcc" && tvccBase) {
          routeUrl = `${tvccBase}/proxy/${service.slug ?? service.id}`;
          via = "via_tvcc";
        } else if (service.routing_mode === "auto" && service.gateway_url) {
          routeUrl = service.gateway_url;
          via = "gateway";
        }

        const latency = Date.now() - start;
        await supabaseAdmin.from("service_requests").insert({
          api_key_id: matchedKey.id,
          client_id: matchedKey.client_id,
          service_id: service.id,
          method: service.method,
          status_code: 200,
          latency_ms: latency,
        });

        return respond(200, {
          routed_to: {
            service_id: service.id,
            name: service.name,
            method: service.method,
            url: routeUrl,
            via,
            routing_mode: service.routing_mode,
            scopes: service.scopes,
          },
          note: "HN Service Hub returned the routing decision. Proxy execution arrives in v2.",
        });
      },
    },
  },
});
