import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Code2,
  Video,
  AudioLines,
  Languages,
  Database,
  Cloud,
  Shield,
  Globe,
  ArrowLeft,
  ArrowRight,
  Rocket,
  PlayCircle,
  Sparkles,
  Zap,
  Lock,
  Cpu,
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  ssr: false,
  component: LandingPage,
});

type Copy = {
  nav: { home: string; services: string; how: string; sites: string; devs: string; about: string; contact: string; login: string; dashboard: string };
  hero: {
    badge: string;
    title1: string;
    title2: string;
    desc: string;
    ctaPrimary: string;
    ctaSecondary: string;
    ctaTertiary: string;
    features: string[];
  };
  stats: { value: string; label: string }[];
  nodes: { id: string; name: string; desc: string }[];
  how: { title: string; subtitle: string; steps: { n: string; title: string; desc: string }[] };
  services: { title: string; subtitle: string };
  why: { title: string; subtitle: string; items: { title: string; desc: string }[] };
  footer: string;
};

const COPY: Record<"ar" | "en", Copy> = {
  ar: {
    nav: {
      home: "الرئيسية",
      services: "الخدمات",
      how: "كيف يعمل",
      sites: "المواقع",
      devs: "توثيق المطورين",
      about: "حول المنظومة",
      contact: "اتصل بنا",
      login: "تسجيل الدخول",
      dashboard: "لوحة التحكم",
    },
    hero: {
      badge: "محرك منظومة HN",
      title1: "محرك الخدمات الذكي",
      title2: "لمنظومة HN",
      desc: "يربط جميع مواقعك وخدماتك في منظومة واحدة. يفهم الطلبات، يقسّم المهام، يختار أفضل خدمة، ويعيد النتائج بسرعة وأمان.",
      ctaPrimary: "دخول لوحة التحكم",
      ctaSecondary: "استكشاف الخدمات",
      ctaTertiary: "مشاهدة طريقة العمل",
      features: ["آمن وموثوق", "متصل بجميع المواقع", "تنفيذ ذكي وسريع", "إدارة من مركز واحد"],
    },
    stats: [
      { value: "+150", label: "موقع متصل" },
      { value: "+250", label: "خدمة ذكية" },
      { value: "99.9%", label: "معدل الجاهزية" },
      { value: "24/7", label: "تنفيذ تلقائي للمهام" },
    ],
    nodes: [
      { id: "build", name: "HN Build", desc: "بناء المواقع والتطبيقات الذكية" },
      { id: "video", name: "HN Video AI", desc: "إنشاء وتحرير الفيديوهات بالذكاء الاصطناعي" },
      { id: "audio", name: "HN Audio AI", desc: "توليد وتحسين الصوت والتعليق الاحترافي" },
      { id: "translation", name: "HN Translation", desc: "ترجمة النصوص والصفحات والفيديوهات" },
      { id: "db", name: "HN DB", desc: "إدارة قواعد البيانات والنسخ والربط الذكي" },
      { id: "cloud", name: "HN Cloud", desc: "التخزين والنسخ الاحتياطي ونشر المشاريع" },
      { id: "core", name: "HN Core", desc: "الهوية والسياسات وإدارة الأدوار" },
      { id: "tvcc", name: "TVCC", desc: "توثيق ملكية المواقع عبر DNS Zone Records" },
    ],
    how: {
      title: "كيف يعمل HN Service Hub؟",
      subtitle: "من الطلب إلى النتيجة في ثوانٍ معدودة",
      steps: [
        { n: "1", title: "تقديم الطلب", desc: "أخبرنا بما تريد إنجازه" },
        { n: "2", title: "تحليل وتقسيم", desc: "نحلل طلبك ونقسّمه إلى مهام" },
        { n: "3", title: "تنفيذ ذكي", desc: "نختار أفضل الخدمات لتنفيذ كل مهمة" },
        { n: "4", title: "نتائج متكاملة", desc: "نجمع النتائج ونسلّمها لك جاهزة" },
      ],
    },
    services: { title: "خدماتنا الذكية", subtitle: "مجموعة متكاملة من الخدمات الذكية لإنجاز أي مهمة" },
    why: {
      title: "لماذا HN Service Hub؟",
      subtitle: "قلب المنظومة الذي يعمل بصمت خلف كل موقع",
      items: [
        { title: "تشغيل خفي للمنظومة", desc: "يعمل في الخلفية دون تدخل من مواقع HN" },
        { title: "ربط داخلي عبر TVCC", desc: "لا يعتمد على Public API بين المواقع الداخلية" },
        { title: "إدارة كاملة للمهام", desc: "يدير الخدمات والمهام والنتائج من مكان واحد" },
        { title: "توجيه ذكي للطلبات", desc: "يختار أفضل خدمة تلقائيًا لكل مهمة" },
      ],
    },
    footer: "منظومة HN — محرك الخدمات المركزي",
  },
  en: {
    nav: {
      home: "Home",
      services: "Services",
      how: "How it works",
      sites: "Sites",
      devs: "Developer docs",
      about: "About",
      contact: "Contact",
      login: "Sign in",
      dashboard: "Dashboard",
    },
    hero: {
      badge: "The HN Ecosystem Engine",
      title1: "The Intelligent Service Engine",
      title2: "for the HN Ecosystem",
      desc: "Connects all your sites and services into one ecosystem. Understands requests, splits them into tasks, picks the best service, and returns results — fast and secure.",
      ctaPrimary: "Open Dashboard",
      ctaSecondary: "Explore services",
      ctaTertiary: "See how it works",
      features: ["Secure & reliable", "Connected to every site", "Smart & fast execution", "Managed from one place"],
    },
    stats: [
      { value: "+150", label: "connected sites" },
      { value: "+250", label: "smart services" },
      { value: "99.9%", label: "uptime" },
      { value: "24/7", label: "autonomous execution" },
    ],
    nodes: [
      { id: "build", name: "HN Build", desc: "Build smart websites & apps" },
      { id: "video", name: "HN Video AI", desc: "AI video generation & editing" },
      { id: "audio", name: "HN Audio AI", desc: "Voice generation & audio mastering" },
      { id: "translation", name: "HN Translation", desc: "Text, page & video translation" },
      { id: "db", name: "HN DB", desc: "Databases, replication & smart linking" },
      { id: "cloud", name: "HN Cloud", desc: "Storage, backups & deployments" },
      { id: "core", name: "HN Core", desc: "Identity, roles & policies" },
      { id: "tvcc", name: "TVCC", desc: "Domain ownership via DNS records" },
    ],
    how: {
      title: "How HN Service Hub works",
      subtitle: "From request to result in seconds",
      steps: [
        { n: "1", title: "Submit request", desc: "Tell us what you want done" },
        { n: "2", title: "Analyze & split", desc: "We break it into subtasks" },
        { n: "3", title: "Smart execution", desc: "Best service picked per task" },
        { n: "4", title: "Unified result", desc: "Results merged & delivered" },
      ],
    },
    services: { title: "Our smart services", subtitle: "An integrated suite for any task" },
    why: {
      title: "Why HN Service Hub?",
      subtitle: "The silent core behind every site in the network",
      items: [
        { title: "Silent ecosystem runtime", desc: "Runs in the background across HN sites" },
        { title: "Internal routing via TVCC", desc: "No public API needed between HN sites" },
        { title: "Full task lifecycle", desc: "Services, tasks and results in one place" },
        { title: "Intelligent request routing", desc: "Best service auto-selected per task" },
      ],
    },
    footer: "HN Ecosystem — central services engine",
  },
};

