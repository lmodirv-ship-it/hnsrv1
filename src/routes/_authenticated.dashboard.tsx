import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dashboardStats } from "@/lib/monitoring.functions";
import { analyzeAllSites } from "@/lib/discovery.functions";
import { useLanguage } from "@/i18n/LanguageProvider";
import { Card } from "@/components/ui/card";
import { GenerateButton } from "@/components/generate-button";
import { Globe, Boxes, KeyRound, Activity, Brain } from "lucide-react";


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — HN Service Hub" },
      {
        name: "description",
        content:
          "Live overview of your HN ecosystem: registered sites, services, active API keys, and recent orchestration activity.",
      },
      { property: "og:title", content: "Dashboard — HN Service Hub" },
      {
        property: "og:description",
        content: "Live overview of registered sites, services, and orchestration activity across the HN ecosystem.",
      },
      { property: "og:url", content: "https://hn-mind-hub.lovable.app/dashboard" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://hn-mind-hub.lovable.app/dashboard" }],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { t } = useLanguage();
  const fn = useServerFn(dashboardStats);
  const { data } = useQuery({ queryKey: ["dashboard-stats"], queryFn: () => fn() });

  const stats = [
    { key: "totalSites" as const, value: data?.sites ?? 0, icon: Globe, color: "text-cyan-400" },
    { key: "totalServices" as const, value: data?.services ?? 0, icon: Boxes, color: "text-emerald-400" },
    { key: "totalKeys" as const, value: data?.keys ?? 0, icon: KeyRound, color: "text-amber-400" },
    { key: "recentRequests" as const, value: data?.recent?.length ?? 0, icon: Activity, color: "text-fuchsia-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t("dashboard")}</h1>
          <p className="text-sm text-muted-foreground">{t("appTagline")}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.key} className="p-5 bg-card/60 backdrop-blur border-border/60">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t(s.key)}</span>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <div className="text-3xl font-bold mt-2">{s.value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-5 bg-card/60 backdrop-blur border-border/60">
        <h2 className="font-semibold mb-3">{t("recentRequests")}</h2>
        {!data?.recent?.length ? (
          <p className="text-sm text-muted-foreground">{t("noData")}</p>
        ) : (
          <div className="space-y-2">
            {data.recent.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between text-sm border-b border-border/40 py-2 last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-mono ${r.status_code && r.status_code < 400 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                    {r.status_code ?? "—"}
                  </span>
                  <span className="font-medium">{r.services?.name ?? "—"}</span>
                  <span className="text-muted-foreground text-xs">{r.api_clients?.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{r.latency_ms ?? 0}ms</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
