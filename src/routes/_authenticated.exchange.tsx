import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { listExchangeCatalog, listSyncRuns, runGroupSync } from "@/lib/group-exchange.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Share2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/exchange")({
  component: ExchangePage,
});

function ExchangePage() {
  const catalog = useServerFn(listExchangeCatalog);
  const runs = useServerFn(listSyncRuns);
  const sync = useServerFn(runGroupSync);

  const { data: sites = [], refetch } = useQuery({
    queryKey: ["exchange-catalog"],
    queryFn: () => catalog(),
  });
  const { data: syncRuns = [], refetch: refetchRuns } = useQuery({
    queryKey: ["group-sync-runs"],
    queryFn: () => runs(),
  });

  const syncMut = useMutation({
    mutationFn: () => sync(),
    onSuccess: (r: any) => {
      toast.success(
        `استيراد: +${r.import.imported} / ~${r.import.updated} • تصدير: ${r.export.exported}`,
      );
      refetch();
      refetchRuns();
    },
    onError: (e: any) => toast.error(e.message ?? "فشلت المزامنة"),
  });

  const totalServices = sites.reduce((n: number, s: any) => n + (s.services?.length ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Share2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">الخدمات المتبادلة</h1>
            <p className="text-xs text-muted-foreground">
              لائحة مواقع مجموعة HN المستوردة من TVCC وخدماتها المتاحة للتبادل
            </p>
          </div>
        </div>
        <Button onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
          {syncMut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 me-1" />
          )}
          مزامنة الآن مع TVCC
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4 bg-card/60 backdrop-blur border-border/60">
          <div className="text-xs text-muted-foreground">المواقع</div>
          <div className="text-2xl font-bold">{sites.length}</div>
        </Card>
        <Card className="p-4 bg-card/60 backdrop-blur border-border/60">
          <div className="text-xs text-muted-foreground">الخدمات المتبادلة</div>
          <div className="text-2xl font-bold">{totalServices}</div>
        </Card>
        <Card className="p-4 bg-card/60 backdrop-blur border-border/60">
          <div className="text-xs text-muted-foreground">آخر مزامنة</div>
          <div className="text-sm font-medium">
            {syncRuns[0] ? new Date(syncRuns[0].created_at).toLocaleString() : "—"}
          </div>
        </Card>
      </div>

      <div className="space-y-3">
        {sites.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            لا توجد مواقع بعد — اضغط «مزامنة الآن» لاستيراد اللائحة من TVCC.
          </Card>
        ) : (
          sites.map((s: any) => (
            <Card key={s.id} className="p-4 bg-card/60 backdrop-blur border-border/60">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <a
                    className="text-xs text-muted-foreground hover:text-primary"
                    href={s.base_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {s.base_url}
                  </a>
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-primary/15 text-primary">
                  {s.services?.length ?? 0} خدمة
                </span>
              </div>
              {!!s.services?.length && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {s.services.map((svc: any) => (
                    <span
                      key={svc.id}
                      className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground"
                      title={svc.description ?? ""}
                    >
                      {svc.name}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      <div>
        <h2 className="font-semibold mb-2">سجل المزامنة</h2>
        {!syncRuns.length ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">لا يوجد سجل بعد</Card>
        ) : (
          <div className="space-y-2">
            {syncRuns.map((r: any) => (
              <Card
                key={r.id}
                className="p-3 bg-card/60 backdrop-blur border-border/60 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {r.direction === "import" ? "استيراد" : "تصدير"} · {r.source}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                    {r.direction === "import"
                      ? ` • +${r.imported} / ~${r.updated}`
                      : ` • ${r.exported} موقع`}
                    {r.error ? ` • ${r.error}` : ""}
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    r.status === "success"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-red-500/15 text-red-400"
                  }`}
                >
                  {r.status}
                </span>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
