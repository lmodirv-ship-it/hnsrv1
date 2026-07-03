import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useLanguage } from "@/i18n/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Brain, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — HN Service Hub" },
      {
        name: "description",
        content:
          "Sign in or create an HN Service Hub account to orchestrate services, manage API keys, and monitor the HN ecosystem.",
      },
      { property: "og:title", content: "Sign in — HN Service Hub" },
      {
        property: "og:description",
        content: "Access your HN Service Hub workspace to orchestrate services and manage API keys.",
      },
      { property: "og:url", content: "https://hn-mind-hub.lovable.app/auth" },
    ],
    links: [{ rel: "canonical", href: "https://hn-mind-hub.lovable.app/auth" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t, lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success(t("checkEmail"));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (msg.toLowerCase().includes("already")) toast.error(t("emailInUse"));
      else if (msg.toLowerCase().includes("invalid")) toast.error(t("invalidCredentials"));
      else toast.error(msg || t("somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err?.message ?? t("somethingWentWrong"));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="font-bold text-lg leading-tight">{t("appName")}</div>
              <div className="text-xs text-muted-foreground">{t("appTagline")}</div>
            </div>
          </div>
          <button
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1"
          >
            {lang === "ar" ? "EN" : "ع"}
          </button>
        </div>

        <Card className="p-6 bg-card/60 backdrop-blur border-border/60">
          <h1 className="text-2xl font-bold">{t("loginTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("loginSubtitle")}</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">{t("displayName")}</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
              </div>
            )}
            <div>
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? t("signIn") : t("signUp")}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px bg-border flex-1" />
            <span className="text-xs text-muted-foreground">{t("or")}</span>
            <div className="h-px bg-border flex-1" />
          </div>

          <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
            </svg>
            {t("continueWithGoogle")}
          </Button>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? t("newHere") : t("haveAccount")}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-primary hover:underline font-medium"
            >
              {mode === "signin" ? t("signUp") : t("signIn")}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
