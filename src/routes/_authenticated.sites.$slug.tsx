import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSiteBySlug } from "@/lib/sites.functions";
import { approveService, rejectService, deleteService } from "@/lib/services.functions";
import { discoverSite, saveDiscoveredServices } from "@/lib/discovery.functions";
import { checkServiceHealth } from "@/lib/monitoring.functions";
import { useLanguage } from "@/i18n/LanguageProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Boxes,
  Trash2,
  Activity,
  ExternalLink,
  Sparkles,
  Loader2,
  ShieldCheck,
  Check,
  X,
  Server,
  Database,
  Cloud,
  Cpu,
  Brain,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sites/$slug")({
  component: SiteDetail,
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
  base_url: string;
  meta: { title: string | null; description: string | null; keywords: string[] };
  headings: string[];
  api_hints: Array<{ path: string; ok: boolean }>;
  sample_links: string[];
  frameworks?: string[];
  systems?: string[];
  discovered_services: DiscoveredService[];
  overall_confidence: number;
};

const SYSTEM_ICON: Record<string, typeof Server> = {
  "hn-db": Database,
  "hn-cloud": Cloud,
  tvcc: Server,
  "hn-core": Cpu,
  "hn-ai": Brain,
};

function SystemBadge({ system }: { system: string }) {
  const Icon = SYSTEM_ICON[system] ?? Server;
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-primary/10 text-primary">
      <Icon className="h-3 w-3" />
      {system}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "approved" ? "bg-emerald-500/15 text-emerald-400"
      : status === "pending" ? "bg-amber-500/15 text-amber-400"
      : "bg-red-500/15 text-red-400";
  return <span className={`text-[10px] px-2 py-0.5 rounded ${cls}`}>{status}</span>;
}

