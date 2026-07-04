import { createFileRoute } from "@tanstack/react-router";
import { useLanguage } from "@/i18n/LanguageProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Languages, Plug, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import { GenerateButton } from "@/components/generate-button";

import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { listIntegrations, testIntegration } from "@/lib/integrations.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

const HUB_LABELS: Record<string, { name: string; role: string }> = {
  tvcc: { name: "TVCC", role: "Sites gateway" },
  hn_db: { name: "HN-DB", role: "Database hub" },
  hn_cloud: { name: "HN-Cloud", role: "Files & backups" },
  hn_core: { name: "HN Core", role: "Roles & policies" },
};

function SettingsPage() {
  const { t, lang, setLang } = useLanguage();
  const list = useServerFn(listIntegrations);
  const test = useServerFn(testIntegration);
  const { data: hubs = [], refetch } = useQuery({
    queryKey: ["integrations"],
    queryFn: () => list(),
  });

  const testMut = useMutation({
    mutationFn: (hub: string) => test({ data: { hub: hub as any } }),
    onSuccess: (r, hub) => {
      if (r.ok) toast.success(`${HUB_LABELS[hub].name}: ${r.status} (${r.latency_ms}ms)`);
      else toast.error(`${HUB_LABELS[hub].name}: ${r.error ?? r.status}`);
      refetch();
    },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{t("settings")}</h1>
        </div>
        <GenerateButton
          label="توليد: افحص كل التكاملات"
          pendingLabel="جاري الفحص…"
          onGenerate={async () => {
            const hubs = ["tvcc", "hn_db", "hn_cloud", "hn_core"];
            const results = await Promise.all(hubs.map((h) => test({ data: { hub: h as any } }).catch((e) => ({ ok: false, error: e?.message }))));
            const ok = results.filter((r: any) => r.ok).length;
            return { ok, total: hubs.length };
          }}
          onDone={() => refetch()}
          successMessage={(r: any) => `تكاملات ناجحة: ${r.ok}/${r.total}`}
        />
      </div>


      <Card className="p-5 bg-card/60 backdrop-blur border-border/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Languages className="h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold">{t("language")}</div>
              <div className="text-xs text-muted-foreground">{lang === "ar" ? t("arabic") : t("english")}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant={lang === "ar" ? "default" : "outline"} size="sm" onClick={() => setLang("ar")}>العربية</Button>
            <Button variant={lang === "en" ? "default" : "outline"} size="sm" onClick={() => setLang("en")}>English</Button>
          </div>
        </div>
      </Card>

      <div>
        <div className="flex items-center gap-3 mb-3">
          <Plug className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Integrations</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          {lang === "ar"
            ? "يعتمد HN Service Hub على هذه المراكز. اضبط الأسرار (URL + API Key) في لوحة تحكم Lovable Cloud ثم اختبر الاتصال."
            : "HN Service Hub relies on these hubs. Configure the secrets (URL + API Key) in the Lovable Cloud dashboard, then test each connection."}
        </p>
        <div className="grid gap-3">
          {hubs.map((h: any) => (
            <Card key={h.hub} className="p-4 bg-card/60 backdrop-blur border-border/60">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{HUB_LABELS[h.hub].name}</span>
                    <span className="text-xs text-muted-foreground">— {HUB_LABELS[h.hub].role}</span>
                    {h.last_status?.startsWith("ok") ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> {h.last_status}
                      </span>
                    ) : h.last_status ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-red-500/15 text-red-400">
                        <XCircle className="h-3 w-3" /> {h.last_status}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        <AlertCircle className="h-3 w-3" /> untested
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-mono text-muted-foreground mt-1 truncate">
                    {h.base_url ?? <span className="italic">URL not configured</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    API key: {h.has_key ? "✓ set" : "✗ missing"}
                    {h.last_checked_at && <> · checked {new Date(h.last_checked_at).toLocaleString()}</>}
                  </div>
                  {h.last_error && <div className="text-xs text-red-400 mt-1">{h.last_error}</div>}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={testMut.isPending || !h.base_url}
                  onClick={() => testMut.mutate(h.hub)}
                >
                  {testMut.isPending && testMut.variables === h.hub ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Test"
                  )}
                </Button>
              </div>
            </Card>
          ))}
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          {lang === "ar"
            ? "الأسرار المطلوبة: TVCC_API_URL/KEY، HN_DB_API_URL/KEY، HN_CLOUD_API_URL/KEY، HN_CORE_URL/API_KEY، HN_API_KEY، HN_SERVICE_HUB_SECRET."
            : "Required secrets: TVCC_API_URL/KEY, HN_DB_API_URL/KEY, HN_CLOUD_API_URL/KEY, HN_CORE_URL/API_KEY, HN_API_KEY, HN_SERVICE_HUB_SECRET."}
        </div>
      </div>
    </div>
  );
}
