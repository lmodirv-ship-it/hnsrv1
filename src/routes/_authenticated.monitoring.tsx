import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { latestHealth, checkAllHealth } from "@/lib/monitoring.functions";
import { useLanguage } from "@/i18n/LanguageProvider";
import { Card } from "@/components/ui/card";
import { GenerateButton } from "@/components/generate-button";
import { Activity } from "lucide-react";

export const Route = createFileRoute("/_authenticated/monitoring")({
  component: MonitoringPage,
});

function MonitoringPage() {
  const { t } = useLanguage();
  const fn = useServerFn(latestHealth);
  const checkAll = useServerFn(checkAllHealth);
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["health"], queryFn: () => fn(), refetchInterval: 15000 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{t("monitoring")}</h1>
        </div>
        <GenerateButton
          label="توليد: افحص كل الخدمات"
          pendingLabel="جاري الفحص…"
          onGenerate={() => checkAll()}
          onDone={() => qc.invalidateQueries({ queryKey: ["health"] })}
          successMessage={(r: any) => `فُحصت ${r.checked} خدمة • ${r.online} online • ${r.failed} failed`}
        />
      </div>

      {!data.length ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">{t("noData")}</Card>
      ) : (
        <div className="space-y-2">
          {data.map((h: any) => (
            <Card key={h.id} className="p-4 bg-card/60 backdrop-blur border-border/60 flex items-center gap-4">
              <span className={`h-2.5 w-2.5 rounded-full ${h.status === "online" ? "bg-emerald-400" : h.status === "degraded" ? "bg-amber-400" : "bg-red-400"} animate-pulse`} />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{h.services?.name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{h.services?.sites?.name} • {new Date(h.checked_at).toLocaleString()}</div>
              </div>
              <div className="text-sm text-muted-foreground">{h.latency_ms}ms</div>
              <span className={`text-xs px-2 py-0.5 rounded ${h.status === "online" ? "bg-emerald-500/15 text-emerald-400" : h.status === "degraded" ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"}`}>{h.status}</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
