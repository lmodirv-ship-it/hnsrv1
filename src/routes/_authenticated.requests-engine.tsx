import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listEngineRequests } from "@/lib/engine.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle2, XCircle, RefreshCcw, HelpCircle } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/requests-engine")({
  component: RequestsEnginePage,
});

const STATUS_META: Record<string, { label: string; icon: any; cls: string }> = {
  success:    { label: "نجاح",     icon: CheckCircle2, cls: "text-emerald-400 bg-emerald-500/15" },
  fallback:   { label: "بديل",     icon: RefreshCcw,   cls: "text-amber-400 bg-amber-500/15" },
  failed:     { label: "فشل",      icon: XCircle,      cls: "text-red-400 bg-red-500/15" },
  no_service: { label: "بلا خدمة", icon: HelpCircle,   cls: "text-muted-foreground bg-muted" },
  forbidden:  { label: "ممنوع",    icon: XCircle,      cls: "text-red-400 bg-red-500/15" },
};

function RequestsEnginePage() {
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const fn = useServerFn(listEngineRequests);
  const { data } = useQuery({
    queryKey: ["engine-requests", filter],
    queryFn: () => fn({ data: { status: filter, limit: 200 } }),
    refetchInterval: 5000,
  });
  const rows = data?.rows ?? [];
  const counts = data?.counts ?? {};

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Activity className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">محرك الطلبات</h1>
        <span className="text-xs text-muted-foreground">آخر 24 ساعة</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(["success", "fallback", "failed", "no_service", "forbidden"] as const).map((k) => {
          const m = STATUS_META[k];
          const Icon = m.icon;
          const active = filter === k;
          return (
            <button
              key={k}
              onClick={() => setFilter(active ? undefined : k)}
              className={`text-start p-3 rounded-lg border transition ${active ? "border-primary bg-primary/10" : "border-border/60 bg-card/60"}`}
            >
              <div className="flex items-center justify-between">
                <div className={`inline-flex items-center gap-2 text-xs px-2 py-0.5 rounded ${m.cls}`}>
                  <Icon className="h-3 w-3" />
                  {m.label}
                </div>
                <div className="text-lg font-bold">{counts[k] ?? 0}</div>
              </div>
            </button>
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
                <th className="text-start p-2">المزود</th>
                <th className="text-start p-2">الخدمة</th>
                <th className="text-start p-2">الحالة</th>
                <th className="text-start p-2">HTTP</th>
                <th className="text-start p-2">Latency</th>
                <th className="text-start p-2">محاولات</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">لا توجد طلبات بعد</td></tr>
              )}
              {rows.map((r: any) => {
                const m = STATUS_META[r.execution_status] ?? STATUS_META.no_service;
                const Icon = m.icon;
                return (
                  <tr key={r.id} className="border-t border-border/40 hover:bg-muted/30">
                    <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">{new Date(r.created_at).toLocaleTimeString()}</td>
                    <td className="p-2"><Badge variant="outline" className="text-xs">{r.requester_site ?? r.api_clients?.name ?? "—"}</Badge></td>
                    <td className="p-2 max-w-[220px] truncate" title={r.service_intent}>{r.service_intent ?? "—"}</td>
                    <td className="p-2"><Badge variant="secondary" className="text-xs">{r.provider_site ?? "—"}</Badge></td>
                    <td className="p-2 text-xs">{r.services?.name ?? "—"}</td>
                    <td className="p-2">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${m.cls}`}>
                        <Icon className="h-3 w-3" />{m.label}
                        {r.fallback_used && <span className="ms-1 text-[10px] opacity-80">×{r.attempts}</span>}
                      </span>
                    </td>
                    <td className="p-2 text-xs">{r.status_code ?? "—"}</td>
                    <td className="p-2 text-xs">{r.latency_ms ?? 0}ms</td>
                    <td className="p-2 text-xs">{r.attempts ?? 1}</td>
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
