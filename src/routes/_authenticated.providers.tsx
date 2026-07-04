import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listProviderUsage } from "@/lib/engine.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server } from "lucide-react";

export const Route = createFileRoute("/_authenticated/providers")({
  component: ProvidersPage,
});

function ProvidersPage() {
  const fn = useServerFn(listProviderUsage);
  const { data } = useQuery({
    queryKey: ["provider-usage"],
    queryFn: () => fn(),
    refetchInterval: 8000,
  });
  const rows = data ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Server className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">المزودون</h1>
        <span className="text-xs text-muted-foreground">آخر 7 أيام</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.length === 0 && (
          <Card className="p-6 text-center text-muted-foreground col-span-full">لا يوجد نشاط للمزودين بعد</Card>
        )}
        {rows.map((r) => {
          const rate = r.total ? Math.round((r.success / r.total) * 100) : 0;
          return (
            <Card key={r.site} className="p-4 bg-card/60 border-border/60 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline">{r.site}</Badge>
                <span className="text-xs text-muted-foreground">{r.avg_ms}ms متوسط</span>
              </div>
              <div className="text-3xl font-bold">{r.total}</div>
              <div className="text-xs text-muted-foreground">مهمة منفذة</div>
              <div className="flex gap-2 text-xs">
                <span className="text-emerald-400">✓ {r.success}</span>
                <span className="text-red-400">✗ {r.failed}</span>
                <span className="text-muted-foreground ms-auto">{rate}% نجاح</span>
              </div>
              <div className="pt-2 border-t border-border/40 flex flex-wrap gap-1">
                {Object.entries(r.kinds).map(([k, v]) => (
                  <Badge key={k} variant="secondary" className="text-[10px]">{k}: {v}</Badge>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
