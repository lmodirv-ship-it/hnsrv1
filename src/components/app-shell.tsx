import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Brain,
  LayoutDashboard,
  Globe,
  Boxes,
  Compass,
  GitBranch,
  KeyRound,
  Activity,
  BookOpen,
  Settings,
  LogOut,
  Languages,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useLanguage } from "@/i18n/LanguageProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { TranslationKey } from "@/i18n/translations";

type NavItem = { key: TranslationKey; url: string; icon: typeof Brain };

const primary: NavItem[] = [
  { key: "dashboard", url: "/dashboard", icon: LayoutDashboard },
  { key: "sites", url: "/sites", icon: Globe },
  { key: "services", url: "/services", icon: Boxes },
];

const orchestration: NavItem[] = [
  { key: "discovery", url: "/discovery", icon: Compass },
  { key: "orchestrator", url: "/orchestrator", icon: GitBranch },
  { key: "monitoring", url: "/monitoring", icon: Activity },
];

const developer: NavItem[] = [
  { key: "apiConsole", url: "/api-console", icon: KeyRound },
  { key: "knowledge", url: "/knowledge", icon: BookOpen },
  { key: "settings", url: "/settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { t, lang, setLang, dir } = useLanguage();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/");

  const renderGroup = (label: TranslationKey | null, items: NavItem[]) => (
    <SidebarGroup>
      {label && <SidebarGroupLabel>{t(label)}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={isActive(item.url)}>
                <Link to={item.url} className="flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  <span>{t(item.key)}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <SidebarProvider>
      <div dir={dir} className="min-h-screen flex w-full bg-background">
        <Sidebar side={dir === "rtl" ? "right" : "left"} collapsible="icon">
          <SidebarHeader className="border-b border-sidebar-border">
            <div className="flex items-center gap-2 px-2 py-2">
              <div className="h-8 w-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                <Brain className="h-4 w-4 text-primary" />
              </div>
              <div className="flex flex-col leading-tight overflow-hidden">
                <span className="text-sm font-bold truncate">{t("appName")}</span>
                <span className="text-[10px] text-muted-foreground truncate">
                  {t("appTagline")}
                </span>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            {renderGroup(null, primary)}
            {renderGroup("orchestrator", orchestration)}
            {renderGroup("apiConsole", developer)}
          </SidebarContent>
          <SidebarFooter className="border-t border-sidebar-border">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
                  <Languages className="h-4 w-4" />
                  <span>{lang === "ar" ? "English" : "العربية"}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                  <span>{t("signOut")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border/60 backdrop-blur bg-background/70 sticky top-0 z-10 flex items-center px-4 gap-3">
            <SidebarTrigger />
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{t("signOut")}</span>
            </Button>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
