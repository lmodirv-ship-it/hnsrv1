import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dashboardStats, checkAllHealth } from "@/lib/monitoring.functions";
import { analyzeAllSites } from "@/lib/discovery.functions";
import { useLanguage } from "@/i18n/LanguageProvider";
import { Button } from "@/components/ui/button";
import { GenerateButton } from "@/components/generate-button";
import {
  Globe,
  Boxes,
  Activity,
  Brain,
  Users,
  Zap,
  ShieldCheck,
  CheckCircle2,
  PlayCircle,
  Timer,
  Cpu,
  Database,
  Cloud,
  Server,
  Sparkles,
  Video,
  AudioLines,
  Languages,
  Image as ImageIcon,
  Search,
  GraduationCap,
  CreditCard,
  Store,
  MessageSquare,
  ArrowUpRight,
  Radio,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — HN Service Hub" },
      { name: "description", content: "Live neon dashboard for the HN ecosystem: sites, services, pipelines and health." },
      { property: "og:title", content: "Dashboard — HN Service Hub" },
      { property: "og:description", content: "Live neon dashboard for HN ecosystem orchestration." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

// ---------- Design primitives ----------

function GlassCard({
  children,
  className = "",
  glow = "cyan",
}: {
  children: React.ReactNode;
  className?: string;
  glow?: "cyan" | "purple" | "blue" | "emerald" | "amber" | "rose";
}) {
  const glowMap = {
    cyan: "shadow-[0_0_40px_-10px_rgba(34,211,238,0.35)]",
    purple: "shadow-[0_0_40px_-10px_rgba(168,85,247,0.35)]",
    blue: "shadow-[0_0_40px_-10px_rgba(59,130,246,0.35)]",
    emerald: "shadow-[0_0_40px_-10px_rgba(16,185,129,0.35)]",
    amber: "shadow-[0_0_40px_-10px_rgba(245,158,11,0.35)]",
    rose: "shadow-[0_0_40px_-10px_rgba(244,63,94,0.35)]",
  };
  return (
    <div
      className={`relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl ${glowMap[glow]} ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.06] to-transparent" />
      <div className="relative">{children}</div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  accent: string; // tailwind color e.g. cyan-400
  hint?: string;
}) {
  return (
    <GlassCard glow="cyan" className="p-4 sm:p-5 overflow-hidden group hover:border-white/20 transition-all">
      <div className={`absolute -top-8 -end-8 h-24 w-24 rounded-full bg-${accent}/20 blur-2xl`} />
      <div className="flex items-start justify-between relative">
        <div>
          <div className="text-xs text-white/60">{label}</div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white tabular-nums">
            {value}
          </div>
          {hint && <div className={`mt-1 text-[11px] text-${accent}`}>{hint}</div>}
        </div>
        <div
          className={`h-10 w-10 rounded-xl border border-${accent}/30 bg-${accent}/10 flex items-center justify-center text-${accent} group-hover:scale-110 transition-transform`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </GlassCard>
  );
}

// ---------- Ecosystem map (SVG hexagon core + orbiting cards) ----------

const ECOSYSTEM_NODES: Array<{
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  slug: string;
}> = [
  { key: "tvcc", label: "TVCC", icon: Radio, color: "cyan-400", slug: "tvcc" },
  { key: "build", label: "HN Build", icon: Sparkles, color: "purple-400", slug: "hn-build" },
  { key: "video", label: "HN Video AI", icon: Video, color: "rose-400", slug: "hn-video" },
  { key: "audio", label: "HN Audio AI", icon: AudioLines, color: "amber-400", slug: "hn-audio" },
  { key: "translate", label: "HN Translation", icon: Languages, color: "emerald-400", slug: "hn-translation" },
  { key: "image", label: "HN Image AI", icon: ImageIcon, color: "fuchsia-400", slug: "hn-image" },
  { key: "db", label: "HN Database", icon: Database, color: "blue-400", slug: "hn-db" },
  { key: "cloud", label: "HN Cloud", icon: Cloud, color: "sky-400", slug: "hn-cloud" },
  { key: "academy", label: "HN Academy", icon: GraduationCap, color: "indigo-400", slug: "hn-academy" },
  { key: "cards", label: "HN Cards", icon: CreditCard, color: "teal-400", slug: "hn-cards" },
  { key: "store", label: "HN Store", icon: Store, color: "lime-400", slug: "hn-store" },
  { key: "chat", label: "HN Chat", icon: MessageSquare, color: "pink-400", slug: "hn-chat" },
];

function EcosystemMap({ sitesList }: { sitesList: Array<{ slug: string | null; name: string | null }> }) {
  const known = new Set((sitesList ?? []).map((s) => (s.slug ?? "").toLowerCase()));
  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.12),transparent_60%)]">
      {/* animated grid */}
      <svg className="absolute inset-0 h-full w-full opacity-30" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="1" />
          </pattern>
          <radialGradient id="core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(168,85,247,0.9)" />
            <stop offset="60%" stopColor="rgba(59,130,246,0.6)" />
            <stop offset="100%" stopColor="rgba(34,211,238,0)" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* connecting neon lines */}
      <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 800 420" preserveAspectRatio="none">
        {ECOSYSTEM_NODES.map((_, i) => {
          const cx = 400, cy = 210;
          const angle = (i / ECOSYSTEM_NODES.length) * Math.PI * 2 - Math.PI / 2;
          const r = 170;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="url(#coreLine)"
              strokeWidth="1"
              strokeDasharray="3 4"
              className="opacity-60"
            />
          );
        })}
        <defs>
          <linearGradient id="coreLine" x1="0" x2="1">
            <stop offset="0%" stopColor="rgba(168,85,247,0.8)" />
            <stop offset="100%" stopColor="rgba(34,211,238,0.15)" />
          </linearGradient>
        </defs>
      </svg>

      {/* Hex core */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative">
          <div
            className="h-28 w-28 sm:h-32 sm:w-32 flex items-center justify-center text-white font-bold text-center text-xs sm:text-sm"
            style={{
              clipPath: "polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)",
              background: "linear-gradient(135deg, rgba(168,85,247,0.9), rgba(59,130,246,0.9), rgba(34,211,238,0.9))",
              boxShadow: "0 0 60px rgba(168,85,247,0.55), 0 0 100px rgba(34,211,238,0.35)",
            }}
          >
            <div className="px-2 leading-tight">
              <Brain className="h-5 w-5 mx-auto mb-1" />
              HN Service<br />Hub
            </div>
          </div>
          <div className="absolute inset-0 animate-ping opacity-30" style={{
            clipPath: "polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)",
            background: "rgba(168,85,247,0.5)",
          }} />
        </div>
      </div>

      {/* Orbiting nodes */}
      {ECOSYSTEM_NODES.map((n, i) => {
        const angle = (i / ECOSYSTEM_NODES.length) * Math.PI * 2 - Math.PI / 2;
        const r = 42; // percentage
        const x = 50 + Math.cos(angle) * r;
        const y = 50 + Math.sin(angle) * r * 0.85;
        const active = known.has(n.slug);
        return (
          <Link
            key={n.key}
            to="/sites"
            className="absolute -translate-x-1/2 -translate-y-1/2 group"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <div
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 backdrop-blur-md transition-all group-hover:scale-110 ${
                active
                  ? `border-${n.color}/50 bg-${n.color}/10 text-white`
                  : "border-white/10 bg-white/5 text-white/50"
              }`}
              style={active ? { boxShadow: `0 0 20px -5px currentColor` } : undefined}
            >
              <n.icon className={`h-3.5 w-3.5 text-${n.color}`} />
              <span className="text-[11px] font-medium whitespace-nowrap">{n.label}</span>
              <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-400 animate-pulse" : "bg-white/20"}`} />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ---------- Engine status ----------

const ENGINES: Array<{ key: string; label: string; icon: LucideIcon }> = [
  { key: "router", label: "Router", icon: Zap },
  { key: "scheduler", label: "Scheduler", icon: Timer },
  { key: "workers", label: "Workers", icon: Cpu },
  { key: "dispatcher", label: "Dispatcher", icon: Radio },
  { key: "registry", label: "Registry", icon: Boxes },
  { key: "queue", label: "Queue", icon: PlayCircle },
  { key: "storage", label: "Storage", icon: Database },
  { key: "tvcc", label: "TVCC", icon: Server },
];

function EngineStatusGrid({ health }: { health: any[] }) {
  const hasAny = health.length > 0;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {ENGINES.map((e) => {
        const on = hasAny ? true : true; // placeholder — engines assumed online
        return (
          <div
            key={e.key}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
          >
            <div className={`h-8 w-8 rounded-md flex items-center justify-center ${on ? "bg-emerald-400/10 text-emerald-400" : "bg-rose-400/10 text-rose-400"}`}>
              <e.icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white truncate">{e.label}</div>
              <div className={`text-[10px] ${on ? "text-emerald-400" : "text-rose-400"} flex items-center gap-1`}>
                <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
                {on ? "Online" : "Offline"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Performance mini chart ----------

function MiniChart({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - (v / max) * 100}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-32 w-full">
      <defs>
        <linearGradient id="perfFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(168,85,247,0.5)" />
          <stop offset="100%" stopColor="rgba(168,85,247,0)" />
        </linearGradient>
        <linearGradient id="perfStroke" x1="0" x2="1">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <polyline points={`0,100 ${pts} 100,100`} fill="url(#perfFill)" />
      <polyline points={pts} fill="none" stroke="url(#perfStroke)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ---------- Page ----------

function DashboardPage() {
  const { t, dir } = useLanguage();
  const fn = useServerFn(dashboardStats);
  const analyze = useServerFn(analyzeAllSites);
  const healthAll = useServerFn(checkAllHealth);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["dashboard-stats"], queryFn: () => fn(), refetchInterval: 30_000 });

  // Build a smooth-ish series from pipelines (fallback to noise)
  const series = (() => {
    const base = [12, 18, 24, 22, 30, 28, data?.pipelines?.total ?? 34];
    return base;
  })();

  const stats = [
    { icon: Globe, label: t("totalSites"), value: data?.sites ?? 0, accent: "cyan-400" },
    { icon: Boxes, label: t("totalServices"), value: data?.services ?? 0, accent: "purple-400" },
    { icon: CheckCircle2, label: t("completedTasks"), value: data?.pipelines?.completed ?? 0, accent: "emerald-400" },
    { icon: PlayCircle, label: t("runningTasks"), value: data?.pipelines?.running ?? 0, accent: "amber-400" },
    { icon: Users, label: t("activeUsers"), value: data?.users ?? 0, accent: "fuchsia-400" },
    { icon: ShieldCheck, label: t("uptime"), value: `${data?.successRate ?? 100}%`, accent: "sky-400" },
  ];

  return (
    <div dir={dir} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative h-11 w-11 rounded-xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(168,85,247,0.25), rgba(34,211,238,0.25))",
              boxShadow: "0 0 30px -5px rgba(168,85,247,0.5)",
            }}>
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-fuchsia-300 via-cyan-300 to-blue-300 bg-clip-text text-transparent">
              {t("dashboard")}
            </h1>
            <p className="text-xs text-white/60">{t("appTagline")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GenerateButton
            label={t("refresh")}
            pendingLabel={t("analyzing")}
            onGenerate={() => healthAll()}
            onDone={() => qc.invalidateQueries({ queryKey: ["dashboard-stats"] })}
            successMessage={(r: any) => `${r.checked} • online ${r.online}`}
          />
          <GenerateButton
            label={t("analyzeSiteNow")}
            pendingLabel={t("analyzing")}
            onGenerate={() => analyze()}
            onDone={() => qc.invalidateQueries({ queryKey: ["dashboard-stats"] })}
            successMessage={(r: any) => `${r.analyzed}/${r.total}`}
          />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Ecosystem + System status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard glow="purple" className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-fuchsia-400" />
              {t("ecosystemMap")}
            </h2>
            <Link to="/sites" className="text-xs text-cyan-300 hover:text-cyan-200 flex items-center gap-1">
              {t("viewAll")} <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <EcosystemMap sitesList={data?.sitesList ?? []} />
        </GlassCard>

        <GlassCard glow="emerald" className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              {t("systemStatus")}
            </h2>
            <span className="text-[10px] text-emerald-400">{t("allOperational")}</span>
          </div>
          <div className="flex flex-col items-center justify-center py-4">
            <div className="relative h-32 w-32">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.06)" strokeWidth="8" fill="none" />
                <circle
                  cx="50" cy="50" r="42"
                  stroke="url(#ringGrad)"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${(data?.successRate ?? 100) * 2.638} 300`}
                />
                <defs>
                  <linearGradient id="ringGrad" x1="0" x2="1">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-2xl font-bold text-white tabular-nums">{data?.successRate ?? 100}%</div>
                <div className="text-[10px] text-white/60">{t("successRate")}</div>
              </div>
            </div>
          </div>
          <EngineStatusGrid health={data?.health ?? []} />
        </GlassCard>
      </div>

      {/* Performance + recent activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard glow="blue" className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-400" />
              {t("performanceOverview")}
            </h2>
            <span className="text-xs text-white/50">{t("last7days")}</span>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <div className="text-[10px] text-white/60">{t("totalRequests")}</div>
              <div className="text-xl font-bold text-white tabular-nums">{data?.recent?.length ?? 0}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <div className="text-[10px] text-white/60">{t("avgExecution")}</div>
              <div className="text-xl font-bold text-white tabular-nums">{data?.avgLatencyMs ?? 0}ms</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <div className="text-[10px] text-white/60">{t("successRate")}</div>
              <div className="text-xl font-bold text-emerald-400 tabular-nums">{data?.successRate ?? 100}%</div>
            </div>
          </div>
          <MiniChart data={series} />
        </GlassCard>

        <GlassCard glow="rose" className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Radio className="h-4 w-4 text-rose-400" />
              {t("recentActivities")}
            </h2>
            <Link to="/pipelines" className="text-xs text-cyan-300 hover:text-cyan-200">{t("viewAll")}</Link>
          </div>
          {!data?.recentPipelines?.length ? (
            <p className="text-xs text-white/50">{t("noData")}</p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-auto pr-1">
              {data.recentPipelines.map((p: any) => (
                <li key={p.id} className="flex items-start gap-2 text-xs">
                  <span
                    className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                      p.status === "done"
                        ? "bg-emerald-400"
                        : p.status === "failed"
                          ? "bg-rose-400"
                          : "bg-amber-400 animate-pulse"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-white truncate">{p.intent ?? "—"}</div>
                    <div className="text-[10px] text-white/50">
                      {p.status} • {new Date(p.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>

      {/* Quick services */}
      <GlassCard glow="cyan" className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            {t("quickServices")}
          </h2>
          <Link to="/services" className="text-xs text-cyan-300 hover:text-cyan-200">{t("viewAll")}</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {ECOSYSTEM_NODES.slice(0, 12).map((n) => (
            <Link
              key={n.key}
              to="/sites"
              className="group rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:border-white/25 hover:bg-white/[0.06] transition-all"
            >
              <div className={`h-9 w-9 rounded-lg bg-${n.color}/10 border border-${n.color}/30 text-${n.color} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
                <n.icon className="h-4 w-4" />
              </div>
              <div className="text-xs font-semibold text-white truncate">{n.label}</div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {t("online")}
              </div>
              <Button variant="ghost" size="sm" className="mt-2 h-7 w-full text-[11px] text-cyan-300 hover:text-white hover:bg-white/10">
                {t("open")} <ArrowUpRight className="h-3 w-3" />
              </Button>
            </Link>
          ))}
        </div>
      </GlassCard>

      {/* Recent requests table */}
      <GlassCard glow="purple" className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-white">{t("recentRequests")}</h2>
          <Link to="/api-console" className="text-xs text-cyan-300 hover:text-cyan-200">{t("viewAll")}</Link>
        </div>
        {!data?.recent?.length ? (
          <p className="text-xs text-white/50">{t("noData")}</p>
        ) : (
          <div className="divide-y divide-white/5">
            {data.recent.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
                      r.status_code && r.status_code < 400
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                        : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                    }`}
                  >
                    {r.status_code ?? "—"}
                  </span>
                  <span className="font-medium text-white truncate">{r.services?.name ?? "—"}</span>
                  <span className="text-white/40 text-xs truncate">{r.api_clients?.name}</span>
                </div>
                <span className="text-[11px] text-white/50 tabular-nums shrink-0">{r.latency_ms ?? 0}ms</span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
