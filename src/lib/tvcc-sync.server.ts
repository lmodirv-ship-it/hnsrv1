// Core logic for the HN group site exchange:
//  - import the master site list from TVCC (hn-groupe.org)
//  - export this hub's site list back to the group
// Used by both authenticated server functions and the public/cron routes.

export const TVCC_DEFAULT_URL = "https://www.hn-groupe.org";
export const GROUP_MIRRORS = [
  "https://cour.hnapps.store",
  "https://www.srv.hn-groupe.org",
];

export function tvccBaseUrl() {
  const raw = process.env["TVCC_API_URL"] || TVCC_DEFAULT_URL;
  return raw.replace(/\/+$/, "");
}

function hubHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "HN-Service-Hub/1.0",
    "X-Hub-Client": "hn-service-hub",
  };
  const key = process.env["TVCC_API_KEY"];
  const hnKey = process.env["HN_API_KEY"];
  if (key) headers["Authorization"] = `Bearer ${key}`;
  if (hnKey) headers["X-HN-API-Key"] = hnKey;
  return headers;
}

async function getJson(url: string, timeoutMs = 9000) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: hubHeaders(), signal: ctrl.signal });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("json")) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(to);
  }
}

function slugify(input: string) {
  return String(input)
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80);
}

function normalizeSite(raw: any) {
  if (!raw || typeof raw !== "object") return null;
  const baseUrl: string | undefined =
    raw.base_url ?? raw.url ?? (raw.domain ? `https://${String(raw.domain).replace(/^https?:\/\//, "")}` : undefined);
  if (!baseUrl) return null;
  let normalizedUrl: string;
  try {
    normalizedUrl = new URL(baseUrl).origin;
  } catch {
    return null;
  }
  const slug = typeof raw.slug === "string" && raw.slug ? slugify(raw.slug) : slugify(normalizedUrl);
  if (!slug) return null;
  return {
    slug,
    name: String(raw.name ?? raw.title ?? slug).slice(0, 120),
    base_url: normalizedUrl,
    category: raw.category ?? raw.type ?? null,
    description: raw.description ? String(raw.description).slice(0, 1000) : null,
    logo_url: raw.logo_url ?? raw.logo ?? raw.icon ?? null,
    tvcc_id: raw.id != null ? String(raw.id) : raw._id != null ? String(raw._id) : null,
  };
}

function extractList(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.sites)) return payload.sites;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

/** Fetch the master list of group sites from TVCC (tries common endpoints). */
export async function fetchTvccSites() {
  const base = tvccBaseUrl();
  const paths = [
    "/api/public/v1/sites",
    "/api/v1/sites",
    "/api/sites",
    "/sites.json",
    "/sites",
  ];
  for (const p of paths) {
    const payload = await getJson(base + p);
    const list = extractList(payload)
      .map(normalizeSite)
      .filter(Boolean) as ReturnType<typeof normalizeSite>[];
    if (list.length) return { ok: true as const, source: base + p, list };
  }
  return { ok: false as const, source: base, list: [], error: "TVCC did not return a site list" };
}

/** Canonical key for a site: host without protocol, `www.` or trailing slash. */
export function domainKey(url: string) {
  return String(url ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "")
    .split("/")[0];
}

/** Parse a pasted/uploaded site list: JSON array, {sites:[...]} or CSV. */
export function parseSiteList(text: string) {
  const raw = String(text ?? "").trim();
  if (!raw) return [];
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      return extractList(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  // CSV / one URL per line
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].toLowerCase();
  const hasHeader = /(^|[,;])\s*(url|base_url|domain|site)\b/.test(header);
  const cols = hasHeader ? header.split(/[,;]/).map((c) => c.trim()) : [];
  const idx = (names: string[]) => cols.findIndex((c) => names.includes(c));
  const iUrl = hasHeader ? idx(["url", "base_url", "domain", "site"]) : -1;
  const iName = hasHeader ? idx(["name", "title"]) : -1;
  const iId = hasHeader ? idx(["id", "tvcc_id"]) : -1;
  const iCat = hasHeader ? idx(["category", "type"]) : -1;
  return (hasHeader ? lines.slice(1) : lines).map((line) => {
    const parts = line.split(/[,;]/).map((p) => p.trim().replace(/^"|"$/g, ""));
    if (!hasHeader) return { url: parts[0], name: parts[1] };
    return {
      url: iUrl >= 0 ? parts[iUrl] : parts[0],
      name: iName >= 0 ? parts[iName] : undefined,
      id: iId >= 0 ? parts[iId] : undefined,
      category: iCat >= 0 ? parts[iCat] : undefined,
    };
  });
}

