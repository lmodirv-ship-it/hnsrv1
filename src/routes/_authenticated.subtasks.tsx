import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listRecentSubtasks } from "@/lib/engine.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListChecks, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/subtasks")({
  component: SubtasksPage,
});

const M: Record<string, { label: string; cls: string; icon: any }> = {
  pending:    { label: "بالانتظار", cls: "text-muted-foreground bg-muted", icon: Clock },
  running:    { label: "قيد التنفيذ", cls: "text-sky-400 bg-sky-500/15", icon: Clock },
  success:    { label: "نجاح", cls: "text-emerald-400 bg-emerald-500/15", icon: CheckCircle2 },
  failed:     { label: "فشل", cls: "text-red-400 bg-red-500/15", icon: XCircle },
  no_service: { label: "بلا مزود", cls: "text-amber-400 bg-amber-500/15", icon: XCircle },
};

function SubtasksPage() {
  const fn = useServerFn(listRecentSubtasks);
  const { data } = useQuery({
    queryKey: ["recent-subtasks"],
    queryFn: () => fn({ data: { limit: 200 } }),
    refetchInterval: 4000,
  });
  const rows = data ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ListChecks className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">المهام الفرعية</h1>
        <span className="text-xs text-muted-foreground">آخر 200 مهمة</span>
      </div>

      <Card className="p-0 overflow-hidden bg-card/60 border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-start p-2">الوقت</th>
              <th className="text-start p-2">Pipeline</th>
              <th className="text-start p-2">#</th>
              <th className="text-start p-2">النوع</th>
              <th className="text-start p-2">النيّة</th>
              <th className="text-start p-2">الخدمة</th>
              <th className="text-start p-2">المزود</th>
              <th className="text-start p-2">الحالة</th>
              <th className="text-start p-2">Latency</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">لا توجد مهام بعد</td></tr>
            )}
            {rows.map((r: any) => {
              const m = M[r.status] ?? M.pending;
              return (
                <tr key={r.id} className="border-t border-border/40 hover:bg-muted/30">
                  <td className="p-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleTimeString()}</td>
                  <td className="p-2 text-xs">
                    <Link to="/pipelines/$id" params={{ id: r.pipeline_id }} className="text-primary">
                      {r.pipeline_id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="p-2 text-xs">{r.task_order}</td>
                  <td className="p-2"><Badge variant="secondary" className="text-xs">{r.kind}</Badge></td>
                  <td className="p-2 max-w-[260px] truncate" title={r.intent}>{r.intent}</td>
                  <td className="p-2 text-xs">{r.services?.name ?? "—"}</td>
                  <td className="p-2"><Badge variant="outline" className="text-xs">{r.assigned_provider_site ?? "—"}</Badge></td>
                  <td className="p-2">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${m.cls}`}>
                      <m.icon className="h-3 w-3" />{m.label}
                    </span>
                  </td>
                  <td className="p-2 text-xs">{r.latency_ms ?? 0}ms</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
