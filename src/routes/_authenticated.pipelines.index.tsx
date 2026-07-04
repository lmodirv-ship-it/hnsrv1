import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listPipelines, runPipelineNow } from "@/lib/engine.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { GitBranch, PlayCircle, CheckCircle2, XCircle, Clock, ExternalLink } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/pipelines/")({
  component: PipelinesPage,
});

const STATUS_META: Record<string, { label: string; cls: string; icon: any }> = {
  running: { label: "قيد التنفيذ", cls: "text-sky-400 bg-sky-500/15", icon: Clock },
  success: { label: "نجاح", cls: "text-emerald-400 bg-emerald-500/15", icon: CheckCircle2 },
  partial: { label: "جزئي", cls: "text-amber-400 bg-amber-500/15", icon: CheckCircle2 },
  failed:  { label: "فشل", cls: "text-red-400 bg-red-500/15", icon: XCircle },
  pending: { label: "بالانتظار", cls: "text-muted-foreground bg-muted", icon: Clock },
};

function PipelinesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listPipelines);
  const run = useServerFn(runPipelineNow);
  const { data } = useQuery({
    queryKey: ["pipelines"],
    queryFn: () => list({ data: { limit: 100 } }),
    refetchInterval: 5000,
  });

  const [intent, setIntent] = useState("إنشاء موقع طبيب متكامل");
  const [prompt, setPrompt] = useState("موقع لعيادة طبية مع محتوى، صور، فيديو، صوت، وملفات جاهزة");
  const runMut = useMutation({
    mutationFn: (v: { intent: string; prompt?: string }) => run({ data: v }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["pipelines"] });
      if (r?.pipeline_id) navigate({ to: "/pipelines/$id", params: { id: r.pipeline_id } });
    },
  });

  const rows = data?.rows ?? [];
  const counts = data?.counts ?? {};

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <GitBranch className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">خطوط تنفيذ الطلبات</h1>
        <span className="text-xs text-muted-foreground">Multi-Service Orchestrator</span>
      </div>

      <Card className="p-4 bg-card/60 backdrop-blur border-border/60 space-y-3">
        <div className="text-sm font-semibold">تشغيل خط جديد</div>
        <Input value={intent} onChange={(e) => setIntent(e.target.value)} placeholder="نية الطلب (مثل: إنشاء موقع طبيب)" />
        <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="تفاصيل إضافية / وصف" rows={3} />
        <div className="flex justify-end">
          <Button
            onClick={() => runMut.mutate({ intent: intent.trim(), prompt: prompt.trim() || undefined })}
            disabled={runMut.isPending || intent.trim().length < 3}
          >
            <PlayCircle className="h-4 w-4 me-2" />
            {runMut.isPending ? "جاري التنفيذ..." : "توليد الآن"}
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(["running","success","partial","failed","pending"] as const).map((k) => {
          const m = STATUS_META[k];
          return (
            <div key={k} className="p-3 rounded-lg border border-border/60 bg-card/60">
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${m.cls}`}>
                  <m.icon className="h-3 w-3" />{m.label}
                </span>
                <span className="text-lg font-bold">{counts[k] ?? 0}</span>
              </div>
            </div>
          );
        })}
      </div>

      <Card className="p-0 overflow-hidden bg-card/60 backdrop-blur border-border/60">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-start p-2">الوقت</th>
                <th className="text-start p-2">الطالب</th>
                <th className="text-start p-2">النيّة</th>
                <th className="text-start p-2">الحالة</th>
                <th className="text-start p-2">المهام</th>
                <th className="text-start p-2">Latency</th>
                <th className="text-start p-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">لا توجد خطوط تنفيذ بعد</td></tr>
              )}
              {rows.map((r: any) => {
                const m = STATUS_META[r.status] ?? STATUS_META.pending;
                return (
                  <tr key={r.id} className="border-t border-border/40 hover:bg-muted/30">
                    <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="p-2"><Badge variant="outline" className="text-xs">{r.requester_site ?? "—"}</Badge></td>
                    <td className="p-2 max-w-[280px] truncate" title={r.intent}>{r.intent}</td>
                    <td className="p-2">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${m.cls}`}>
                        <m.icon className="h-3 w-3" />{m.label}
                      </span>
                    </td>
                    <td className="p-2 text-xs">{r.subtasks_done}/{r.subtasks_total}</td>
                    <td className="p-2 text-xs">{r.latency_ms ?? 0}ms</td>
                    <td className="p-2">
                      <Link to="/pipelines/$id" params={{ id: r.id }} className="text-primary inline-flex items-center gap-1 text-xs">
                        تفاصيل <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
