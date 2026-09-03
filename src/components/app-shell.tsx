import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";
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
  ChevronDown,
  Network,
  Shield,
  Plug,
  Server,
  Database,
  Cloud,
  Cpu,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useLanguage } from "@/i18n/LanguageProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { TranslationKey } from "@/i18n/translations";

type SubItem = { key: TranslationKey; url: string };
type NavGroup = {
  key: TranslationKey;
  icon: typeof Brain;
  url: string;
  items: SubItem[];
};

const groups: NavGroup[] = [
  {
    key: "dashboard",
    icon: LayoutDashboard,
    url: "/dashboard",
    items: [
      { key: "navOverview", url: "/dashboard" },
      { key: "navStats", url: "/dashboard#stats" },
      { key: "navLiveActivity", url: "/dashboard#activity" },
    ],
  },
  {
    key: "navSitesMgmt",
    icon: Globe,
    url: "/sites",
    items: [
      { key: "sites", url: "/sites" },
      { key: "navManara", url: "/manara" },
      { key: "services", url: "/services" },
      { key: "navCategories", url: "/sites#categories" },
      { key: "navTags", url: "/sites#tags" },
    ],
  },
  {
    key: "navSystemFlow",
    icon: GitBranch,
    url: "/system-flow",
    items: [{ key: "navSystemFlow", url: "/system-flow" }],
  },
  {
    key: "navAgents",
    icon: Cpu,
    url: "/agents",
    items: [{ key: "navAgents", url: "/agents" }],
  },
  {
    key: "navServiceNetwork",
    icon: Network,
    url: "/network",
    items: [{ key: "navServiceNetwork", url: "/network" }],
  },
  {
    key: "navDiscoveryEngine",
    icon: Compass,
    url: "/discovery",
    items: [
      { key: "navDiscoverSites", url: "/discovery" },
      { key: "navSiteRegistry", url: "/registry" },
      { key: "navAnalyzeSites", url: "/discovery#analyze" },
      { key: "navRescan", url: "/discovery#rescan" },
      { key: "navDiscoveryResults", url: "/discovery#results" },
    ],
  },
  {
    key: "navOrchestratorEngine",
    icon: GitBranch,
    url: "/orchestrator",
    items: [
      { key: "navHubOrchestration", url: "/orchestration" },
      { key: "navServiceOrchestration", url: "/orchestrator" },
      { key: "navPipelines", url: "/pipelines" },
      { key: "navSubtasks", url: "/subtasks" },
      { key: "navProviders", url: "/providers" },
      { key: "navRequestsEngine", url: "/requests-engine" },
      { key: "navRoutingDecisions", url: "/routing-decisions" },
      { key: "navFallbackRules", url: "/fallback-rules" },
    ],
  },
  {
    key: "navApiGateway",
    icon: KeyRound,
    url: "/api-console",
    items: [
      { key: "navInternalConnectors", url: "/internal-connectors" },
      { key: "navGroupIdentifiers", url: "/identities" },
      { key: "navClients", url: "/api-console#clients" },
      { key: "apiKeys", url: "/api-console#keys" },
      { key: "navApiLogs", url: "/api-console#logs" },
      { key: "navRateLimits", url: "/api-console#limits" },
    ],
  },
  {
    key: "monitoring",
    icon: Activity,
    url: "/monitoring",
    items: [
      { key: "navServiceHealth", url: "/monitoring" },
      { key: "navSitePerformance", url: "/monitoring#performance" },
      { key: "navAlerts", url: "/monitoring#alerts" },
      { key: "navErrors", url: "/monitoring#errors" },
    ],
  },
  {
    key: "navKnowledgeBase",
    icon: BookOpen,
    url: "/knowledge",
    items: [
      { key: "navSiteProfiles", url: "/knowledge#profiles" },
      { key: "navDiscoveredServices", url: "/knowledge#services" },
      { key: "navDocs", url: "/knowledge#docs" },
      { key: "navSearchEngine", url: "/knowledge#search" },
    ],
  },
  {
    key: "navEcosystem",
    icon: Network,
    url: "/monitoring",
    items: [
      { key: "navTvcc", url: "/monitoring#tvcc" },
      { key: "navHnDb", url: "/monitoring#hn-db" },
      { key: "navHnCloud", url: "/monitoring#hn-cloud" },
      { key: "navHnCore", url: "/monitoring#hn-core" },
    ],
  },
  {
    key: "navIntegrations",
    icon: Plug,
    url: "/settings",
    items: [
      { key: "navTvcc", url: "/settings#tvcc" },
      { key: "navHnDb", url: "/settings#hn-db" },
      { key: "navHnCloud", url: "/settings#hn-cloud" },
      { key: "navHnCore", url: "/settings#hn-core" },
    ],
  },
  {
    key: "navAdministration",
    icon: Shield,
    url: "/admin-users",
    items: [
      { key: "navUsers", url: "/admin-users" },
      { key: "navRoles", url: "/admin-users" },
      { key: "settings", url: "/settings" },
      { key: "navBackup", url: "/settings#backup" },
    ],
  },
];

const ecosystemIcons: Record<string, typeof Brain> = {
  navTvcc: Server,
  navHnDb: Database,
  navHnCloud: Cloud,
  navHnCore: Cpu,
};

function NavGroupItem({ group, pathname }: { group: NavGroup; pathname: string }) {
  const { t } = useLanguage();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const isActiveGroup =
    pathname === group.url ||
    pathname.startsWith(group.url + "/") ||
    group.items.some((i) => i.url.split("#")[0] === pathname);
  const [open, setOpen] = useState(isActiveGroup);

  if (collapsed) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActiveGroup} tooltip={t(group.key)}>
          <Link to={group.url}>
            <group.icon className="h-4 w-4" />
            <span>{t(group.key)}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={isActiveGroup} className="w-full">
            <group.icon className="h-4 w-4" />
            <span className="flex-1 text-start">{t(group.key)}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {group.items.map((sub) => {
              const SubIcon = ecosystemIcons[sub.key];
              const subActive = pathname + (typeof window !== "undefined" ? window.location.hash : "") === sub.url;
              return (
                <SidebarMenuSubItem key={sub.url + sub.key}>
                  <SidebarMenuSubButton asChild isActive={subActive}>
                    <Link to={sub.url.split("#")[0]} hash={sub.url.split("#")[1]}>
                      {SubIcon && <SubIcon className="h-3.5 w-3.5" />}
                      <span>{t(sub.key)}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t, lang, setLang, dir } = useLanguage();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { next: undefined } });
  };

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
            <SidebarGroup>
              <SidebarGroupLabel>{t("appName")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {groups.map((g) => (
                    <NavGroupItem key={g.key} group={g} pathname={pathname} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
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
            <Button variant="ghost" size="sm" onClick={handleSignOut} aria-label={t("signOut")}>
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
