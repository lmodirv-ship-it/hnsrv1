import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createHmac } from "crypto";
import { z } from "zod";

const domainInput = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(253)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/, "invalid domain"),
});

function computeToken(domain: string): string {
  const salt = process.env.HN_HUB_VERIFICATION_SALT;
  if (!salt) throw new Error("HN_HUB_VERIFICATION_SALT is not configured");
  return createHmac("sha256", salt).update(`hn-hub:v1:${domain}`).digest("hex").slice(0, 40);
}

/**
 * Returns the DNS TXT record the user must add to prove ownership of a domain
 * and register it as part of the HN mesh under TVCC.
 *
 * Deterministic: same domain always yields the same token (until the salt rotates),
 * so no pre-registration is required.
 */
export const getDomainVerificationRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => domainInput.parse(d))
  .handler(async ({ data }) => {
    const token = computeToken(data.domain);
    return {
      domain: data.domain,
      record: {
        type: "TXT",
        host: `_hn-hub.${data.domain}`,
        value: `hn-verify=${token}`,
        ttl: 3600,
      },
      instructions:
        "أضف هذا السجل في إعدادات DNS للنطاق ثم اضغط تحقّق. يمكنك حذفه بعد نجاح التحقق.",
    };
  });

/**
 * Verifies the DNS TXT record via DNS-over-HTTPS (Cloudflare).
 * On success, marks the matching site row (by base_url host) as verified.
 */
export const verifyDomainRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => domainInput.parse(d))
  .handler(async ({ data, context }) => {
    const expected = `hn-verify=${computeToken(data.domain)}`;
    const host = `_hn-hub.${data.domain}`;

    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=TXT`,
      { headers: { accept: "application/dns-json" } },
    );
    if (!res.ok) throw new Error(`DNS lookup failed: HTTP ${res.status}`);
    const dns = (await res.json()) as { Answer?: Array<{ data: string }> };
    const answers = (dns.Answer ?? []).map((a) => a.data.replace(/^"|"$/g, "").replace(/"\s*"/g, ""));
    const matched = answers.some((v) => v.includes(expected));

    if (matched) {
      // Best-effort: mark matching site verified if one exists whose base_url host equals this domain.
      const { data: sites } = await context.supabase
        .from("sites")
        .select("id, base_url, metadata");
      const now = new Date().toISOString();
      for (const s of sites ?? []) {
        try {
          const u = new URL(s.base_url ?? "");
          if (u.hostname.toLowerCase() === data.domain) {
            await context.supabase
              .from("sites")
              .update({
                metadata: { ...(s.metadata as object ?? {}), dns_verified_at: now, dns_domain: data.domain },
              })
              .eq("id", s.id);
          }
        } catch {
          /* ignore invalid urls */
        }
      }
    }

    return {
      domain: data.domain,
      host,
      expected,
      matched,
      answers,
    };
  });
