import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { discoverSite, listDiscoveryJobs } from "@/lib/discovery.functions";
import { syncSitesFromTvcc } from "@/lib/integrations.functions";
import { useLanguage } from "@/i18n/LanguageProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Compass, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/discovery")({
  component: DiscoveryPage,
});

function DiscoveryPage() {
  const { t } = useLanguage();
  const list = useServerFn(listDiscoveryJobs);
  const run = useServerFn(discoverSite);
  const tvccSync = useServerFn(syncSitesFromTvcc);
  const { data: jobs = [], refetch } = useQuery({ queryKey: ["discovery-jobs"], queryFn: () => list() });
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<any>(null);

  const mut = useMutation({
    mutationFn: () => run({ data: { url } }),
    onSuccess: (r) => { setResult(r.result); refetch(); },
    onError: (e: any) => toast.error(e.message ?? t("somethingWentWrong")),
  });

  const syncMut = useMutation({
    mutationFn: () => tvccSync(),
    onSuccess: (r) => toast.success(`TVCC: +${r.inserted} / ~${r.updated} of ${r.count}`),
    onError: (e: any) => toast.error(e.message ?? t("somethingWentWrong")),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Compass className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">{t("discovery")}</h1>
      </div>

      <Card className="p-5 bg-card/60 backdrop-blur border-border/60 space-y-3">
        <div className="flex gap-2">
          <Input placeholder={t("discoverUrl")} value={url} onChange={(e) => setUrl(e.target.value)} type="url" />
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !url}>
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("discover")}
          </Button>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <div className="text-xs text-muted-foreground">Pull the master site list from TVCC</div>
          <Button variant="outline" size="sm" onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
            {syncMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Sync from TVCC
          </Button>
        </div>
      </Card>

      {result && (
        <Card className="p-5 bg-card/60 backdrop-blur border-border/60 space-y-3">
          <h2 className="font-semibold">{t("result")}</h2>
          {result.meta?.title && <div><span className="text-xs text-muted-foreground">Title:</span> <span className="font-medium">{result.meta.title}</span></div>}
          {result.meta?.description && <p className="text-sm text-muted-foreground">{result.meta.description}</p>}
          {result.api_hints?.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">API hints:</div>
              <div className="flex flex-wrap gap-2">
                {result.api_hints.map((h: any) => (
                  <span key={h.path} className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">{h.path}</span>
                ))}
              </div>
            </div>
          )}
          {result.sample_links?.length > 0 && (
            <details>
              <summary className="text-sm cursor-pointer text-muted-foreground">Links ({result.sample_links.length})</summary>
              <div className="mt-2 space-y-1 text-xs">
                {result.sample_links.slice(0, 10).map((l: string) => <div key={l} className="truncate text-muted-foreground">{l}</div>)}
              </div>
            </details>
          )}
        </Card>
      )}

      <div>
        <h2 className="font-semibold mb-2">Recent jobs</h2>
        {!jobs.length ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">{t("noData")}</Card>
        ) : (
          <div className="space-y-2">
            {jobs.map((j: any) => (
              <Card key={j.id} className="p-3 bg-card/60 backdrop-blur border-border/60 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{j.url}</div>
                  <div className="text-xs text-muted-foreground">{new Date(j.created_at).toLocaleString()}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${j.status === "completed" ? "bg-emerald-500/15 text-emerald-400" : j.status === "failed" ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"}`}>{j.status}</span>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
