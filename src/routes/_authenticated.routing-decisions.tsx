import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getRoutingDecisions } from "@/lib/engine.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/routing-decisions")({
  component: RoutingDecisionsPage,
});

function RoutingDecisionsPage() {
  const fn = useServerFn(getRoutingDecisions);
  const { data = [] } = useQuery({ queryKey: ["routing-decisions"], queryFn: () => fn(), refetchInterval: 8000 });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <GitBranch className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">قرارات التوجيه</h1>
        <span className="text-xs text-muted-foreground">لماذا اختار الهَب هذه الخدمة</span>
      </div>

      {data.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">لا توجد قرارات بعد</Card>
      )}

      <div className="space-y-3">
        {data.map((r: any) => {
          const d = r.routing_decision ?? {};
          const chose = d.chose;
          const candidates = d.candidates ?? [];
          const attempts = d.attempts ?? [];
          return (
            <Card key={r.id} className="p-4 bg-card/60 backdrop-blur border-border/60">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm min-w-0">
                  <Badge variant="outline" className="text-xs">{r.requester_site ?? "—"}</Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground truncate max-w-[300px]">{r.service_intent ?? "—"}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="secondary" className="text-xs">{chose?.name ?? r.services?.name ?? "—"}</Badge>
                  {r.fallback_used && <Badge className="bg-amber-500/20 text-amber-300 text-[10px]">fallback ×{r.attempts}</Badge>}
                </div>
                <span className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3 text-xs">
                <div>
                  <div className="text-muted-foreground mb-1">السبب</div>
                  <code className="text-[11px] bg-background/60 rounded px-2 py-1 block">{d.reason ?? "—"}</code>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">المرشحون ({candidates.length})</div>
                  <div className="space-y-1">
                    {candidates.slice(0, 4).map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="truncate">{c.name}</span>
                        <span className="text-primary">score {c.score}</span>
                      </div>
                    ))}
                    {candidates.length === 0 && <span className="text-muted-foreground/70">—</span>}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">المحاولات ({attempts.length})</div>
                  <div className="space-y-1">
                    {attempts.map((a: any, i: number) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="truncate">{a.name}</span>
                        <span className={a.status >= 200 && a.status < 400 ? "text-emerald-400" : "text-red-400"}>{a.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
