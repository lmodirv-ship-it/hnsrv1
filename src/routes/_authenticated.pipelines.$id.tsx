import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPipeline } from "@/lib/engine.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, CheckCircle2, XCircle, Clock, Package, Server, ListChecks, Route as RouteIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pipelines/$id")({
  component: PipelineDetailPage,
});

const SUB_STATUS: Record<string, { label: string; cls: string; icon: any }> = {
  pending:    { label: "بالانتظار", cls: "text-muted-foreground bg-muted", icon: Clock },
  running:    { label: "قيد التنفيذ", cls: "text-sky-400 bg-sky-500/15", icon: Clock },
  success:    { label: "نجاح", cls: "text-emerald-400 bg-emerald-500/15", icon: CheckCircle2 },
  failed:     { label: "فشل", cls: "text-red-400 bg-red-500/15", icon: XCircle },
  no_service: { label: "بلا مزود", cls: "text-amber-400 bg-amber-500/15", icon: XCircle },
};

function PipelineDetailPage() {
  const { id } = Route.useParams();
  const fn = useServerFn(getPipeline);
  const { data } = useQuery({
    queryKey: ["pipeline", id],
    queryFn: () => fn({ data: { id } }),
    refetchInterval: 3000,
  });
  const pipeline = data?.pipeline;
  const subtasks = data?.subtasks ?? [];

  if (!pipeline) {
    return <div className="p-6 text-muted-foreground">جاري التحميل...</div>;
  }

  const finalPkg = (pipeline as any).final_package ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/pipelines" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="text-xs text-muted-foreground">Pipeline · {id.slice(0, 8)}</div>
          <h1 className="text-xl font-bold">{pipeline.intent}</h1>
        </div>
        <Badge variant="outline">{pipeline.status}</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="الطالب" value={pipeline.requester_site ?? "—"} />
        <StatCard label="المهام" value={`${pipeline.subtasks_done}/${pipeline.subtasks_total}`} />
        <StatCard label="Latency" value={`${pipeline.latency_ms ?? 0}ms`} />
        <StatCard label="بدء التنفيذ" value={pipeline.started_at ? new Date(pipeline.started_at).toLocaleTimeString() : "—"} />
      </div>

      <Tabs defaultValue="subtasks">
        <TabsList>
          <TabsTrigger value="subtasks"><ListChecks className="h-4 w-4 me-1" /> المهام الفرعية</TabsTrigger>
          <TabsTrigger value="timeline"><RouteIcon className="h-4 w-4 me-1" /> جدول التنفيذ</TabsTrigger>
          <TabsTrigger value="providers"><Server className="h-4 w-4 me-1" /> المزودون</TabsTrigger>
          <TabsTrigger value="package"><Package className="h-4 w-4 me-1" /> الحزمة النهائية</TabsTrigger>
        </TabsList>

        <TabsContent value="subtasks">
          <Card className="p-0 overflow-hidden bg-card/60 border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-start p-2">#</th>
                  <th className="text-start p-2">النوع</th>
                  <th className="text-start p-2">النيّة</th>
                  <th className="text-start p-2">الخدمة</th>
                  <th className="text-start p-2">الموقع المزود</th>
                  <th className="text-start p-2">الحالة</th>
                  <th className="text-start p-2">HTTP</th>
                  <th className="text-start p-2">Latency</th>
                </tr>
              </thead>
              <tbody>
                {subtasks.map((s: any) => {
                  const m = SUB_STATUS[s.status] ?? SUB_STATUS.pending;
                  return (
                    <tr key={s.id} className="border-t border-border/40">
                      <td className="p-2 text-xs">{s.task_order}</td>
                      <td className="p-2"><Badge variant="secondary" className="text-xs">{s.kind}</Badge></td>
                      <td className="p-2 max-w-[300px] truncate" title={s.intent}>{s.intent}</td>
                      <td className="p-2 text-xs">{s.services?.name ?? "—"}</td>
                      <td className="p-2"><Badge variant="outline" className="text-xs">{s.assigned_provider_site ?? "—"}</Badge></td>
                      <td className="p-2">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${m.cls}`}>
                          <m.icon className="h-3 w-3" />{m.label}
                        </span>
                      </td>
                      <td className="p-2 text-xs">{s.status_code ?? "—"}</td>
                      <td className="p-2 text-xs">{s.latency_ms ?? 0}ms</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card className="p-4 bg-card/60 border-border/60">
            <div className="relative ps-6">
              <div className="absolute top-0 bottom-0 start-2 w-px bg-border" />
              {subtasks.map((s: any) => {
                const m = SUB_STATUS[s.status] ?? SUB_STATUS.pending;
                return (
                  <div key={s.id} className="relative mb-4">
                    <div className={`absolute -start-4 top-1 w-3 h-3 rounded-full ${m.cls}`} />
                    <div className="text-xs text-muted-foreground">
                      {s.started_at ? new Date(s.started_at).toLocaleTimeString() : "—"}
                      {" → "}
                      {s.finished_at ? new Date(s.finished_at).toLocaleTimeString() : "..."}
                      {"  · "}{s.latency_ms ?? 0}ms
                    </div>
                    <div className="text-sm font-medium">
                      <Badge variant="secondary" className="text-xs me-2">{s.kind}</Badge>
                      {s.intent}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.services?.name ?? "—"} @ {s.assigned_provider_site ?? "—"} — {m.label}
                      {s.error ? ` · ${s.error}` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="providers">
          <Card className="p-4 bg-card/60 border-border/60 space-y-2">
            {Array.from(new Map(subtasks.map((s: any) => [s.assigned_provider_site ?? "—", s])).values()).map((s: any) => {
              const forSite = subtasks.filter((x: any) => (x.assigned_provider_site ?? "—") === (s.assigned_provider_site ?? "—"));
              const ok = forSite.filter((x: any) => x.status === "success").length;
              return (
                <div key={s.assigned_provider_site ?? "—"} className="flex items-center justify-between p-2 border-b border-border/40">
                  <div>
                    <Badge variant="outline">{s.assigned_provider_site ?? "—"}</Badge>
                    <span className="ms-2 text-xs text-muted-foreground">
                      {forSite.map((x: any) => x.kind).join(" · ")}
                    </span>
                  </div>
                  <div className="text-xs">{ok}/{forSite.length} ناجحة</div>
                </div>
              );
            })}
          </Card>
        </TabsContent>

        <TabsContent value="package">
          <Card className="p-4 bg-card/60 border-border/60">
            {finalPkg ? (
              <pre className="text-xs overflow-auto max-h-[520px] whitespace-pre-wrap break-words">
                {JSON.stringify(finalPkg, null, 2)}
              </pre>
            ) : (
              <div className="text-muted-foreground text-sm">لم تكتمل الحزمة النهائية بعد</div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3 bg-card/60 border-border/60">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold truncate">{value}</div>
    </Card>
  );
}
