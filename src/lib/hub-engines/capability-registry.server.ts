// Capability Registry — read helpers over site_capabilities.
// SERVER ONLY.

export type RegistryEntry = {
  id: string;
  site_id: string;
  service_id: string;
  task_type: string;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  status: "online" | "degraded" | "offline" | "unknown";
  source: "manifest" | "manual" | "inferred";
  last_probed_at: string | null;
  last_ok_at: string | null;
  metadata: Record<string, unknown>;
  service: {
    id: string;
    name: string;
    slug: string | null;
    endpoint_url: string | null;
    endpoint_path: string | null;
    method: string | null;
    routing_mode: string | null;
    gateway_url: string | null;
  };
  site: {
    id: string;
    slug: string | null;
    name: string | null;
    base_url: string | null;
    metadata: any;
    network_type: string | null;
  };
};

async function selectAll(): Promise<RegistryEntry[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("site_capabilities")
    .select(
      "id, site_id, service_id, task_type, input_schema, output_schema, status, source, last_probed_at, last_ok_at, metadata, " +
        "services!inner(id, name, slug, endpoint_url, endpoint_path, method, routing_mode, gateway_url, is_active, approval_status), " +
        "sites!inner(id, slug, name, base_url, metadata, network_type)",
    );
  return ((data ?? []) as any[])
    .filter((r) => r.services?.is_active !== false && r.services?.approval_status === "approved")
    .map((r) => ({
      id: r.id,
      site_id: r.site_id,
      service_id: r.service_id,
      task_type: r.task_type,
      input_schema: r.input_schema ?? {},
      output_schema: r.output_schema ?? {},
      status: r.status,
      source: r.source,
      last_probed_at: r.last_probed_at,
      last_ok_at: r.last_ok_at,
      metadata: r.metadata ?? {},
      service: {
        id: r.services.id,
        name: r.services.name,
        slug: r.services.slug,
        endpoint_url: r.services.endpoint_url,
        endpoint_path: r.services.endpoint_path,
        method: r.services.method,
        routing_mode: r.services.routing_mode,
        gateway_url: r.services.gateway_url,
      },
      site: {
        id: r.sites.id,
        slug: r.sites.slug,
        name: r.sites.name,
        base_url: r.sites.base_url,
        metadata: r.sites.metadata,
        network_type: r.sites.network_type,
      },
    }));
}

export async function listRegistry(): Promise<RegistryEntry[]> {
  return selectAll();
}

export async function listAvailableTaskTypes(): Promise<
  Array<{ task_type: string; providers: number; sample_input: Record<string, unknown> }>
> {
  const all = await selectAll();
  const map = new Map<string, { count: number; sample: Record<string, unknown> }>();
  for (const e of all) {
    if (e.status === "offline") continue;
    const cur = map.get(e.task_type);
    if (!cur) map.set(e.task_type, { count: 1, sample: e.input_schema });
    else cur.count += 1;
  }
  return [...map.entries()].map(([task_type, v]) => ({
    task_type,
    providers: v.count,
    sample_input: v.sample,
  }));
}

export function pickBestProvider(
  entries: RegistryEntry[],
  taskType: string,
  opts: { internalOnly: boolean },
): RegistryEntry | null {
  const candidates = entries.filter(
    (e) =>
      e.task_type === taskType &&
      (!opts.internalOnly || e.site.network_type === "internal"),
  );
  if (!candidates.length) return null;
  const rank = (s: string) => (s === "online" ? 0 : s === "degraded" ? 1 : s === "unknown" ? 2 : 3);
  candidates.sort((a, b) => rank(a.status) - rank(b.status));
  return candidates[0] ?? null;
}