/**
 * Upsert group sites into the local registry.
 * Matching priority: tvcc_id → normalized domain → slug. Never creates a
 * second row for the same domain (www / non-www count as one site).
 */
export async function importSitesIntoRegistry(sites: any[], ownerId: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: current } = await supabaseAdmin
    .from("sites")
    .select("id, slug, base_url, tvcc_id");
  const byDomain = new Map<string, any>();
  const byTvcc = new Map<string, any>();
  const bySlug = new Map<string, any>();
  for (const row of current ?? []) {
    const k = domainKey(row.base_url ?? "");
    if (k && !byDomain.has(k)) byDomain.set(k, row);
    if (row.tvcc_id) byTvcc.set(String(row.tvcc_id), row);
    if (row.slug) bySlug.set(row.slug, row);
  }

  let imported = 0;
  let updated = 0;
  for (const s of sites) {
    if (!s) continue;
    const key = domainKey(s.base_url);
    const existing =
      (s.tvcc_id && byTvcc.get(String(s.tvcc_id))) || (key && byDomain.get(key)) || bySlug.get(s.slug);
    if (existing) {
      const patch: any = { name: s.name, category: s.category };
      if (s.description) patch.description = s.description;
      if (s.logo_url) patch.logo_url = s.logo_url;
      if (s.tvcc_id) patch.tvcc_id = s.tvcc_id;
      await supabaseAdmin.from("sites").update(patch).eq("id", existing.id);
      updated++;
    } else {
      const row: any = {
        name: s.name,
        slug: bySlug.has(s.slug) ? `${s.slug}-${key.slice(0, 8)}` : s.slug,
        base_url: s.base_url,
        category: s.category,
        description: s.description,
        logo_url: s.logo_url,
      };
      if (s.tvcc_id) row.tvcc_id = s.tvcc_id;
      if (ownerId) row.owner_id = ownerId;
      const { data: ins, error } = await supabaseAdmin.from("sites").insert(row).select("id").maybeSingle();
      if (!error) {
        imported++;
        const created = { id: ins?.id, slug: row.slug, base_url: row.base_url, tvcc_id: row.tvcc_id };
        if (key) byDomain.set(key, created);
        bySlug.set(row.slug, created);
        if (row.tvcc_id) byTvcc.set(String(row.tvcc_id), created);
      }
    }
  }
  return { imported, updated };
}

/** Import an arbitrary raw list (from TVCC, a pasted payload or a file). */
export async function importRawSites(rawList: any[], ownerId: string | null) {
  const list = rawList.map(normalizeSite).filter(Boolean) as any[];
  const r = await importSitesIntoRegistry(list, ownerId);
  return { ...r, count: list.length, skipped: rawList.length - list.length };
}

/**
 * Merge duplicate site rows that point at the same domain (www vs non-www).
 * Services and related rows are moved to the canonical site before deleting.
 */
