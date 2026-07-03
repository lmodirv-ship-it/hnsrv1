import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listSites } from "@/lib/sites.functions";
import { listServices } from "@/lib/services.functions";
import { useLanguage } from "@/i18n/LanguageProvider";
import { Card } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/knowledge")({
  component: KnowledgePage,
});

function KnowledgePage() {
  const { t } = useLanguage();
  const s = useServerFn(listSites);
  const sv = useServerFn(listServices);
  const { data: sites = [] } = useQuery({ queryKey: ["sites"], queryFn: () => s() });
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: () => sv() });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">{t("knowledgeBase")}</h1>
      </div>

      <div className="space-y-3">
        {sites.map((site: any) => {
          const siteServices = services.filter((sv: any) => sv.site_id === site.id);
          return (
            <Card key={site.id} className="p-5 bg-card/60 backdrop-blur border-border/60">
              <div className="flex items-center gap-3 mb-2">
                {site.logo_url ? <img src={site.logo_url} alt="" className="h-8 w-8 rounded" /> : <div className="h-8 w-8 rounded bg-primary/15" />}
                <div>
                  <div className="font-semibold">{site.name}</div>
                  <div className="text-xs text-muted-foreground">{site.category || "—"}</div>
                </div>
                <div className="ms-auto text-xs text-muted-foreground">{siteServices.length} {t("servicesCount")}</div>
              </div>
              {siteServices.length > 0 && (
                <ul className="ms-11 mt-2 space-y-1 text-sm border-s border-border/60 ps-4">
                  {siteServices.map((sv: any) => (
                    <li key={sv.id} className="flex items-center gap-2">
                      <span className="text-primary">├─</span>
                      <span>{sv.name}</span>
                      {sv.tags?.length ? <span className="text-xs text-muted-foreground">({sv.tags.join(", ")})</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
        {!sites.length && <Card className="p-10 text-center text-sm text-muted-foreground">{t("noData")}</Card>}
      </div>
    </div>
  );
}
