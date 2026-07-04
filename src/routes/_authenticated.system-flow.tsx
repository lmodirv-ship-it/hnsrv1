import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageProvider";
import { supabase } from "@/integrations/supabase/client";
import { activateAllTasks } from "@/lib/activate-tasks.functions";
import {
  User,
  Globe,
  Server,
  Brain,
  Cpu,
  Boxes,
  ArrowDown,
  ArrowUp,
  Zap,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/system-flow")({
  component: SystemFlowPage,
});

type Stats = {
  total: number;
  ok: number;
  failed: number;
  avgLatency: number;
  byLayer: Record<string, number>;
  gatewayShare: number;
  topRequesters: Array<{ site: string; count: number }>;
  topProviders: Array<{ site: string; count: number }>;
};

async function loadStats(): Promise<Stats> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: reqs } = await supabase
    .from("service_requests")
    .select("status_code,latency_ms,requester_site,provider_site,gateway_site,execution_status")
    .gte("created_at", since)
    .limit(2000);
  const { data: sites } = await supabase.from("sites").select("slug,layer");
  const layerOf = new Map((sites ?? []).map((s: any) => [s.slug, s.layer as string]));

  const rows = reqs ?? [];
  const total = rows.length;
  const ok = rows.filter((r: any) => r.status_code && r.status_code >= 200 && r.status_code < 400).length;
  const failed = total - ok;
  const avgLatency = total ? Math.round(rows.reduce((n: number, r: any) => n + (r.latency_ms ?? 0), 0) / total) : 0;
  const withGateway = rows.filter((r: any) => (r.gateway_site ?? "").toLowerCase().includes("tvcc")).length;

  const byLayer: Record<string, number> = {};
  const countBySite = (col: "requester_site" | "provider_site") => {
    const m: Record<string, number> = {};
    for (const r of rows as any[]) {
      const s = r[col];
      if (!s) continue;
      m[s] = (m[s] ?? 0) + 1;
      const l = layerOf.get(s);
      if (l) byLayer[l] = (byLayer[l] ?? 0) + 1;
    }
    return Object.entries(m)
      .map(([site, count]) => ({ site, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  };
  const topRequesters = countBySite("requester_site");
  const topProviders = countBySite("provider_site");

  return {
    total,
    ok,
    failed,
    avgLatency,
    byLayer,
    gatewayShare: total ? Math.round((withGateway / total) * 100) : 0,
    topRequesters,
    topProviders,
  };
}

function Node({
  icon: Icon,
  title,
  subtitle,
  count,
  tint,
}: {
  icon: typeof User;
  title: string;
  subtitle?: string;
  count?: string;
  tint: string;
}) {
  return (
    <div className={`w-full rounded-xl border ${tint} p-4 backdrop-blur bg-card/60`}>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-background/40 flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{title}</div>
          {subtitle && <div className="text-[11px] text-muted-foreground truncate">{subtitle}</div>}
        </div>
        {count && (
          <div className="text-[11px] px-2 py-0.5 rounded bg-background/40 font-mono">{count}</div>
        )}
      </div>
    </div>
  );
}

function Arrow({ up = false, label }: { up?: boolean; label?: string }) {
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <div className="flex flex-col items-center py-1">
      <Icon className="h-4 w-4 text-primary/70" />
      {label && <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>}
    </div>
  );
}

function SystemFlowPage() {
  const { t } = useLanguage();
  const { data } = useQuery({ queryKey: ["system-flow-stats"], queryFn: loadStats });

  const totalStr = data ? `${data.total} req/24h` : "—";
  const okStr = data ? `${data.ok} ok · ${data.failed} fail` : "—";
  const latencyStr = data ? `${data.avgLatency} ms avg` : "—";
  const gwStr = data ? `${data.gatewayShare}% via TVCC` : "—";

  const providersLabel = data?.topProviders.map((p) => p.site).slice(0, 3).join(" · ") || "HN Video · HN Image · HN AI";
  const requestersLabel = data?.topRequesters.map((p) => p.site).slice(0, 3).join(" · ") || "HN Build · HN Apps · HN Chat";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          {t("systemFlowTitle")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("systemFlowSubtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground">Requests (24h)</div>
          <div className="text-lg font-bold">{totalStr}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground">Outcome</div>
          <div className="text-lg font-bold">{okStr}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground">Latency</div>
          <div className="text-lg font-bold">{latencyStr}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground">Gateway</div>
          <div className="text-lg font-bold">{gwStr}</div>
        </Card>
      </div>

      <div className="grid gap-3 max-w-2xl mx-auto">
        <Node
          icon={User}
          title="User"
          subtitle="المستخدم النهائي"
          tint="border-muted-foreground/30"
        />
        <Arrow label="opens" />
        <Node
          icon={Globe}
          title={`${t("layerApp")} — HN Site`}
          subtitle={requestersLabel}
          count={data ? `${data.byLayer.app ?? 0}` : undefined}
          tint="border-sky-500/40"
        />
        <Arrow label="→ TVCC" />
        <Node
          icon={Server}
          title={`${t("layerGateway")} — TVCC`}
          subtitle="System Gateway — auth, identity, publish"
          count={gwStr}
          tint="border-emerald-500/40"
        />
        <Arrow label="→ Hub" />
        <Node
          icon={Brain}
          title={`${t("layerOrchestrator")} — HN Service Hub`}
          subtitle="Routes intent → picks best provider"
          count={totalStr}
          tint="border-primary/40"
        />
        <Arrow label="→ providers" />
        <Node
          icon={Boxes}
          title={`${t("layerProvider")}`}
          subtitle={providersLabel}
          count={data ? `${data.byLayer.provider ?? 0}` : undefined}
          tint="border-amber-500/40"
        />
        <Node
          icon={Cpu}
          title={`${t("layerInfrastructure")}`}
          subtitle="HN-DB · HN-Cloud · HN-Core"
          count={data ? `${data.byLayer.infrastructure ?? 0}` : undefined}
          tint="border-fuchsia-500/40"
        />
        <Arrow up label="result" />
        <Node
          icon={Brain}
          title="HN Service Hub — aggregates result"
          tint="border-primary/40"
        />
        <Arrow up label="via TVCC" />
        <Node
          icon={Server}
          title="TVCC — delivers back to origin site"
          tint="border-emerald-500/40"
        />
        <Arrow up label="renders to user" />
        <Node
          icon={Globe}
          title="Requesting HN Site → User sees final result"
          tint="border-sky-500/40"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="font-semibold text-sm mb-2">Top requesting sites</div>
          {(data?.topRequesters ?? []).length === 0 ? (
            <div className="text-xs text-muted-foreground">No traffic yet</div>
          ) : (
            <ul className="space-y-1 text-sm">
              {data!.topRequesters.map((r) => (
                <li key={r.site} className="flex justify-between">
                  <span className="truncate">{r.site}</span>
                  <span className="font-mono text-muted-foreground">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-4">
          <div className="font-semibold text-sm mb-2">Top provider sites</div>
          {(data?.topProviders ?? []).length === 0 ? (
            <div className="text-xs text-muted-foreground">No traffic yet</div>
          ) : (
            <ul className="space-y-1 text-sm">
              {data!.topProviders.map((r) => (
                <li key={r.site} className="flex justify-between">
                  <span className="truncate">{r.site}</span>
                  <span className="font-mono text-muted-foreground">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
