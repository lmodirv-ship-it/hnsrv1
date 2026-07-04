// Shared upstream safety helpers.
// Prevents (a) SSRF via user-controlled endpoint_url and (b) exfiltration of
// arbitrary server secrets via user-controlled sites.metadata.keyEnv.

// Env var names that must NEVER be exposed as an outbound bearer, even if a
// site owner puts them in metadata.keyEnv. Anything containing these tokens
// is rejected.
const KEYENV_BLOCKLIST = [
  "SUPABASE",
  "SERVICE_ROLE",
  "SERVICE_KEY",
  "SECRET",
  "LOVABLE_API_KEY",
  "PGPASSWORD",
  "DB_URL",
  "DATABASE_URL",
  "SESSION",
  "JWT",
  "SIGNING",
  "MIRROR_SECRET",
];

// Only allow env names matching this shape — uppercase HN_/TVCC_ prefixed keys.
const KEYENV_ALLOW_RE = /^(HN|TVCC)_[A-Z0-9_]{1,60}_(KEY|TOKEN)$/;

export function isSafeKeyEnvName(name: unknown): name is string {
  if (typeof name !== "string" || !name) return false;
  if (name.length > 80) return false;
  const upper = name.toUpperCase();
  if (KEYENV_BLOCKLIST.some((b) => upper.includes(b))) return false;
  return KEYENV_ALLOW_RE.test(name);
}

// Blocked host patterns — private / loopback / link-local / cloud metadata.
const BLOCKED_HOST_RE =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|::1|fe80:|fc00:|fd00:|metadata\.google\.internal)$/i;

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

/**
 * Validates an outbound upstream URL and returns the parsed URL, or throws.
 * - protocol must be https (http only permitted when SSRF_ALLOW_HTTP=1, for local dev)
 * - host may not be a loopback / private / link-local / metadata address
 * - .internal / .local suffixes are blocked
 * - only ports 443, 80, 8080, 8443 permitted
 */
export function assertSafeUpstreamUrl(raw: string): URL {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error("invalid upstream url"); }

  const allowHttp = process.env.SSRF_ALLOW_HTTP === "1";
  if (u.protocol !== "https:" && !(allowHttp && u.protocol === "http:")) {
    throw new Error(`upstream protocol not allowed: ${u.protocol}`);
  }

  const host = u.hostname.toLowerCase();
  if (BLOCKED_HOST_RE.test(host)) throw new Error(`upstream host blocked: ${host}`);
  if (host.endsWith(".internal") || host.endsWith(".local")) {
    throw new Error(`upstream host blocked: ${host}`);
  }
  if (isPrivateIPv4(host)) throw new Error(`upstream host blocked (private ip): ${host}`);

  if (u.port && !["80", "443", "8080", "8443"].includes(u.port)) {
    throw new Error(`upstream port not allowed: ${u.port}`);
  }
  if (u.username || u.password) throw new Error("credentials in url not allowed");

  return u;
}

/** Returns true if the URL passes assertSafeUpstreamUrl, false otherwise. */
export function isSafeUpstreamUrl(raw: string): boolean {
  try { assertSafeUpstreamUrl(raw); return true; } catch { return false; }
}
