import { createFileRoute } from "@tanstack/react-router";
import { useLanguage } from "@/i18n/LanguageProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Languages } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { t, lang, setLang } = useLanguage();
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">{t("settings")}</h1>
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
    </div>
  );
}
