import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type HubKey = "tvcc" | "hn_db" | "hn_cloud" | "hn_core";

function envFor(hub: HubKey) {
  switch (hub) {
    case "tvcc":
      return { url: process.env.TVCC_API_URL, key: process.env.TVCC_API_KEY };
    case "hn_db":
      return { url: process.env.HN_DB_API_URL, key: process.env.HN_DB_API_KEY };
    case "hn_cloud":
      return { url: process.env.HN_CLOUD_API_URL, key: process.env.HN_CLOUD_API_KEY };
    case "hn_core":
      return { url: process.env.HN_CORE_URL, key: process.env.HN_CORE_API_KEY };
  }
}

function hubHeaders(hub: HubKey) {
  const { key } = envFor(hub);
  const hnKey = process.env.HN_API_KEY;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "HN-Service-Hub/1.0",
    "X-Hub-Client": "hn-service-hub",
  };
  if (key) headers["Authorization"] = `Bearer ${key}`;
  if (hnKey) headers["X-HN-API-Key"] = hnKey;
  return headers;
}

async function tryFetch(url: string, init: RequestInit, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    return { ok: res.ok, status: res.status, latency_ms: Date.now() - started };
  } catch (e: any) {
    return { ok: false, status: 0, latency_ms: Date.now() - started, error: e?.message ?? String(e) };
  } finally {
    clearTimeout(to);
  }
}

async function persistStatus(
  ctx: any,
  hub: HubKey,
  result: { ok: boolean; status: number; error?: string },
) {
  await ctx.supabase
    .from("hub_integrations")
    .update({
      last_status: result.ok ? `ok:${result.status}` : `fail:${result.status || "net"}`,
      last_checked_at: new Date().toISOString(),
      last_error: result.ok ? null : (result.error ?? `HTTP ${result.status}`),
    })
    .eq("hub", hub);
}

export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("hub_integrations")
      .select("*")
      .order("hub");
    if (error) throw new Error(error.message);
    const hubs: HubKey[] = ["tvcc", "hn_db", "hn_cloud", "hn_core"];
    return hubs.map((hub) => {
      const row = data?.find((r: any) => r.hub === hub);
      const cfg = envFor(hub);
      return {
        hub,
        base_url: cfg.url ?? null,
        has_key: !!cfg.key,
        enabled: row?.enabled ?? true,
        last_status: row?.last_status ?? null,
        last_checked_at: row?.last_checked_at ?? null,
        last_error: row?.last_error ?? null,
      };
    });
  });

export const testIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ hub: z.enum(["tvcc", "hn_db", "hn_cloud", "hn_core"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { url } = envFor(data.hub);
    if (!url) {
      const result = { ok: false, status: 0, latency_ms: 0, error: "URL not configured" };
      await persistStatus(context, data.hub, result);
      return result;
    }
    const base = url.replace(/\/+$/, "");
    // Try common health endpoints then fall back to root
    for (const path of ["/health", "/api/health", "/status", "/"]) {
      const r = await tryFetch(base + path, { method: "GET", headers: hubHeaders(data.hub) }, 6000);
      if (r.ok || r.status === 401 || r.status === 403) {
        await persistStatus(context, data.hub, r);
        return { ...r, endpoint: base + path };
      }
    }
    const final = { ok: false, status: 0, latency_ms: 0, error: "No reachable endpoint" };
    await persistStatus(context, data.hub, final);
    return final;
  });

async function fetchSitesFromHub(hub: HubKey) {
  const { url } = envFor(hub);
  if (!url) return { ok: false, reason: "not_configured", list: [] as any[], path: "" };
  const base = url.replace(/\/+$/, "");
  const candidates = ["/sites", "/api/sites", "/v1/sites"];
  for (const p of candidates) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(base + p, { headers: hubHeaders(hub), signal: ctrl.signal });
      clearTimeout(to);
      if (res.ok) {
        const payload: any = await res.json().catch(() => null);
        if (payload) {
          const list: any[] = Array.isArray(payload) ? payload : payload.sites ?? payload.data ?? [];
          return { ok: true, list, path: base + p };
        }
      }
    } catch {
      clearTimeout(to);
    }
  }
  return { ok: false, reason: "no_endpoint", list: [] as any[], path: "" };
}

