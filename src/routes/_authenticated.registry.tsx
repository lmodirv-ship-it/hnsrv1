import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Radar,
  RefreshCw,
  FileJson,
  Circle,
  Search,
} from "lucide-react";
import {
  listRegistrySites,
  listCapabilities,
  listDiscoveryRuns,
  runSiteDiscovery,
  previewSiteManifest,
  listAvailableTaskTypesFn,
  seedRegistryFromServices,
} from "@/lib/registry.functions";

export const Route = createFileRoute("/_authenticated/registry")({
  component: RegistryPage,
});

type SiteRow = {
  id: string; name: string; slug: string | null; base_url: string | null;
  manifest_path: string; network_type: string; 
};

type CapRow = {
  id: string;
  task_type: string;
  status: "online" | "degraded" | "offline" | "unknown";
  source: string;
  last_probed_at: string | null;
  last_ok_at: string | null;
  probe_error: string | null;
  input_schema: any;
  output_schema: any;
  services: { id: string; name: string; slug: string | null } | null;
  sites: { id: string; name: string; slug: string | null } | null;
};

function statusDot(s: string) {
  const map: Record<string, string> = {
    online: "text-green-500",
    degraded: "text-amber-500",
    offline: "text-red-500",
    unknown: "text-muted-foreground",
  };
  return <Circle className={"h-2.5 w-2.5 fill-current " + (map[s] ?? "text-muted-foreground")} />;
}

function RegistryPage() {
  const qc = useQueryClient();
  const sitesFn = useServerFn(listRegistrySites);
  const capsFn = useServerFn(listCapabilities);
  const runsFn = useServerFn(listDiscoveryRuns);
  const discoverFn = useServerFn(runSiteDiscovery);
  const previewFn = useServerFn(previewSiteManifest);
  const typesFn = useServerFn(listAvailableTaskTypesFn);

  const { data: sites = [] } = useQuery({ queryKey: ["registry-sites"], queryFn: () => sitesFn() as Promise<SiteRow[]> });
  const { data: caps = [] } = useQuery({ queryKey: ["registry-caps"], queryFn: () => capsFn() as Promise<CapRow[]>, refetchInterval: 5000 });
  const { data: runs = [] } = useQuery({ queryKey: ["registry-runs"], queryFn: () => runsFn(), refetchInterval: 5000 });
  const { data: types = [] } = useQuery({ queryKey: ["registry-types"], queryFn: () => typesFn() });

  const [manifestFor, setManifestFor] = useState<string | null>(null);
  const [manifest, setManifest] = useState<any>(null);
  const [filter, setFilter] = useState("");

  const runMut = useMutation({
    mutationFn: (siteId: string | null) => discoverFn({ data: { site_id: siteId } }),
    onSuccess: (r: any) => {
      toast.success(`Discovery done — ${r.services_found ?? 0} services, ${r.capabilities_found ?? 0} capabilities`);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(String(e?.message ?? e)),
  });

  const previewMut = useMutation({
    mutationFn: (siteId: string) => previewFn({ data: { site_id: siteId } }),
    onSuccess: (r: any, siteId) => {
      setManifestFor(siteId);
      setManifest(r);
    },
    onError: (e: any) => toast.error(String(e?.message ?? e)),
  });

  const filteredCaps = caps.filter((c) => {
    const f = filter.trim().toLowerCase();
    if (!f) return true;
    return (
      c.task_type.toLowerCase().includes(f) ||
      c.services?.name?.toLowerCase().includes(f) ||
      c.sites?.name?.toLowerCase().includes(f)
    );
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Radar className="h-6 w-6 text-primary" />
            Site Registry
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Site Inventory → Service Discovery → Capability Registry. The Task Planner and Dispatcher read from here.
          </p>
        </div>
        <Button
          onClick={() => runMut.mutate(null)}
          disabled={runMut.isPending}
          size="lg"
          className="bg-gradient-to-r from-primary to-primary/70 shadow-lg"
        >
          <RefreshCw className={"h-4 w-4 mr-2 " + (runMut.isPending ? "animate-spin" : "")} />
          {runMut.isPending ? "Discovering…" : `Discover All Sites (${sites.length})`}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground self-center mr-1">Available task types:</span>
        {types.length === 0 && (
          <Badge variant="outline" className="text-xs">none yet — run discovery</Badge>
        )}
        {types.map((t: any) => (
          <Badge key={t.task_type} variant="secondary" className="text-xs">
            {t.task_type} · {t.providers}
          </Badge>
        ))}
      </div>

      <Tabs defaultValue="sites">
        <TabsList>
          <TabsTrigger value="sites">Sites ({sites.length})</TabsTrigger>
          <TabsTrigger value="registry">Registry ({caps.length})</TabsTrigger>
          <TabsTrigger value="runs">Discovery runs</TabsTrigger>
        </TabsList>

        <TabsContent value="sites" className="space-y-2">
          {sites.map((s) => (
            <Card key={s.id} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {s.base_url}{s.manifest_path}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => previewMut.mutate(s.id)} disabled={previewMut.isPending}>
                  <FileJson className="h-4 w-4 mr-1" /> Manifest
                </Button>
                <Button size="sm" onClick={() => runMut.mutate(s.id)} disabled={runMut.isPending}>
                  <RefreshCw className={"h-4 w-4 mr-1 " + (runMut.isPending ? "animate-spin" : "")} />
                  Refresh
                </Button>
              </div>
            </Card>
          ))}
          {manifest && manifestFor && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-sm">Manifest preview</div>
                <Button variant="ghost" size="sm" onClick={() => { setManifest(null); setManifestFor(null); }}>Close</Button>
              </div>
              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-96">
                {JSON.stringify(manifest, null, 2)}
              </pre>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="registry" className="space-y-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter by task type, service, or site"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-9"
            />
          </div>
          <Card className="divide-y">
            {filteredCaps.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">No capabilities registered yet.</div>
            )}
            {filteredCaps.map((c) => (
              <div key={c.id} className="p-3 flex items-center gap-3 text-sm">
                {statusDot(c.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono">{c.task_type}</span>
                    <span className="text-muted-foreground">·</span>
                    <span>{c.sites?.name ?? "?"}</span>
                    <span className="text-muted-foreground">/</span>
                    <span>{c.services?.name ?? "?"}</span>
                    <Badge variant="outline" className="text-xs">{c.source}</Badge>
                    <Badge className="text-xs" variant={c.status === "online" ? "default" : "secondary"}>
                      {c.status}
                    </Badge>
                  </div>
                  {c.probe_error && (
                    <div className="text-xs text-red-600 mt-1">{c.probe_error}</div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  {c.last_probed_at ? new Date(c.last_probed_at).toLocaleString() : "—"}
                </div>
              </div>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="runs" className="space-y-2">
          {runs.length === 0 && (
            <p className="text-sm text-muted-foreground">No discovery runs yet.</p>
          )}
          {runs.map((r: any) => (
            <Card key={r.id} className="p-3 flex items-center justify-between text-sm">
              <div>
                <div className="font-medium">
                  {r.site_id ? "Single site" : "All sites"} · {r.status}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.started_at).toLocaleString()}
                  {r.finished_at ? ` → ${new Date(r.finished_at).toLocaleString()}` : ""}
                </div>
              </div>
              <div className="flex gap-3 text-xs">
                <span>services: {r.services_found}</span>
                <span>capabilities: {r.capabilities_found}</span>
                <span className={r.errors_count > 0 ? "text-red-600" : ""}>errors: {r.errors_count}</span>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
