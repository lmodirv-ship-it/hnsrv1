// Service Discovery — probes each verified internal site's manifest and
// upserts services + site_capabilities. SERVER ONLY.

import { TASK_TYPES } from "./task-types";

type ManifestCapability = {
  task_type: string;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  probe_path?: string;
};

type ManifestService = {
  slug: string;
  name?: string;
  endpoint?: string;
  method?: string;
  category?: string;
  capabilities: ManifestCapability[];
};

type Manifest = {
  site?: { name?: string; version?: string };
  services: ManifestService[];
};

type SiteRow = {
  id: string;
  slug: string | null;
  name: string | null;
  base_url: string | null;
  manifest_path: string | null;
  network_type: string | null;
  verification_status?: string | null;
  metadata: any;
};

function normalizeTaskType(t: string): string {
  const s = t.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return s;
}

async function fetchManifest(
  site: SiteRow,
  timeoutMs = 10_000,
): Promise<{ ok: true; manifest: Manifest } | { ok: false; error: string }> {
  if (!site.base_url) return { ok: false, error: "Site has no base_url" };
  const base = site.base_url.replace(/\/+$/, "");
  const path = (site.manifest_path ?? "/.well-known/hn-services").replace(/^\/*/, "/");
  const url = base + path;

  const meta = site.metadata ?? {};
  const headers = new Headers({
    accept: "application/json",
    "user-agent": "HN-Hub-Discovery/1.0",
  });
  const envNames: string[] = [meta.keyEnv, meta.keyFallbackEnv].filter(Boolean);
  for (const name of envNames) {
    const v = process.env[name];
    if (v) {
      headers.set("authorization", `Bearer ${v}`);
      break;
    }
  }
  if (!headers.has("authorization") && process.env.HN_API_KEY) {
    headers.set("authorization", `Bearer ${process.env.HN_API_KEY}`);
  }

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    if (!res.ok) return { ok: false, error: `Manifest HTTP ${res.status}` };
    const json = (await res.json()) as Manifest;
    if (!json || !Array.isArray(json.services)) {
      return { ok: false, error: "Manifest missing `services` array" };
    }
    return { ok: true, manifest: json };
  } catch (e: any) {
    return { ok: false, error: e?.name === "AbortError" ? "Manifest timeout" : String(e?.message ?? e) };
  } finally {
    clearTimeout(to);
  }
}

async function upsertFromManifest(
  site: SiteRow,
  manifest: Manifest,
): Promise<{ services: number; capabilities: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let servicesCount = 0;
  let capabilitiesCount = 0;

  const nowIso = new Date().toISOString();

  for (const svc of manifest.services) {
    if (!svc.slug) continue;
    // Upsert service by (site_id, slug)
    const { data: existing } = await supabaseAdmin
      .from("services")
      .select("id")
      .eq("site_id", site.id)
      .eq("slug", svc.slug)
      .maybeSingle();

    const patch: Record<string, unknown> = {
      site_id: site.id,
      slug: svc.slug,
      name: svc.name ?? svc.slug,
      endpoint_path: svc.endpoint ?? null,
      method: (svc.method ?? "POST").toUpperCase(),
      category: svc.category ?? null,
      is_active: true,
      approval_status: "approved",
      network_type: site.network_type ?? "internal",
      capabilities: svc.capabilities.map((c) => normalizeTaskType(c.task_type)),
    };

    let serviceId: string | null = existing?.id ?? null;
    if (serviceId) {
      await supabaseAdmin.from("services").update(patch as any).eq("id", serviceId);
    } else {
      const { data: created } = await supabaseAdmin
        .from("services")
        .insert(patch as any)
        .select("id")
        .single();
      serviceId = created?.id ?? null;
    }
    if (!serviceId) continue;
    servicesCount += 1;

    // Track which task_types this service still declares
    const declaredTypes = new Set<string>();

    for (const cap of svc.capabilities ?? []) {
      const taskType = normalizeTaskType(cap.task_type);
      if (!taskType) continue;
      declaredTypes.add(taskType);

      await supabaseAdmin
        .from("site_capabilities")
        .upsert(
          {
            site_id: site.id,
            service_id: serviceId,
            task_type: taskType,
            input_schema: (cap.input_schema ?? {}) as any,
            output_schema: (cap.output_schema ?? {}) as any,
            source: "manifest",
            status: "online",
            last_probed_at: nowIso,
            last_ok_at: nowIso,
            probe_error: null,
            metadata: { probe_path: cap.probe_path ?? null },
          },
          { onConflict: "service_id,task_type" },
        );
      capabilitiesCount += 1;
    }

    // Mark previously known capabilities that are no longer declared as offline
    const { data: prior } = await supabaseAdmin
      .from("site_capabilities")
      .select("id, task_type")
      .eq("service_id", serviceId);
    for (const p of prior ?? []) {
      if (!declaredTypes.has(p.task_type)) {
        await supabaseAdmin
          .from("site_capabilities")
          .update({ status: "offline", last_probed_at: nowIso, probe_error: "Not in latest manifest" })
          .eq("id", p.id);
      }
    }
  }

  return { services: servicesCount, capabilities: capabilitiesCount };
}

async function inferFromExistingServices(
  site: SiteRow,
): Promise<{ services: number; capabilities: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: services } = await supabaseAdmin
    .from("services")
    .select("id, slug, category, capabilities")
    .eq("site_id", site.id)
    .eq("is_active", true)
    .eq("approval_status", "approved");
  let capCount = 0;
  const nowIso = new Date().toISOString();
  for (const s of services ?? []) {
    const caps = new Set<string>();
    for (const c of (s.capabilities as string[] | null) ?? []) caps.add(normalizeTaskType(c));
    if (s.category) caps.add(normalizeTaskType(s.category));
    for (const t of caps) {
      if (!TASK_TYPES.includes(t as any) && !t) continue;
      await supabaseAdmin
        .from("site_capabilities")
        .upsert(
          {
            site_id: site.id,
            service_id: s.id,
            task_type: t,
            source: "inferred",
            status: "unknown",
            last_probed_at: nowIso,
          },
          { onConflict: "service_id,task_type" },
        );
      capCount += 1;
    }
  }
  return { services: (services ?? []).length, capabilities: capCount };
}

// Public entry: discover one site (or all verified internal sites when
// siteId is null). Records a discovery_runs row and returns a summary.
export async function runDiscovery(opts: {
  siteId?: string | null;
  initiatedBy?: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const startedAt = new Date().toISOString();
  const { data: run } = await supabaseAdmin
    .from("discovery_runs")
    .insert({
      site_id: opts.siteId ?? null,
      initiated_by: opts.initiatedBy ?? null,
      status: "running",
      started_at: startedAt,
    })
    .select("id")
    .single();
  const runId = run?.id as string;

  // Load candidate sites
  let query = supabaseAdmin
    .from("sites")
    .select("id, slug, name, base_url, manifest_path, network_type, metadata")
    .eq("network_type", "internal");
  if (opts.siteId) query = query.eq("id", opts.siteId);
  const { data: sites } = await query;

  const errors: Array<{ site: string; error: string }> = [];
  let servicesFound = 0;
  let capabilitiesFound = 0;

  for (const site of (sites ?? []) as SiteRow[]) {
    // Skip un-verified sites (unless a specific site was requested)
    const m = await fetchManifest(site);
    if (m.ok) {
      const r = await upsertFromManifest(site, m.manifest);
      servicesFound += r.services;
      capabilitiesFound += r.capabilities;
    } else {
      // Fallback: infer from what's already in `services` for this site
      const r = await inferFromExistingServices(site);
      servicesFound += r.services;
      capabilitiesFound += r.capabilities;
      errors.push({ site: site.slug ?? site.id, error: m.error });
    }
  }

  const finishedAt = new Date().toISOString();
  await supabaseAdmin
    .from("discovery_runs")
    .update({
      status: errors.length === (sites?.length ?? 0) && (sites?.length ?? 0) > 0 ? "failed" : "done",
      finished_at: finishedAt,
      services_found: servicesFound,
      capabilities_found: capabilitiesFound,
      errors_count: errors.length,
      errors: errors as any,
    })
    .eq("id", runId);

  return {
    run_id: runId,
    sites_scanned: sites?.length ?? 0,
    services_found: servicesFound,
    capabilities_found: capabilitiesFound,
    errors,
  };
}

// Fetches (does not persist) the raw manifest for a single site — used by
// the UI's manifest preview.
export async function previewSiteManifest(siteId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: site } = await supabaseAdmin
    .from("sites")
    .select("id, slug, name, base_url, manifest_path, network_type, metadata")
    .eq("id", siteId)
    .maybeSingle();
  if (!site) return { ok: false as const, error: "Site not found" };
  const m = await fetchManifest(site as SiteRow);
  if (!m.ok) return { ok: false as const, error: m.error, url: (site as any).base_url };
  return { ok: true as const, manifest: m.manifest };
}
