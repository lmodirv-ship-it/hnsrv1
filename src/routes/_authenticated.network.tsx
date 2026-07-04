import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getServiceNetwork } from "@/lib/network.functions";
import { analyzeAllSites, linkAllSitesMesh } from "@/lib/discovery.functions";
import type { NetworkService, NetworkSite } from "@/lib/network.functions";
import { useLanguage } from "@/i18n/LanguageProvider";
import { GenerateButton } from "@/components/generate-button";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Network,
  ChevronRight,
  Search,
  Globe,
  Boxes,
  Server,
  Database,
  Cloud,
  Cpu,
  Brain,
  ArrowRight,
} from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/network")({
  component: NetworkPage,
});

const SYSTEM_LABEL: Record<string, { label: string; icon: typeof Server; color: string }> = {
  "hn-db": { label: "HN-DB", icon: Database, color: "text-sky-400 bg-sky-500/15" },
  "hn-cloud": { label: "HN-Cloud", icon: Cloud, color: "text-indigo-400 bg-indigo-500/15" },
  tvcc: { label: "TVCC", icon: Server, color: "text-emerald-400 bg-emerald-500/15" },
  "hn-core": { label: "HN-Core", icon: Cpu, color: "text-fuchsia-400 bg-fuchsia-500/15" },
  "hn-ai": { label: "HN-AI", icon: Brain, color: "text-amber-400 bg-amber-500/15" },
};

function SystemChip({ system }: { system: string }) {
  const meta = SYSTEM_LABEL[system] ?? { label: system, icon: Server, color: "text-muted-foreground bg-muted" };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded ${meta.color}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function ServiceNode({ service, onSelect }: { service: NetworkService; onSelect: (s: NetworkService) => void }) {
  return (
    <div className="pl-6 border-l border-border/40 ml-2 py-1">
      <button
        onClick={() => onSelect(service)}
        className="flex items-center gap-2 text-sm hover:text-primary text-start w-full"
      >
        <Boxes className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">{service.name}</span>
        {service.category && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{service.category}</span>
        )}
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{service.method}</span>
        {service.consumer_count > 0 && (
          <span className="text-[10px] text-muted-foreground">
            · {service.consumer_count} consumer{service.consumer_count === 1 ? "" : "s"}
          </span>
        )}
      </button>
      {service.dependencies.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mt-1 ml-6">
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          {service.dependencies.map((d, i) =>
            d.kind === "system" ? (
              <SystemChip key={i} system={d.system!} />
            ) : (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground">
                {d.site_name ? `${d.site_name} · ` : ""}{d.service_name}
              </span>
            )
          )}
        </div>
      )}
    </div>
  );
}

function SiteBranch({ site, onSelect }: { site: NetworkSite; onSelect: (s: NetworkService) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="p-3 bg-card/60 backdrop-blur border-border/60">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-2 text-start">
            <ChevronRight className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} />
            {site.logo_url ? (
              <img src={site.logo_url} alt="" className="h-6 w-6 rounded object-cover" />
            ) : (
              <div className="h-6 w-6 rounded bg-primary/15 border border-primary/30 flex items-center justify-center">
                <Globe className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
            <Link
              to="/sites/$slug"
              params={{ slug: site.slug }}
              className="font-semibold hover:text-primary"
              onClick={(e) => e.stopPropagation()}
            >
              {site.name}
            </Link>
            <span className="text-xs text-muted-foreground">· {site.services.length} services</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          {site.services.length === 0 ? (
            <div className="text-xs text-muted-foreground pl-6">No services yet</div>
          ) : (
            site.services.map((s) => <ServiceNode key={s.id} service={s} onSelect={onSelect} />)
          )}
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function NetworkPage() {
  const { t } = useLanguage();
  const fn = useServerFn(getServiceNetwork);
  const analyzeAll = useServerFn(analyzeAllSites);
  const linkMesh = useServerFn(linkAllSitesMesh);
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["service-network"], queryFn: () => fn() });

  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<NetworkService | null>(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return data;
    return data
      .map((site) => ({
        ...site,
        services: site.services.filter((s) =>
          [s.name, s.category, s.endpoint_path].filter(Boolean).some((v) => String(v).toLowerCase().includes(query))
        ),
      }))
      .filter((site) => site.name.toLowerCase().includes(query) || site.services.length > 0);
  }, [data, q]);

  const totals = useMemo(() => {
    const services = data.reduce((n, s) => n + s.services.length, 0);
    const deps = data.reduce((n, s) => n + s.services.reduce((k, sv) => k + sv.dependencies.length, 0), 0);
    return { sites: data.length, services, deps };
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Network className="h-6 w-6 text-primary" />
            {t("navServiceNetwork")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {totals.sites} sites · {totals.services} services · {totals.deps} dependencies
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="h-4 w-4 absolute top-2.5 start-3 text-muted-foreground" />
            <Input className="ps-9" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <GenerateButton
            label="توليد: أعد بناء الشبكة"
            pendingLabel="جاري التحليل…"
            onGenerate={() => analyzeAll()}
            onDone={() => qc.invalidateQueries({ queryKey: ["service-network"] })}
            successMessage={(r: any) => `تم تحليل ${r.analyzed}/${r.total} • خدمات: ${r.servicesCreated}`}
          />
          <GenerateButton
            label="اربط الكل ↔ الكل (Mesh)"
            pendingLabel="جاري الربط…"
            onGenerate={() =>
              linkMesh({
                data: { coordinator_url: window.location.origin },
              })
            }
            onDone={() => qc.invalidateQueries({ queryKey: ["service-network"] })}
            successMessage={(r: any) =>
              `تم ربط ${r.links} علاقة • ${r.sites} موقع × ${r.services} خدمة`
            }
          />
        </div>
      </div>


      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">{t("noData")}</Card>
          ) : (
            filtered.map((site) => <SiteBranch key={site.id} site={site} onSelect={setSelected} />)
          )}
        </div>

        <Card className="p-4 bg-card/60 backdrop-blur border-border/60 h-fit sticky top-20">
          {!selected ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              {t("networkSelectHint")}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground">{t("service")}</div>
                <div className="font-semibold">{selected.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {selected.method} · {selected.endpoint_path ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">{t("dependsOn")}</div>
                {selected.dependencies.length === 0 ? (
                  <div className="text-xs text-muted-foreground">—</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selected.dependencies.map((d, i) =>
                      d.kind === "system" ? (
                        <SystemChip key={i} system={d.system!} />
                      ) : (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          {d.site_name ? `${d.site_name} · ` : ""}{d.service_name}
                        </span>
                      )
                    )}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">{t("usedBy")}</div>
                {selected.consumer_sites.length === 0 ? (
                  <div className="text-xs text-muted-foreground">—</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selected.consumer_sites.map((c) => (
                      <Link
                        key={c.id}
                        to="/sites/$slug"
                        params={{ slug: c.slug }}
                        className="text-[10px] px-2 py-0.5 rounded bg-primary/15 text-primary hover:underline"
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-[11px] text-amber-400 border-t border-border/40 pt-2">
                {t("networkImpactHint")}
              </div>
              <Button size="sm" variant="outline" className="w-full" onClick={() => setSelected(null)}>
                {t("cancel")}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
