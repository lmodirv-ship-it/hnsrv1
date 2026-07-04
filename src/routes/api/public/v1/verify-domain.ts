import { createFileRoute } from "@tanstack/react-router";
import { createHmac } from "crypto";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
} as const;

const DOMAIN_RE =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

function computeToken(domain: string): string {
  const salt = process.env.HN_HUB_VERIFICATION_SALT;
  if (!salt) throw new Error("HN_HUB_VERIFICATION_SALT is not configured");
  return createHmac("sha256", salt)
    .update(`hn-hub:v1:${domain}`)
    .digest("hex")
    .slice(0, 40);
}

function normalizeDomain(input: string | null): string | null {
  if (!input) return null;
  const d = input.trim().toLowerCase();
  if (d.length < 3 || d.length > 253 || !DOMAIN_RE.test(d)) return null;
  return d;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

async function verifyViaDns(domain: string, expected: string) {
  const host = `_hn-hub.${domain}`;
  const res = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=TXT`,
    { headers: { accept: "application/dns-json" } },
  );
  if (!res.ok) throw new Error(`DNS lookup failed: HTTP ${res.status}`);
  const dns = (await res.json()) as { Answer?: Array<{ data: string }> };
  const answers = (dns.Answer ?? []).map((a) =>
    a.data.replace(/^"|"$/g, "").replace(/"\s*"/g, ""),
  );
  return { host, answers, matched: answers.some((v) => v.includes(expected)) };
}

/**
 * Public endpoint for HN mesh sites and TVCC to check/register a domain.
 *
 * GET  /api/public/v1/verify-domain?domain=example.com
 *   → returns the DNS TXT record required for that domain (no side effects).
 *
 * POST /api/public/v1/verify-domain    { "domain": "example.com" }
 *   → performs the DNS lookup and returns { matched: boolean }.
 *
 * No auth required — the salt is server-side and the token is HMAC-bound
 * to the domain, so knowing the record doesn't let a caller claim a
 * domain they don't control.
 */
export const Route = createFileRoute("/api/public/v1/verify-domain")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: CORS_HEADERS }),

      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const domain = normalizeDomain(url.searchParams.get("domain"));
          if (!domain)
            return json(
              { error: "invalid_domain", detail: "provide ?domain=example.com" },
              400,
            );
          const token = computeToken(domain);
          return json({
            domain,
            record: {
              type: "TXT",
              host: `_hn-hub.${domain}`,
              value: `hn-verify=${token}`,
              ttl: 3600,
            },
            verify_url: `${url.origin}/api/public/v1/verify-domain`,
            verify_method: "POST",
          });
        } catch (e) {
          return json({ error: (e as Error).message }, 500);
        }
      },

      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => null)) as {
            domain?: string;
          } | null;
          const domain = normalizeDomain(body?.domain ?? null);
          if (!domain) return json({ error: "invalid_domain" }, 400);

          const expected = `hn-verify=${computeToken(domain)}`;
          const { host, answers, matched } = await verifyViaDns(domain, expected);

          return json({
            domain,
            host,
            expected,
            matched,
            answers,
            verified_at: matched ? new Date().toISOString() : null,
          });
        } catch (e) {
          return json({ error: (e as Error).message }, 500);
        }
      },
    },
  },
});
