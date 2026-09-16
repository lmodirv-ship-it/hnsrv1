import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  exchangeStatus,
  importSitesText,
  listExchangeCatalog,
  listSyncRuns,
  mergeDuplicates,
  runGroupSync,
} from "@/lib/group-exchange.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Merge, RefreshCw, Share2, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/exchange")({
  component: ExchangePage,
});

function ExchangePage() {
  const catalog = useServerFn(listExchangeCatalog);
  const runs = useServerFn(listSyncRuns);
  const sync = useServerFn(runGroupSync);
  const statusFn = useServerFn(exchangeStatus);
  const importFn = useServerFn(importSitesText);
  const mergeFn = useServerFn(mergeDuplicates);

  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: sites = [], refetch } = useQuery({
    queryKey: ["exchange-catalog"],
    queryFn: () => catalog(),
  });
  const { data: syncRuns = [], refetch: refetchRuns } = useQuery({
    queryKey: ["group-sync-runs"],
    queryFn: () => runs(),
  });
  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ["exchange-status"],
    queryFn: () => statusFn(),
  });

  const refreshAll = () => {
    refetch();
    refetchRuns();
    refetchStatus();
  };

  const syncMut = useMutation({
    mutationFn: () => sync(),
    onSuccess: (r: any) => {
      if (r.import.ok) {
        toast.success(`استيراد: +${r.import.imported} / ~${r.import.updated} • تصدير: ${r.export.exported}`);
      } else {
        toast.error("تعذّر الوصول إلى TVCC — استخدم الاستيراد اليدوي بالأسفل");
      }
      refreshAll();
    },
    onError: (e: any) => toast.error(e.message ?? "فشلت المزامنة"),
  });

  const importMut = useMutation({
    mutationFn: (payload: string) => importFn({ data: { text: payload } }),
    onSuccess: (r: any) => {
      toast.success(`تم الاستيراد: +${r.imported} جديد / ~${r.updated} محدّث`);
      setText("");
      refreshAll();
    },
    onError: (e: any) => toast.error(e.message ?? "فشل الاستيراد"),
  });

  const mergeMut = useMutation({
    mutationFn: () => mergeFn(),
    onSuccess: (r: any) => {
      toast.success(r.merged ? `تم دمج ${r.merged} نسخة مكررة` : "لا توجد نسخ مكررة");
      refreshAll();
    },
    onError: (e: any) => toast.error(e.message ?? "فشل الدمج"),
  });

  const onFile = async (file?: File | null) => {
    if (!file) return;
    const content = await file.text();
    importMut.mutate(content);
  };

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
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => mergeMut.mutate()} disabled={mergeMut.isPending}>
            {mergeMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Merge className="h-4 w-4 me-1" />
            )}
            دمج المكرر
          </Button>
          <Button onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
            {syncMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 me-1" />
            )}
            مزامنة الآن مع TVCC
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="p-4 bg-card/60 backdrop-blur border-border/60">
          <div className="text-xs text-muted-foreground">المواقع</div>
          <div className="text-2xl font-bold">{sites.length}</div>
        </Card>
        <Card className="p-4 bg-card/60 backdrop-blur border-border/60">
          <div className="text-xs text-muted-foreground">الخدمات المتبادلة</div>
          <div className="text-2xl font-bold">{totalServices}</div>
        </Card>
        <Card className="p-4 bg-card/60 backdrop-blur border-border/60">
          <div className="text-xs text-muted-foreground">قادمة من TVCC</div>
          <div className="text-2xl font-bold">{status?.fromTvcc ?? 0}</div>
        </Card>
        <Card className="p-4 bg-card/60 backdrop-blur border-border/60">
          <div className="text-xs text-muted-foreground">آخر استيراد / تصدير</div>
          <div className="text-xs font-medium">
            {status?.lastImport ? new Date(status.lastImport.created_at).toLocaleString() : "—"}
          </div>
          <div className="text-xs text-muted-foreground">
            {status?.lastExport ? new Date(status.lastExport.created_at).toLocaleString() : "—"}
          </div>
          {status?.lastImport?.error ? (
            <div className="text-[11px] text-red-400 mt-1 truncate" title={status.lastImport.error}>
              {status.lastImport.error}
            </div>
          ) : null}
        </Card>
      </div>

      <Card className="p-4 bg-card/60 backdrop-blur border-border/60 space-y-3">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary" />
          <div className="font-semibold text-sm">استيراد لائحة المواقع يدوياً</div>
        </div>
        <p className="text-xs text-muted-foreground">
          الصق اللائحة (JSON أو CSV أو رابط في كل سطر) أو ارفع ملفاً — تُدمج مع المواقع الحالية بدون تكرار.
        </p>
        <Textarea
          dir="ltr"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'[{"name":"موقع","url":"https://example.com","id":"123"}]'}
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => importMut.mutate(text)}
            disabled={!text.trim() || importMut.isPending}
          >
            {importMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "استيراد"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.csv,.txt"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            رفع ملف
          </Button>
        </div>
      </Card>

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
