import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NetworkDependency = {
  kind: "system" | "service";
  system?: string;
  service_id?: string;
  service_name?: string;
  site_name?: string;
  site_slug?: string;
  confidence: number;
  source: string;
};

export type NetworkService = {
  id: string;
  name: string;
  category: string | null;
  method: string;
  endpoint_path: string | null;
  approval_status: string;
  is_active: boolean;
  dependencies: NetworkDependency[];
  consumer_sites: Array<{ id: string; name: string; slug: string }>;
  consumer_count: number;
};

export type NetworkSite = {
  id: string;
  name: string;
  slug: string;
  base_url: string;
  logo_url: string | null;
  category: string | null;
  services: NetworkService[];
};

export const getServiceNetwork = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NetworkSite[]> => {
    const { data: sites, error: siteErr } = await context.supabase
      .from("sites")
      .select("id, name, slug, base_url, logo_url, category")
      .order("name", { ascending: true });
    if (siteErr) throw new Error(siteErr.message);

    const { data: services } = await context.supabase
      .from("services")
      .select("id, site_id, name, category, method, endpoint_path, approval_status, is_active")
      .order("name", { ascending: true });

    const svcList = services ?? [];
    const svcIds = svcList.map((s: any) => s.id);

    let deps: any[] = [];
    if (svcIds.length) {
      const { data } = await context.supabase
        .from("service_dependencies" as any)
        .select("service_id, depends_on_service_id, depends_on_system, consumer_site_id, relation_type, confidence, source")
        .in("service_id", svcIds);
      deps = data ?? [];
    }

    // Lookup helpers
    const siteById = new Map<string, any>();
    for (const s of sites ?? []) siteById.set(s.id, s);
    const svcById = new Map<string, any>();
    for (const s of svcList) svcById.set(s.id, s);

    const depsByService = new Map<string, NetworkDependency[]>();
    const consumersByService = new Map<string, Array<{ id: string; name: string; slug: string }>>();

    for (const d of deps) {
      if (d.relation_type === "consumes" && d.consumer_site_id) {
        const site = siteById.get(d.consumer_site_id);
        if (!site) continue;
        const arr = consumersByService.get(d.service_id) ?? [];
        if (!arr.find((x) => x.id === site.id)) {
          arr.push({ id: site.id, name: site.name, slug: site.slug });
        }
        consumersByService.set(d.service_id, arr);
        continue;
      }
      const arr = depsByService.get(d.service_id) ?? [];
      if (d.depends_on_system) {
        arr.push({
          kind: "system",
          system: d.depends_on_system,
          confidence: d.confidence,
          source: d.source,
        });
      } else if (d.depends_on_service_id) {
        const target = svcById.get(d.depends_on_service_id);
        const targetSite = target ? siteById.get(target.site_id) : null;
        arr.push({
          kind: "service",
          service_id: d.depends_on_service_id,
          service_name: target?.name,
          site_name: targetSite?.name,
          site_slug: targetSite?.slug,
          confidence: d.confidence,
          source: d.source,
        });
      }
      depsByService.set(d.service_id, arr);
    }

    return (sites ?? []).map((site: any) => ({
      id: site.id,
      name: site.name,
      slug: site.slug,
      base_url: site.base_url,
      logo_url: site.logo_url,
      category: site.category,
      services: svcList
        .filter((s: any) => s.site_id === site.id)
        .map((s: any) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          method: s.method,
          endpoint_path: s.endpoint_path,
          approval_status: s.approval_status,
          is_active: s.is_active,
          dependencies: depsByService.get(s.id) ?? [],
          consumer_sites: consumersByService.get(s.id) ?? [],
          consumer_count: (consumersByService.get(s.id) ?? []).length,
        })),
    }));
  });