async function upsertSites(ctx: any, hub: HubKey, list: any[]) {
  let inserted = 0;
  let updated = 0;
  for (const s of list) {
    const baseUrl = s.base_url ?? s.url ?? s.domain;
    if (!baseUrl) continue;
    const slug =
      s.slug ??
      String(baseUrl)
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/[^a-z0-9]+/gi, "-")
        .toLowerCase()
        .slice(0, 80);
    const name = s.name ?? s.title ?? slug;
    const category = s.category ?? s.type ?? null;
    const description = s.description ?? null;
    const logo_url = s.logo_url ?? s.logo ?? s.icon ?? null;
    const hubId = s.id ?? s._id ?? null;
    const idCol =
      hub === "tvcc" ? "tvcc_id" : hub === "hn_db" ? "hn_db_id" : hub === "hn_cloud" ? "hn_cloud_id" : null;

    const { data: existing } = await ctx.supabase
      .from("sites")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      const patch: any = { name, base_url: baseUrl, category };
      if (description) patch.description = description;
      if (logo_url) patch.logo_url = logo_url;
      if (idCol && hubId) patch[idCol] = String(hubId);
      await ctx.supabase.from("sites").update(patch).eq("id", existing.id);
      updated++;
    } else {
      const row: any = {
        name,
        slug,
        base_url: baseUrl,
        category,
        description,
        logo_url,
        owner_id: ctx.userId,
      };
      if (idCol && hubId) row[idCol] = String(hubId);
      await ctx.supabase.from("sites").insert(row);
      inserted++;
    }
  }
  return { inserted, updated };
}

// Fetch site catalogue from TVCC and upsert into the local Service Registry.
export const syncSitesFromTvcc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await fetchSitesFromHub("tvcc");
    if (!r.ok) {
      return {
        ok: false,
        fallback: true,
        error: r.reason === "not_configured" ? "TVCC_API_URL not configured" : "TVCC did not return a sites list",
        source: "",
        count: 0,
        inserted: 0,
        updated: 0,
      };
    }
    const { inserted, updated } = await upsertSites(context, "tvcc", r.list);
    return { ok: true, source: r.path, count: r.list.length, inserted, updated };
  });

// Pull sites from every configured hub and upsert them locally.
export const syncSitesFromAllHubs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const hubs: HubKey[] = ["tvcc", "hn_db", "hn_cloud", "hn_core"];
    const results: Array<{
      hub: HubKey;
      ok: boolean;
      count: number;
      inserted: number;
      updated: number;
      reason?: string;
      source?: string;
    }> = [];
    let totalInserted = 0;
    let totalUpdated = 0;
    for (const hub of hubs) {
      const r = await fetchSitesFromHub(hub);
      if (!r.ok) {
        results.push({ hub, ok: false, count: 0, inserted: 0, updated: 0, reason: r.reason });
        continue;
      }
      const { inserted, updated } = await upsertSites(context, hub, r.list);
      totalInserted += inserted;
      totalUpdated += updated;
      results.push({ hub, ok: true, count: r.list.length, inserted, updated, source: r.path });
    }
    return { inserted: totalInserted, updated: totalUpdated, results };
  });

// Register a site with TVCC / HN-DB / HN-Cloud after it is created locally.
export const propagateSiteToHubs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ site_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: site, error } = await context.supabase
      .from("sites")
      .select("*")
      .eq("id", data.site_id)
      .single();
    if (error || !site) throw new Error(error?.message ?? "Site not found");

    const log: any[] = Array.isArray(site.integration_log) ? [...site.integration_log] : [];

    async function post(hub: HubKey, path: string, body: any) {
      const { url } = envFor(hub);
      if (!url) {
        log.push({ hub, ok: false, skipped: true, reason: "not configured", at: new Date().toISOString() });
        return null;
      }
      const r = await tryFetch(url.replace(/\/+$/, "") + path, {
        method: "POST",
        headers: hubHeaders(hub),
        body: JSON.stringify(body),
      });
      log.push({ hub, path, ok: r.ok, status: r.status, at: new Date().toISOString(), error: r.error });
      return r;
    }

    await post("tvcc", "/sites", {
      name: site.name,
      slug: site.slug,
      base_url: site.base_url,
      category: site.category,
      description: site.description,
    });
    await post("hn_db", "/sites", { slug: site.slug, base_url: site.base_url });
    await post("hn_cloud", "/sites", { slug: site.slug, base_url: site.base_url });

    await context.supabase
      .from("sites")
      .update({ integration_log: log })
      .eq("id", site.id);

    return { log };
  });
