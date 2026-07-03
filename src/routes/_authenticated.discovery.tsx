import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { discoverSite, listDiscoveryJobs, saveDiscoveredServices } from "@/lib/discovery.functions";
import { syncSitesFromTvcc } from "@/lib/integrations.functions";
import { useLanguage } from "@/i18n/LanguageProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Compass, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/discovery")({
  component: DiscoveryPage,
});

type DiscoveredService = {
  name: string;
  category: string;
  description: string;
  endpoint_path: string | null;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  api_required: boolean;
  confidence_score: number;
  source: string;
};

type DiscoveryResult = {
  url: string;
  base_url: string;
  meta: { title: string | null; description: string | null; keywords: string[]; image?: string | null };
  headings: string[];
  api_hints: Array<{ path: string; ok: boolean }>;
  sample_links: string[];
  discovered_services: DiscoveredService[];
  overall_confidence: number;
};

function DiscoveryPage() {
  const { t } = useLanguage();
  const list = useServerFn(listDiscoveryJobs);
  const run = useServerFn(discoverSite);
  const save = useServerFn(saveDiscoveredServices);
  const tvccSync = useServerFn(syncSitesFromTvcc);
  const { data: jobs = [], refetch } = useQuery({ queryKey: ["discovery-jobs"], queryFn: () => list() });
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  const mut = useMutation({
    mutationFn: () => run({ data: { url } }),
    onSuccess: (r) => {
      setResult(r.result as DiscoveryResult);
      setJobId(r.job_id);
      const preselect: Record<number, boolean> = {};
      (r.result as DiscoveryResult).discovered_services.forEach((s, i) => {
        preselect[i] = s.confidence_score >= 70;
      });
      setSelected(preselect);
      refetch();
    },
    onError: (e: any) => toast.error(e.message ?? t("somethingWentWrong")),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!result || !jobId) throw new Error("No discovery result");
      const services = result.discovered_services.filter((_, i) => selected[i]);
      if (!services.length) throw new Error("Select at least one service");
      return save({ data: { job_id: jobId, services } });
    },
    onSuccess: (r) => {
      toast.success(`${r.inserted} service(s) queued for approval`);
      setResult(null);
      setJobId(null);
      setSelected({});
      setUrl("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const syncMut = useMutation({
    mutationFn: () => tvccSync(),
    onSuccess: (r) => toast.success(`TVCC: +${r.inserted} / ~${r.updated} of ${r.count}`),
    onError: (e: any) => toast.error(e.message ?? t("somethingWentWrong")),
  });

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Compass className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">{t("discovery")}</h1>
      </div>

      <Card className="p-5 bg-card/60 backdrop-blur border-border/60 space-y-3">
        <div className="flex gap-2">
          <Input placeholder={t("discoverUrl")} value={url} onChange={(e) => setUrl(e.target.value)} type="url" />
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !url}>
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("discover")}
          </Button>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <div className="text-xs text-muted-foreground">Pull the master site list from TVCC</div>
          <Button variant="outline" size="sm" onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
            {syncMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Sync from TVCC
          </Button>
        </div>
      </Card>

      {result && (
        <Card className="p-5 bg-card/60 backdrop-blur border-border/60 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs text-muted-foreground">Discovery result for</div>
              <div className="font-semibold">{result.base_url}</div>
              {result.meta.title && <div className="text-sm mt-1">{result.meta.title}</div>}
              {result.meta.description && <p className="text-xs text-muted-foreground max-w-2xl mt-1">{result.meta.description}</p>}
            </div>
            <div className="text-end">
              <div className="text-xs text-muted-foreground">Overall confidence</div>
              <div className="text-2xl font-bold text-primary">{result.overall_confidence}%</div>
            </div>
          </div>

          {result.meta.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {result.meta.keywords.slice(0, 10).map((k) => (
                <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{k}</span>
              ))}
            </div>
          )}

          {result.api_hints.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">API endpoints detected:</div>
              <div className="flex flex-wrap gap-2">
                {result.api_hints.map((h) => (
                  <span key={h.path} className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">{h.path}</span>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-border/40 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold">Discovered services ({result.discovered_services.length})</h3>
                <p className="text-xs text-muted-foreground">Review, then approve to save. Nothing is saved automatically.</p>
              </div>
              <Button
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending || selectedCount === 0}
                size="sm"
              >
                {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4 me-1" />}
                Save {selectedCount} for approval
              </Button>
            </div>

            {result.discovered_services.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">No service signals detected on this site.</div>
            ) : (
              <div className="space-y-2">
                {result.discovered_services.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border/40">
                    <Checkbox
                      checked={!!selected[i]}
                      onCheckedChange={(v) => setSelected({ ...selected, [i]: !!v })}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-medium">{s.name}</div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">{s.category}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{s.method}</span>
                        <span className="text-[10px] text-muted-foreground">via {s.source}</span>
                      </div>
                      {s.endpoint_path && <div className="text-xs font-mono text-muted-foreground mt-0.5">{s.endpoint_path}</div>}
                      <div className="text-xs text-muted-foreground mt-0.5">{s.description}</div>
                    </div>
                    <div className="text-end shrink-0">
                      <div className="text-[10px] text-muted-foreground">confidence</div>
                      <div className={`text-sm font-bold ${s.confidence_score >= 80 ? "text-emerald-400" : s.confidence_score >= 50 ? "text-amber-400" : "text-red-400"}`}>
                        {s.confidence_score}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      <div>
        <h2 className="font-semibold mb-2">Recent jobs</h2>
        {!jobs.length ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">{t("noData")}</Card>
        ) : (
          <div className="space-y-2">
            {jobs.map((j: any) => (
              <Card key={j.id} className="p-3 bg-card/60 backdrop-blur border-border/60 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{j.url}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(j.created_at).toLocaleString()}
                    {j.result?.discovered_services?.length ? ` • ${j.result.discovered_services.length} services detected` : ""}
                  </div>
                </div>
                {j.result?.overall_confidence != null && (
                  <span className="text-xs text-primary">{j.result.overall_confidence}%</span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded ${j.status === "completed" ? "bg-emerald-500/15 text-emerald-400" : j.status === "failed" ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"}`}>{j.status}</span>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