export async function mergeDuplicateSites() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows } = await supabaseAdmin
    .from("sites")
    .select("id, name, slug, base_url, tvcc_id, created_at")
    .order("created_at", { ascending: true });
  const groups = new Map<string, any[]>();
  for (const r of rows ?? []) {
    const k = domainKey(r.base_url ?? "");
    if (!k) continue;
    const arr = groups.get(k) ?? [];
    arr.push(r);
    groups.set(k, arr);
  }
  let merged = 0;
  const details: string[] = [];
  for (const [key, arr] of groups) {
    if (arr.length < 2) continue;
    const keep = arr.find((r) => r.tvcc_id) ?? arr[0];
    const drop = arr.filter((r) => r.id !== keep.id);
    for (const d of drop) {
      await supabaseAdmin.from("services").update({ site_id: keep.id }).eq("site_id", d.id);
      await supabaseAdmin.from("websites_services").update({ site_id: keep.id }).eq("site_id", d.id);
      await supabaseAdmin.from("service_registry").update({ site_id: keep.id }).eq("site_id", d.id);
      await supabaseAdmin.from("sites").delete().eq("id", d.id);
      merged++;
    }
    details.push(`${key} ×${arr.length}`);
  }
  return { merged, groups: details.length, details: details.slice(0, 50) };
}

/** The site list this hub publishes to the group. */
export async function buildExportPayload() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: sites } = await supabaseAdmin
    .from("sites")
    .select("id, name, slug, base_url, category, description, logo_url")
    .order("name");
  const list = sites ?? [];
  const { data: services } = await supabaseAdmin
    .from("services")
    .select("id, site_id, name, category, method, endpoint_path, description")
    .eq("is_active", true);
  const byId = new Map<string, any[]>();
  for (const svc of services ?? []) {
    const arr = byId.get(svc.site_id) ?? [];
    arr.push(svc);
    byId.set(svc.site_id, arr);
  }
  return {
    hub: "hn-service-hub",
    generated_at: new Date().toISOString(),
    mirrors: GROUP_MIRRORS,
    count: list.length,
    sites: list.map((s: any) => ({
      ...s,
      services: (byId.get(s.id) ?? []).map((x: any) => ({
        id: x.id,
        name: x.name,
        category: x.category,
        method: x.method,
        endpoint_path: x.endpoint_path,
        description: x.description,
      })),
    })),
  };
}

/** Push the exchange catalogue back to TVCC. */
export async function exportSitesToTvcc() {
  const base = tvccBaseUrl();
  const payload = await buildExportPayload();
  const paths = ["/api/public/v1/sites/import", "/api/v1/sites/import", "/api/sites/import", "/sites/import"];
  for (const p of paths) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 9000);
    try {
      const res = await fetch(base + p, {
        method: "POST",
        headers: hubHeaders(),
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      clearTimeout(to);
      if (res.ok) return { ok: true as const, target: base + p, exported: payload.count };
    } catch {
      clearTimeout(to);
    }
  }
  return { ok: false as const, target: base, exported: payload.count, error: "TVCC import endpoint unreachable" };
}

async function logRun(row: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("group_sync_runs").insert(row as any);
}

/** Full daily cycle: import from TVCC, then export the exchange catalogue back. */
export async function runGroupSyncCycle(ownerId: string | null = null) {
  const fetched = await fetchTvccSites();
  let imported = 0;
  let updated = 0;
  if (fetched.ok) {
    const r = await importSitesIntoRegistry(fetched.list, ownerId);
    imported = r.imported;
    updated = r.updated;
  }
  await logRun({
    source: fetched.source,
    direction: "import",
    status: fetched.ok ? "success" : "failed",
    imported,
    updated,
    error: fetched.ok ? null : (fetched as any).error,
    detail: { count: fetched.list.length },
  });

  const exp = await exportSitesToTvcc();
  await logRun({
    source: exp.target,
    direction: "export",
    status: exp.ok ? "success" : "failed",
    exported: exp.exported,
    error: exp.ok ? null : (exp as any).error,
    detail: { mirrors: GROUP_MIRRORS },
  });

  return {
    import: { ok: fetched.ok, source: fetched.source, count: fetched.list.length, imported, updated },
    export: { ok: exp.ok, target: exp.target, exported: exp.exported },
  };
}
