import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { findServiceByIntent } from "@/lib/services.functions";
import { useLanguage } from "@/i18n/LanguageProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GitBranch, Loader2, ArrowRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/orchestrator")({
  component: OrchestratorPage,
});

function OrchestratorPage() {
  const { t, dir } = useLanguage();
  const find = useServerFn(findServiceByIntent);
  const [intent, setIntent] = useState("");

  const mut = useMutation({
    mutationFn: () => find({ data: { intent } }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <GitBranch className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{t("orchestrator")}</h1>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => {
            const samples = [
              "أريد توليد شعار لمتجري الجديد",
              "ابنِ لي تطبيق APK",
              "أنشئ موقعًا لشركتي",
              "حوّل نصًا إلى صوت عربي",
              "ترجم مستندًا من الإنجليزية للعربية",
            ];
            const pick = samples[Math.floor(Math.random() * samples.length)];
            setIntent(pick);
            setTimeout(() => mut.mutate(), 50);
          }}
          disabled={mut.isPending}
        >
          <Loader2 className={`h-4 w-4 ${mut.isPending ? "animate-spin" : "hidden"}`} />
          توليد: مثال + بحث
        </Button>
      </div>


      <Card className="p-5 bg-card/60 backdrop-blur border-border/60 space-y-3">
        <label className="text-sm font-medium">{t("orchestrateIntent")}</label>
        <Textarea placeholder={t("intentPlaceholder")} value={intent} onChange={(e) => setIntent(e.target.value)} rows={3} />
        <Button onClick={() => mut.mutate()} disabled={mut.isPending || !intent.trim()}>
          {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("findService")}
        </Button>
      </Card>

      {mut.data && (
        <div className="space-y-2">
          <h2 className="font-semibold">{t("matchedService")}</h2>
          {!mut.data.length ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">{t("noData")}</Card>
          ) : (
            mut.data.map((m: any) => (
              <Card key={m.service.id} className="p-4 bg-card/60 backdrop-blur border-border/60">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold">{m.service.name}</div>
                    <div className="text-xs text-muted-foreground">{m.service.sites?.name} • {m.service.category}</div>
                    {m.service.description && <p className="text-sm text-muted-foreground mt-1">{m.service.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-primary">
                    match: {m.score}
                    <ArrowRight className={`h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`} />
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