const NODE_ICONS: Record<string, typeof Code2> = {
  build: Code2,
  video: Video,
  audio: AudioLines,
  translation: Languages,
  db: Database,
  cloud: Cloud,
  core: Shield,
  tvcc: Globe,
};

const NODE_COLORS: Record<string, string> = {
  build: "var(--neon-purple)",
  video: "var(--neon-pink)",
  audio: "var(--neon-amber)",
  translation: "var(--neon-cyan)",
  db: "var(--neon-green)",
  cloud: "var(--neon-cyan)",
  core: "var(--neon-blue)",
  tvcc: "var(--neon-blue)",
};

function LandingPage() {
  const { lang, dir, setLang } = useLanguage();
  const c = COPY[lang];
  const [authed, setAuthed] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const Arrow = dir === "rtl" ? ArrowLeft : ArrowRight;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
  }, []);

  // 8 nodes distributed on a circle
  const radius = 210;
  const positions = c.nodes.map((_, i) => {
    const angle = (i / c.nodes.length) * Math.PI * 2 - Math.PI / 2;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });

  return (
    <div dir={dir} className="hn-landing min-h-screen bg-[var(--hn-bg)] text-foreground overflow-hidden relative">
      <StyleTokens />
      <BackgroundLayers />

      {/* Nav */}
      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <HubMark size={40} />
          <div className="leading-tight">
            <div className="text-lg font-bold tracking-wide text-white">HN Service Hub</div>
            <div className="text-[11px] text-[var(--neon-cyan)]/80">{c.hero.badge}</div>
          </div>
        </div>

        <nav className="hidden items-center gap-7 text-sm text-white/70 lg:flex">
          <a href="#home" className="hover:text-white">{c.nav.home}</a>
          <a href="#services" className="hover:text-white">{c.nav.services}</a>
          <a href="#how" className="hover:text-white">{c.nav.how}</a>
          <a href="#why" className="hover:text-white">{c.nav.about}</a>
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:border-[var(--neon-cyan)]/50 hover:text-white"
          >
            <Globe className="h-3.5 w-3.5" />
            {lang === "ar" ? "English" : "العربية"}
          </button>
          <Link
            to={authed ? "/dashboard" : "/auth"}
            className="rounded-md border border-[var(--neon-cyan)]/40 bg-[var(--neon-cyan)]/10 px-4 py-1.5 text-xs font-medium text-[var(--neon-cyan)] shadow-[0_0_20px_-5px_var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/20"
          >
            {authed ? c.nav.dashboard : c.nav.login}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section id="home" className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-6 pt-6 pb-16 lg:grid-cols-[1.05fr_1fr]">
        <div className="relative">
          <h1 className="text-5xl font-extrabold leading-[1.1] tracking-tight md:text-6xl">
            <span className="bg-gradient-to-r from-[var(--neon-cyan)] via-[var(--neon-blue)] to-[var(--neon-purple)] bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(139,92,246,0.35)]">
              {c.hero.title1}
            </span>
            <br />
            <span className="text-white">{c.hero.title2}</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70 md:text-lg">
            {c.hero.desc}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to={authed ? "/dashboard" : "/auth"}
              className="group relative inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[var(--neon-blue)] via-[var(--neon-purple)] to-[var(--neon-pink)] px-6 py-3 text-sm font-semibold text-white shadow-[0_0_40px_-5px_var(--neon-purple)] transition hover:shadow-[0_0_60px_-5px_var(--neon-pink)]"
            >
              <Rocket className="h-4 w-4" />
              {c.hero.ctaPrimary}
              <Arrow className="h-4 w-4 transition group-hover:translate-x-[-2px] rtl:group-hover:translate-x-[2px]" />
            </Link>
            <a
              href="#services"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white/90 backdrop-blur hover:border-[var(--neon-cyan)]/50 hover:bg-white/10"
            >
              {c.hero.ctaSecondary}
              <Arrow className="h-4 w-4" />
            </a>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm text-white/70 hover:text-white"
            >
              <PlayCircle className="h-4 w-4" />
              {c.hero.ctaTertiary}
            </a>
          </div>

          <div className="mt-9 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[Shield, Zap, Sparkles, Cpu].map((Icon, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-white/60">
                <Icon className="h-4 w-4 text-[var(--neon-cyan)]" />
                <span>{c.hero.features[i]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Orbit visual */}
        <div className="relative mx-auto flex h-[520px] w-full max-w-[560px] items-center justify-center">
          {/* Glow rings */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-[440px] w-[440px] rounded-full border border-white/5" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-[300px] w-[300px] rounded-full border border-[var(--neon-blue)]/15" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-[180px] w-[180px] animate-[spin_28s_linear_infinite] rounded-full border border-dashed border-[var(--neon-cyan)]/25" />
          </div>

          {/* Connection lines SVG */}
          <svg
            viewBox="-260 -260 520 520"
            className="absolute inset-0 h-full w-full"
            aria-hidden
          >
            <defs>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--neon-cyan)" stopOpacity="0.05" />
                <stop offset="50%" stopColor="var(--neon-purple)" stopOpacity="0.9" />
                <stop offset="100%" stopColor="var(--neon-cyan)" stopOpacity="0.05" />
              </linearGradient>
            </defs>
            {positions.map((p, i) => (
              <line
                key={i}
                x1={0}
                y1={0}
                x2={p.x}
                y2={p.y}
                stroke="url(#lineGrad)"
                strokeWidth={hovered === c.nodes[i].id ? 2 : 1}
                className="transition-all"
                strokeDasharray="4 6"
              >
                <animate attributeName="stroke-dashoffset" from="0" to="-30" dur="2s" repeatCount="indefinite" />
              </line>
            ))}
          </svg>

          {/* Core */}
          <div className="relative z-10 flex h-32 w-32 items-center justify-center">
            <div className="absolute inset-0 animate-pulse rounded-full bg-[var(--neon-purple)]/40 blur-2xl" />
            <div className="relative flex h-full w-full items-center justify-center rounded-2xl border border-[var(--neon-cyan)]/50 bg-gradient-to-br from-[var(--neon-blue)]/40 via-[var(--neon-purple)]/40 to-[var(--neon-pink)]/30 backdrop-blur-xl shadow-[0_0_60px_-10px_var(--neon-purple)]">
              <div className="text-center">
                <div className="text-2xl font-black tracking-tight text-white">HN</div>
                <div className="mt-0.5 text-[10px] font-medium tracking-wider text-[var(--neon-cyan)]">
                  Service Hub
                </div>
              </div>
            </div>
          </div>

          {/* Nodes */}
          {c.nodes.map((n, i) => {
            const Icon = NODE_ICONS[n.id] ?? Sparkles;
            const color = NODE_COLORS[n.id];
            const p = positions[i];
            const isHover = hovered === n.id;
            return (
              <div
                key={n.id}
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
                className="absolute z-20"
                style={{
                  transform: `translate(${p.x}px, ${p.y}px)`,
                  left: "50%",
                  top: "50%",
                  marginLeft: -32,
                  marginTop: -32,
                }}
              >
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-xl border bg-[var(--hn-card)] backdrop-blur-md transition-all hover:scale-110"
                  style={{
                    borderColor: `color-mix(in oklab, ${color} 55%, transparent)`,
                    boxShadow: `0 0 ${isHover ? 40 : 20}px -5px ${color}`,
                  }}
                >
                  <Icon className="h-6 w-6" style={{ color }} />
                </div>
                <div className="mt-1.5 text-center text-[10px] font-medium text-white/70">
                  {n.name}
                </div>
                {isHover && (
                  <div
                    className="absolute left-1/2 top-[calc(100%+8px)] z-30 w-48 -translate-x-1/2 rounded-lg border bg-[var(--hn-card)]/95 p-3 text-center shadow-2xl backdrop-blur-md"
                    style={{ borderColor: `color-mix(in oklab, ${color} 40%, transparent)` }}
                  >
                    <div className="text-xs font-semibold text-white">{n.name}</div>
                    <div className="mt-1 text-[10px] leading-relaxed text-white/70">{n.desc}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Stats */}
      <section className="relative z-10 mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md md:grid-cols-4">
          {c.stats.map((s) => (
            <div key={s.label} className="bg-[var(--hn-card)]/70 px-6 py-5 text-center">
              <div className="bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] bg-clip-text text-2xl font-black text-transparent">
                {s.value}
              </div>
              <div className="mt-1 text-xs text-white/60">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative z-10 mx-auto max-w-7xl px-6 pt-20">
        <SectionHeader title={c.how.title} subtitle={c.how.subtitle} />
        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          {c.how.steps.map((s, i) => (
            <div
              key={s.n}
              className="group relative overflow-hidden rounded-xl border border-white/10 bg-[var(--hn-card)]/60 p-5 backdrop-blur-md transition hover:border-[var(--neon-cyan)]/40"
            >
              <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-[var(--neon-purple)]/10 blur-2xl transition group-hover:bg-[var(--neon-cyan)]/20" />
              <div className="relative">
                <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--neon-cyan)]/40 bg-[var(--neon-cyan)]/10 text-sm font-bold text-[var(--neon-cyan)]">
                  {s.n}
                </div>
                <div className="text-sm font-semibold text-white">{s.title}</div>
                <div className="mt-1 text-xs text-white/60">{s.desc}</div>
              </div>
              {i < c.how.steps.length - 1 && (
                <Arrow className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--neon-cyan)]/40 ltr:-right-2 rtl:-left-2 hidden md:block" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section id="services" className="relative z-10 mx-auto max-w-7xl px-6 pt-20">
        <SectionHeader title={c.services.title} subtitle={c.services.subtitle} />
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {c.nodes.slice(0, 6).map((n) => {
            const Icon = NODE_ICONS[n.id];
            const color = NODE_COLORS[n.id];
            return (
              <div
                key={n.id}
                className="group relative overflow-hidden rounded-xl border border-white/10 bg-[var(--hn-card)]/60 p-4 text-center backdrop-blur-md transition hover:-translate-y-1"
                style={{
                  boxShadow: `0 0 0 1px transparent`,
                }}
              >
                <div
                  className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg border"
                  style={{
                    borderColor: `color-mix(in oklab, ${color} 45%, transparent)`,
                    background: `color-mix(in oklab, ${color} 12%, transparent)`,
                    boxShadow: `0 0 25px -8px ${color}`,
                  }}
                >
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <div className="text-sm font-semibold text-white">{n.name}</div>
                <div className="mt-1 text-[11px] leading-relaxed text-white/55">{n.desc}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Why */}
      <section id="why" className="relative z-10 mx-auto max-w-7xl px-6 py-20">
        <SectionHeader title={c.why.title} subtitle={c.why.subtitle} />
        <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {c.why.items.map((it, i) => {
            const Icon = [Lock, Globe, Cpu, Sparkles][i];
            return (
              <div
                key={it.title}
                className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-5 backdrop-blur-md transition hover:border-[var(--neon-purple)]/40"
              >
                <Icon className="h-5 w-5 text-[var(--neon-cyan)]" />
                <div className="mt-3 text-sm font-semibold text-white">{it.title}</div>
                <div className="mt-1 text-xs leading-relaxed text-white/60">{it.desc}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-white/40 sm:flex-row">
          <div className="flex items-center gap-2">
            <HubMark size={20} />
            <span>{c.footer}</span>
          </div>
          <div>© {new Date().getFullYear()} HN Service Hub</div>
        </div>
      </footer>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold text-white md:text-3xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-2xl text-sm text-white/60">{subtitle}</p>
    </div>
  );
}

function HubMark({ size = 32 }: { size?: number }) {
  return (
    <div
      className="relative flex items-center justify-center rounded-lg border border-[var(--neon-cyan)]/40 bg-gradient-to-br from-[var(--neon-blue)]/40 to-[var(--neon-purple)]/40 shadow-[0_0_20px_-5px_var(--neon-purple)]"
      style={{ height: size, width: size }}
    >
      <span className="text-[11px] font-black text-white" style={{ fontSize: size * 0.32 }}>
        HN
      </span>
    </div>
  );
}

function BackgroundLayers() {
  return (
    <>
      {/* Deep gradient */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--neon-purple)/0.18,_transparent_60%),radial-gradient(ellipse_at_bottom,_var(--neon-blue)/0.15,_transparent_60%)]" />
      {/* Grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.25]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(56,189,248,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.08) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
      {/* Horizon glow */}
      <div className="pointer-events-none absolute left-1/2 top-[38%] h-[520px] w-[1200px] -translate-x-1/2 rounded-[100%] bg-[var(--neon-purple)]/20 blur-3xl" />
    </>
  );
}

function StyleTokens() {
  return (
    <style>{`
      .hn-landing {
        --hn-bg: #06060f;
        --hn-card: rgba(15, 15, 30, 0.65);
        --neon-cyan: #22d3ee;
        --neon-blue: #3b82f6;
        --neon-purple: #8b5cf6;
        --neon-pink: #ec4899;
        --neon-green: #22c55e;
        --neon-amber: #f59e0b;
      }
    `}</style>
  );
}
