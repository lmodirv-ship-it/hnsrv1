import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const siteInput = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/),
  base_url: z.string().trim().url().max(500),
  description: z.string().trim().max(1000).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  logo_url: z.string().trim().url().max(500).optional().nullable(),
});

export const listSites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sites")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listSitesRich = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: sites, error } = await context.supabase
      .from("sites")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const list = sites ?? [];
    if (!list.length) return [];

    const siteIds = list.map((s: any) => s.id);
    const { data: services } = await context.supabase
      .from("services")
      .select("id, site_id, is_active")
      .in("site_id", siteIds);
    const servicesBySite = new Map<string, any[]>();
    for (const s of services ?? []) {
      const arr = servicesBySite.get(s.site_id) ?? [];
      arr.push(s);
      servicesBySite.set(s.site_id, arr);
    }
    const serviceIds = (services ?? []).map((s: any) => s.id);
    let healthByService = new Map<string, any>();
    if (serviceIds.length) {
      const { data: health } = await context.supabase
        .from("service_health")
        .select("service_id, status, latency_ms, checked_at, error")
        .in("service_id", serviceIds)
        .order("checked_at", { ascending: false });
      for (const h of health ?? []) {
        if (!healthByService.has(h.service_id)) healthByService.set(h.service_id, h);
      }
    }

    return list.map((site: any) => {
      const svcs = servicesBySite.get(site.id) ?? [];
      const svcHealth = svcs
        .map((s: any) => healthByService.get(s.id))
        .filter(Boolean);
      const okCount = svcHealth.filter((h: any) => h.status === "ok" || h.status === "healthy").length;
      const total = svcHealth.length;
      const health_score = total ? Math.round((okCount / total) * 100) : null;
      const latest = svcHealth
        .slice()
        .sort((a: any, b: any) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime())[0];
      const api_status =
        total === 0
          ? "no_api"
          : okCount === total
            ? "online"
            : okCount === 0
              ? "offline"
              : "warning";
      const source =
        site.tvcc_id
          ? "TVCC"
          : site.hn_db_id
            ? "HN-DB"
            : site.hn_cloud_id
              ? "HN-Cloud"
              : "Manual";
      const log: any[] = Array.isArray(site.integration_log) ? site.integration_log : [];
      const last_log = log[log.length - 1] ?? null;
      return {
        ...site,
        services_count: svcs.length,
        health_score,
        api_status,
        source,
        last_scan: latest?.checked_at ?? last_log?.at ?? site.discovered_at ?? null,
        last_error: latest?.error ?? last_log?.error ?? null,
      };
    });
  });

export const getSiteBySlug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: site, error } = await context.supabase
      .from("sites")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!site) return null;
    const { data: services } = await context.supabase
      .from("services")
      .select("*")
      .eq("site_id", site.id)
      .order("created_at", { ascending: false });
    return { site, services: services ?? [] };
  });

export const createSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => siteInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("sites")
      .insert({ ...data, owner_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("sites").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