function SiteDetail() {
  const { slug } = Route.useParams();
  const { t, dir } = useLanguage();
  const qc = useQueryClient();

  const fnGet = useServerFn(getSiteBySlug);
  const fnAnalyze = useServerFn(discoverSite);
  const fnSave = useServerFn(saveDiscoveredServices);
  const fnApprove = useServerFn(approveService);
  const fnReject = useServerFn(rejectService);
  const fnDelete = useServerFn(deleteService);
  const fnHealth = useServerFn(checkServiceHealth);

  const { data } = useQuery({ queryKey: ["site", slug], queryFn: () => fnGet({ data: { slug } }) });

  const [report, setReport] = useState<DiscoveryResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  const invalidate = () => qc.invalidateQueries({ queryKey: ["site", slug] });

  const analyze = useMutation({
    mutationFn: () => fnAnalyze({ data: { url: data!.site.base_url } }),
    onSuccess: (r) => {
      const res = r.result as DiscoveryResult;
      setReport(res);
      setJobId(r.job_id);
      const pre: Record<number, boolean> = {};
      res.discovered_services.forEach((s, i) => { pre[i] = s.confidence_score >= 70; });
      setSelected(pre);
      toast.success(`${res.discovered_services.length} services detected`);
    },
    onError: (e: any) => toast.error(e.message ?? t("somethingWentWrong")),
  });

  const saveMut = useMutation({
    mutationFn: () => {
      if (!report || !jobId) throw new Error("No report");
      const services = report.discovered_services.filter((_, i) => selected[i]);
      if (!services.length) throw new Error("Select services");
      return fnSave({ data: { job_id: jobId, site_id: data!.site.id, services } });
    },
    onSuccess: (r) => {
      toast.success(`${r.inserted} queued for approval`);
      setReport(null); setJobId(null); setSelected({});
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: (id: string) => fnApprove({ data: { id } }),
    onSuccess: () => { toast.success(t("saved")); invalidate(); },
  });
  const reject = useMutation({
    mutationFn: (id: string) => fnReject({ data: { id } }),
    onSuccess: () => { toast.success(t("saved")); invalidate(); },
  });
  const del = useMutation({
    mutationFn: (id: string) => fnDelete({ data: { id } }),
    onSuccess: () => { toast.success(t("saved")); invalidate(); },
  });
  const health = useMutation({
    mutationFn: (id: string) => fnHealth({ data: { service_id: id } }),
    onSuccess: (r: any) => toast.success(`${r.status} • ${r.latency_ms}ms`),
    onError: (e: any) => toast.error(e.message),
  });

  const stats = useMemo(() => {
    const svcs = data?.services ?? [];
    return {
      total: svcs.length,
      approved: svcs.filter((s: any) => s.approval_status === "approved").length,
      pending: svcs.filter((s: any) => s.approval_status === "pending").length,
      rejected: svcs.filter((s: any) => s.approval_status === "rejected").length,
    };
  }, [data]);

  if (!data) return <div className="text-sm text-muted-foreground">…</div>;
  const site = data.site;
  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <Link to="/sites" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className={`h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`} />
        {t("backToSites")}
      </Link>

      <Card className="p-6 bg-card/60 backdrop-blur border-border/60">
        <div className="flex items-start gap-4 flex-wrap">
          {site.logo_url ? (
            <img src={site.logo_url} alt="" className="h-16 w-16 rounded-lg object-cover" />
          ) : (
            <div className="h-16 w-16 rounded-lg bg-primary/15 border border-primary/30" />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold">{site.name}</h1>
            <a
              href={site.base_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              {site.base_url}
              <ExternalLink className="h-3 w-3" />
            </a>
            {site.description && <p className="text-sm text-muted-foreground mt-2">{site.description}</p>}
            <div className="flex gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
              <span>{t("category")}: <b className="text-foreground">{site.category ?? "—"}</b></span>
              <span>{t("status")}: <b className="text-foreground">{site.status ?? "—"}</b></span>
              <span>{t("servicesCount")}: <b className="text-foreground">{stats.total}</b></span>
            </div>
          </div>
          <Button size="lg" onClick={() => analyze.mutate()} disabled={analyze.isPending}>
            {analyze.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {analyze.isPending ? t("analyzing") : t("analyzeSiteNow")}
          </Button>
        </div>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("tabOverview")}</TabsTrigger>
          <TabsTrigger value="services">{t("tabServices")} ({stats.total})</TabsTrigger>
          <TabsTrigger value="analysis">{t("tabAnalysis")}{report ? " •" : ""}</TabsTrigger>
          <TabsTrigger value="api">{t("tabApi")}</TabsTrigger>
          <TabsTrigger value="health">{t("tabHealth")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label={t("services")} value={stats.total} />
            <StatCard label={t("approved")} value={stats.approved} color="text-emerald-400" />
            <StatCard label={t("pending")} value={stats.pending} color="text-amber-400" />
            <StatCard label={t("rejected")} value={stats.rejected} color="text-red-400" />
          </div>
        </TabsContent>

        <TabsContent value="services" className="mt-4">
          {!data.services.length ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              {t("noData")} — {t("analyzeSiteNow")}
            </Card>
          ) : (
            <Card className="bg-card/60 backdrop-blur border-border/60 overflow-hidden">
              <div className="p-3 border-b border-border/40 text-sm font-semibold flex items-center gap-2">
                <Boxes className="h-4 w-4" />
                {t("servicesProvided")}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b border-border/40">
                    <tr>
                      <th className="text-start p-2">{t("name")}</th>
                      <th className="text-start p-2">{t("category")}</th>
                      <th className="text-start p-2">{t("endpoint")}</th>
                      <th className="text-start p-2">{t("method")}</th>
                      <th className="text-start p-2">{t("status")}</th>
                      <th className="text-start p-2">Confidence</th>
                      <th className="text-end p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.services.map((s: any) => (
                      <tr key={s.id} className="border-b border-border/20 hover:bg-background/40">
                        <td className="p-2 font-medium">{s.name}</td>
                        <td className="p-2 text-xs text-muted-foreground">{s.category ?? "—"}</td>
                        <td className="p-2 font-mono text-xs text-muted-foreground">{s.endpoint_path ?? "—"}</td>
                        <td className="p-2">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/15 text-primary">{s.method}</span>
                        </td>
                        <td className="p-2"><StatusBadge status={s.approval_status ?? "approved"} /></td>
                        <td className="p-2 text-xs tabular-nums text-muted-foreground">
                          {Math.round(s.confidence_score ?? 100)}%
                        </td>
                        <td className="p-2 text-end whitespace-nowrap">
                          {s.approval_status !== "approved" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => approve.mutate(s.id)}>
                              <Check className="h-4 w-4 text-emerald-400" />
                            </Button>
                          )}
                          {s.approval_status !== "rejected" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => reject.mutate(s.id)}>
                              <X className="h-4 w-4 text-amber-400" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => health.mutate(s.id)}>
                            <Activity className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => del.mutate(s.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analysis" className="mt-4">
          {!report ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              {t("noData")} — {t("analyzeSiteNow")}
            </Card>
          ) : (
            <Card className="p-5 bg-card/60 backdrop-blur border-border/60 space-y-4">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">{t("analysisReport")}</div>
                  <div className="font-semibold">{report.base_url}</div>
                  {report.meta.title && <div className="text-sm mt-1">{report.meta.title}</div>}
                </div>
                <div className="text-end">
                  <div className="text-xs text-muted-foreground">Confidence</div>
                  <div className="text-2xl font-bold text-primary">{report.overall_confidence}%</div>
                </div>
              </div>

              {report.frameworks && report.frameworks.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">{t("detectedFrameworks")}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {report.frameworks.map((f) => (
                      <span key={f} className="text-xs px-2 py-0.5 rounded bg-muted text-foreground">{f}</span>
                    ))}
                  </div>
                </div>
              )}

              {report.systems && report.systems.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">{t("detectedSystems")}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {report.systems.map((s) => <SystemBadge key={s} system={s} />)}
                  </div>
                </div>
              )}

              {report.api_hints.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">API endpoints:</div>
                  <div className="flex flex-wrap gap-2">
                    {report.api_hints.map((h) => (
                      <span key={h.path} className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">{h.path}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-border/40 pt-4">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <h3 className="font-semibold">Discovered services ({report.discovered_services.length})</h3>
                    <p className="text-xs text-muted-foreground">Select and save for approval.</p>
                  </div>
                  <Button
                    onClick={() => saveMut.mutate()}
                    disabled={saveMut.isPending || selectedCount === 0}
                    size="sm"
                  >
                    {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4 me-1" />}
                    {t("saveForApproval")} ({selectedCount})
                  </Button>
                </div>

                {report.discovered_services.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-6 text-center">No service signals detected.</div>
                ) : (
                  <div className="space-y-2">
                    {report.discovered_services.map((s, i) => (
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
        </TabsContent>

        <TabsContent value="api" className="mt-4">
          <Card className="p-8 text-sm text-muted-foreground text-center">
            API console for this site — coming soon. Use the global{" "}
            <Link to="/api-console" className="text-primary hover:underline">API Gateway</Link>.
          </Card>
        </TabsContent>

        <TabsContent value="health" className="mt-4">
          <Card className="p-8 text-sm text-muted-foreground text-center">
            Health checks per service are available on each row's action menu, or in{" "}
            <Link to="/monitoring" className="text-primary hover:underline">Monitoring</Link>.
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Card className="p-4 bg-card/60 backdrop-blur border-border/60">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${color ?? ""}`}>{value}</div>
    </Card>
  );
}
