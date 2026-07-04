import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import hnCatalog from "@/data/hn-catalog.json";

type HnCatalogSite = {
  url: string;
  host: string;
  categoryKey?: string;
  categoryAr?: string;
  categoryEn?: string;
  categoryEmoji?: string;
  projectId?: string;
  serviceNameAr?: string;
  serviceNameEn?: string;
  capabilityIds?: string[];
  capabilityLabel?: string;
  urlEnv?: string;
  keyEnv?: string;
  keyFallbackEnv?: string;
  defaultUrl?: string;
  generationEngine?: string;
  aiEngine?: string;
};

const urlInput = z.object({ url: z.string().trim().url().max(500) });

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response | null> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "HN-Service-Hub/1.0" },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(to);
  }
}

function extractMeta(html: string) {
  const pick = (re: RegExp) => {
    const m = html.match(re);
    return m ? m[1].trim() : null;
  };
  const title = pick(/<title[^>]*>([^<]+)<\/title>/i);
  const desc =
    pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ??
    pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const keywords = pick(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i);
  const ogTitle = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const ogImage = pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  return {
    title: ogTitle ?? title,
    description: desc,
    keywords: keywords ? keywords.split(",").map((k) => k.trim()).filter(Boolean) : [],
    image: ogImage,
  };
}

function extractLinks(html: string, base: string): string[] {
  const out = new Set<string>();
  const re = /<a[^>]+href=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) && out.size < 80) {
    try {
      const abs = new URL(m[1], base).toString();
      if (abs.startsWith("http")) out.add(abs);
    } catch { /* skip */ }
  }
  return Array.from(out);
}

function extractHeadings(html: string): string[] {
  const out: string[] = [];
  const re = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < 30) {
    const txt = m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (txt.length > 3 && txt.length < 120) out.push(txt);
  }
  return out;
}

// Keyword bank → category mapping (multilingual light)
const SERVICE_KEYWORDS: Array<{ terms: RegExp; name: string; category: string; conf: number }> = [
  { terms: /\b(auth|login|sign[- ]?in|oauth|jwt|مصادقة|تسجيل الدخول)\b/i, name: "Authentication", category: "auth", conf: 70 },
  { terms: /\b(payment|checkout|stripe|paypal|billing|فواتير|دفع)\b/i, name: "Payments", category: "payments", conf: 75 },
  { terms: /\b(ai|gpt|llm|generate|image gen|ذكاء|توليد)\b/i, name: "AI Generation", category: "ai", conf: 65 },
  { terms: /\b(database|db|postgres|mysql|قاعدة بيانات)\b/i, name: "Database Access", category: "database", conf: 70 },
  { terms: /\b(storage|upload|files|cdn|تخزين|رفع)\b/i, name: "Storage / Uploads", category: "storage", conf: 65 },
  { terms: /\b(sms|whatsapp|twilio|رسائل|واتساب)\b/i, name: "Messaging", category: "messaging", conf: 70 },
  { terms: /\b(email|smtp|mailgun|resend|بريد)\b/i, name: "Email", category: "email", conf: 70 },
  { terms: /\b(analytics|tracking|events|تحليلات)\b/i, name: "Analytics", category: "analytics", conf: 60 },
  { terms: /\b(booking|reservation|calendar|حجز|موعد)\b/i, name: "Booking", category: "booking", conf: 70 },
  { terms: /\b(chat|support|helpdesk|دعم|محادثة)\b/i, name: "Chat / Support", category: "chat", conf: 65 },
  { terms: /\b(crm|leads|contacts|عملاء)\b/i, name: "CRM", category: "crm", conf: 60 },
  { terms: /\b(logo|design|branding|تصميم|شعار)\b/i, name: "Design / Logo", category: "design", conf: 60 },
  { terms: /\b(car ?wash|غسيل)\b/i, name: "Car Wash Booking", category: "carwash", conf: 80 },
  { terms: /\b(print|طباعة)\b/i, name: "Print Service", category: "print", conf: 70 },
  { terms: /\b(driver|delivery|توصيل|سائق)\b/i, name: "Delivery / Driver", category: "delivery", conf: 75 },
  { terms: /\b(cctv|surveillance|camera|كاميرا|مراقبة)\b/i, name: "CCTV / Surveillance", category: "surveillance", conf: 80 },
  { terms: /\b(clinic|medical|doctor|عيادة|طبيب)\b/i, name: "Clinic Management", category: "clinic", conf: 75 },
  { terms: /\b(real ?estate|property|عقار)\b/i, name: "Real Estate", category: "immo", conf: 75 },
];

type DiscoveredService = {
  name: string;
  category: string;
  description: string;
  endpoint_path: string | null;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  api_required: boolean;
  confidence_score: number;
  source: string;
};

// Framework/library fingerprints
const FRAMEWORK_PATTERNS: Array<{ re: RegExp; name: string }> = [
  { re: /_next\/static|__NEXT_DATA__/i, name: "Next.js" },
  { re: /nuxt|__nuxt/i, name: "Nuxt" },
  { re: /vite\/|@vite\/client/i, name: "Vite" },
  { re: /react(?:-dom)?[/@]/i, name: "React" },
  { re: /\bvue(?:\.runtime)?\b|__VUE__/i, name: "Vue" },
  { re: /svelte/i, name: "Svelte" },
  { re: /angular|ng-version/i, name: "Angular" },
  { re: /wp-content|wordpress/i, name: "WordPress" },
  { re: /shopify|cdn\.shopify/i, name: "Shopify" },
  { re: /supabase/i, name: "Supabase" },
  { re: /firebase/i, name: "Firebase" },
];

function detectFrameworks(html: string): string[] {
  const found = new Set<string>();
  for (const p of FRAMEWORK_PATTERNS) if (p.re.test(html)) found.add(p.name);
  return Array.from(found);
}

// HN ecosystem / external system dependencies
const SYSTEM_PATTERNS: Array<{ re: RegExp; system: string }> = [
  { re: /hn[-_ ]?db\b|hn-db\.fun|hn-dbpro|hn_db_api/i, system: "hn-db" },
  { re: /hn[-_ ]?cloud|hn_cloud_api/i, system: "hn-cloud" },
  { re: /\btvcc\b|tvcc[-_ ]api|tvcc-hub/i, system: "tvcc" },
  { re: /hn[-_ ]?core/i, system: "hn-core" },
  { re: /hn[-_ ]?ai|openai\.com|api\.openai|gpt-[34]|anthropic|claude|gemini|lovable[-_ ]?ai/i, system: "hn-ai" },
];

function detectSystems(hay: string): string[] {
  const found = new Set<string>();
  for (const p of SYSTEM_PATTERNS) if (p.re.test(hay)) found.add(p.system);
  return Array.from(found);
}

function inferServices(params: {
  meta: { title: string | null; description: string | null; keywords: string[] };
  headings: string[];
  extraTexts: string[];
  apiHints: Array<{ path: string; ok: boolean }>;
  links: string[];
}): DiscoveredService[] {
  const hay = [
    params.meta.title,
    params.meta.description,
    ...params.meta.keywords,
    ...params.headings,
    ...params.extraTexts,
    ...params.links,
  ].filter(Boolean).join(" \n ");

  const found = new Map<string, DiscoveredService>();
  for (const rule of SERVICE_KEYWORDS) {
    if (rule.terms.test(hay)) {
      let conf = rule.conf;
      // Bump confidence if the term appears in title
      if (params.meta.title && rule.terms.test(params.meta.title)) conf += 10;
      // Bump if openapi/swagger available
      if (params.apiHints.some((h) => /openapi|swagger|\/api/.test(h.path))) conf += 10;
      found.set(rule.name, {
        name: rule.name,
        category: rule.category,
        description: `Detected from site content — ${rule.name}`,
        endpoint_path: null,
        method: "POST",
        api_required: true,
        confidence_score: Math.min(100, conf),
        source: "keywords",
      });
    }
  }

  // From API hints, add explicit endpoints
  for (const h of params.apiHints) {
    if (h.path === "/openapi.json" || h.path === "/swagger.json") {
      found.set("API " + h.path, {
        name: `API (${h.path})`,
        category: "api",
        description: `OpenAPI descriptor detected at ${h.path}`,
        endpoint_path: h.path,
        method: "GET",
        api_required: true,
        confidence_score: 95,
        source: "openapi",
      });
    }
  }

  return Array.from(found.values()).sort((a, b) => b.confidence_score - a.confidence_score);
}

export const discoverSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => urlInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: job, error: jErr } = await context.supabase
      .from("discovery_jobs")
      .insert({ url: data.url, requested_by: context.userId, status: "running" })
      .select()
      .single();
    if (jErr) throw new Error(jErr.message);

    try {
      const res = await fetchWithTimeout(data.url);
      if (!res || !res.ok) throw new Error(`HTTP ${res?.status ?? "timeout"}`);
      const html = (await res.text()).slice(0, 300_000);
      const meta = extractMeta(html);
      const links = extractLinks(html, data.url);
      const headings = extractHeadings(html);
      const baseUrl = new URL(data.url).origin;

      // Probe well-known descriptors and secondary pages
      const probePaths = [
        "/openapi.json", "/swagger.json", "/api", "/api/docs",
        "/robots.txt", "/sitemap.xml",
        "/services", "/about", "/docs", "/features", "/products",
      ];
      const apiHints: Array<{ path: string; ok: boolean; status?: number }> = [];
      const extraTexts: string[] = [];

      await Promise.all(
        probePaths.map(async (path) => {
          const r = await fetchWithTimeout(baseUrl + path, 4000);
          apiHints.push({ path, ok: !!r && r.ok, status: r?.status });
          if (r && r.ok && /\/(services|about|features|products|docs)$/.test(path)) {
            try {
              const t = (await r.text()).slice(0, 60_000);
              const txt = t.replace(/<script[\s\S]*?<\/script>/gi, "")
                .replace(/<style[\s\S]*?<\/style>/gi, "")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim();
              if (txt) extraTexts.push(txt.slice(0, 4000));
            } catch { /* ignore */ }
          }
        })
      );

      const okHints = apiHints.filter((h) => h.ok);
      const discovered_services = inferServices({
        meta,
        headings,
        extraTexts,
        apiHints: okHints,
        links,
      });

      // Framework + ecosystem hints from HTML + extra texts + links
      const combinedText = [html, ...extraTexts, ...links].join(" \n ");
      const frameworks = detectFrameworks(html);
      const systems = detectSystems(combinedText);

      // Overall confidence: presence of title/desc/api/services
      let overall = 20;
      if (meta.title) overall += 15;
      if (meta.description) overall += 15;
      if (meta.keywords.length) overall += 10;
      if (okHints.length) overall += 20;
      if (discovered_services.length) overall += 20;

      const result = {
        url: data.url,
        base_url: baseUrl,
        meta,
        headings: headings.slice(0, 10),
        api_hints: okHints,
        sample_links: links.slice(0, 20),
        frameworks,
        systems,
        discovered_services,
        overall_confidence: Math.min(100, overall),
      };


      await context.supabase
        .from("discovery_jobs")
        .update({ status: "completed", result, completed_at: new Date().toISOString() })
        .eq("id", job.id);

      return { job_id: job.id, result };
    } catch (e: any) {
      await context.supabase
        .from("discovery_jobs")
        .update({ status: "failed", error: e?.message ?? String(e), completed_at: new Date().toISOString() })
        .eq("id", job.id);
      throw new Error(e?.message ?? "Discovery failed");
    }
  });

export const listDiscoveryJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("discovery_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getDiscoveryJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("discovery_jobs")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const saveInput = z.object({
  job_id: z.string().uuid(),
  site_id: z.string().uuid().optional().nullable(),
  services: z.array(
    z.object({
      name: z.string().trim().min(1).max(120),
      category: z.string().trim().max(80).optional().nullable(),
      description: z.string().trim().max(1000).optional().nullable(),
      endpoint_path: z.string().trim().max(500).optional().nullable(),
      method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).default("POST"),
      api_required: z.boolean().default(true),
      confidence_score: z.number().min(0).max(100).default(60),
    })
  ).min(1),
});

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "service";
}

export const saveDiscoveredServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveInput.parse(d))
  .handler(async ({ data, context }) => {
    let siteId = data.site_id ?? null;

    // Auto-create site from job URL if not provided
    if (!siteId) {
      const { data: job } = await context.supabase
        .from("discovery_jobs").select("url, result").eq("id", data.job_id).single();
      if (!job) throw new Error("Job not found");
      const jobResult = (job.result ?? {}) as {
        base_url?: string;
        meta?: { title?: string | null; description?: string | null };
      };
      const baseUrl = jobResult.base_url ?? job.url;
      const host = new URL(baseUrl).hostname.replace(/^www\./, "");
      const slug = slugify(host);
      const { data: existing } = await context.supabase
        .from("sites").select("id").eq("slug", slug).maybeSingle();
      if (existing) {
        siteId = existing.id;
      } else {
        const { data: newSite, error: siteErr } = await context.supabase
          .from("sites").insert({
            name: jobResult.meta?.title ?? host,
            slug,
            base_url: baseUrl,
            description: jobResult.meta?.description ?? null,
            owner_id: context.userId,
            status: "active",
            discovered_at: new Date().toISOString(),
          }).select("id").single();
        if (siteErr) throw new Error(siteErr.message);
        siteId = newSite.id;
      }
    }

    // Insert each service as approval_status='pending'
    const rows = data.services.map((s) => ({
      site_id: siteId!,
      name: s.name,
      slug: slugify(s.name),
      category: s.category ?? null,
      method: s.method,
      endpoint_path: s.endpoint_path ?? null,
      description: s.description ?? null,
      confidence_score: s.confidence_score,
      api_required: s.api_required,
      approval_status: "pending",
      discovered_from_job_id: data.job_id,
      is_active: false,
    }));

    const { data: inserted, error } = await context.supabase
      .from("services")
      .upsert(rows, { onConflict: "site_id,slug", ignoreDuplicates: false })
      .select();
    if (error) throw new Error(error.message);

    // Auto-write service_dependencies from the job's detected systems
    const { data: job } = await context.supabase
      .from("discovery_jobs").select("result").eq("id", data.job_id).single();
    const jobResult = (job?.result ?? {}) as { systems?: string[] };
    const systems = Array.isArray(jobResult.systems) ? jobResult.systems : [];
    if (inserted && inserted.length && systems.length) {
      const svcIds = inserted.map((s: any) => s.id);
      // Refresh auto-detected system deps for these services
      await context.supabase
        .from("service_dependencies" as any)
        .delete()
        .in("service_id", svcIds)
        .eq("source", "auto")
        .not("depends_on_system", "is", null);
      const depRows = inserted.flatMap((svc: any) =>
        systems.map((sys) => ({
          service_id: svc.id,
          depends_on_system: sys,
          relation_type: "depends_on",
          confidence: 70,
          source: "auto",
        }))
      );
      await context.supabase.from("service_dependencies" as any).insert(depRows);
    }


    return { inserted: inserted?.length ?? 0, site_id: siteId };
  });

async function analyzeUrl(url: string) {
  const res = await fetchWithTimeout(url);
  if (!res || !res.ok) throw new Error(`HTTP ${res?.status ?? "timeout"}`);
  const html = (await res.text()).slice(0, 300_000);
  const meta = extractMeta(html);
  const links = extractLinks(html, url);
  const headings = extractHeadings(html);
  const baseUrl = new URL(url).origin;

  const probePaths = [
    "/openapi.json", "/swagger.json", "/api", "/api/docs",
    "/robots.txt", "/sitemap.xml",
    "/services", "/about", "/docs", "/features", "/products",
  ];
  const apiHints: Array<{ path: string; ok: boolean; status?: number }> = [];
  const extraTexts: string[] = [];
  await Promise.all(probePaths.map(async (path) => {
    const r = await fetchWithTimeout(baseUrl + path, 4000);
    apiHints.push({ path, ok: !!r && r.ok, status: r?.status });
    if (r && r.ok && /\/(services|about|features|products|docs)$/.test(path)) {
      try {
        const t = (await r.text()).slice(0, 60_000);
        const txt = t.replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (txt) extraTexts.push(txt.slice(0, 4000));
      } catch { /* ignore */ }
    }
  }));

  const okHints = apiHints.filter((h) => h.ok);
  const discovered_services = inferServices({ meta, headings, extraTexts, apiHints: okHints, links });
  const combinedText = [html, ...extraTexts, ...links].join(" \n ");
  const frameworks = detectFrameworks(html);
  const systems = detectSystems(combinedText);

  let overall = 20;
  if (meta.title) overall += 15;
  if (meta.description) overall += 15;
  if (meta.keywords.length) overall += 10;
  if (okHints.length) overall += 20;
  if (discovered_services.length) overall += 20;

  return {
    url, base_url: baseUrl, meta,
    headings: headings.slice(0, 10),
    api_hints: okHints,
    sample_links: links.slice(0, 20),
    frameworks, systems, discovered_services,
    overall_confidence: Math.min(100, overall),
  };
}

// Bulk analyze every registered site: runs discovery per site and auto-saves
// discovered services as approval_status='pending'.
export const analyzeAllSites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: sites, error } = await context.supabase
      .from("sites")
      .select("id, base_url, slug, tvcc_id, hn_db_id, hn_cloud_id, base_url")
      .not("base_url", "is", null)
      // HN group only: sites synced from any HN hub (TVCC / HN-DB / HN-Cloud)
      // or whose URL / slug matches the hn.* naming.
      .or("tvcc_id.not.is.null,hn_db_id.not.is.null,hn_cloud_id.not.is.null,base_url.ilike.%hn-%,base_url.ilike.%hn.%,slug.ilike.hn-%");
    if (error) throw new Error(error.message);

    let analyzed = 0;
    let failed = 0;
    let servicesCreated = 0;
    const errors: Array<{ slug: string; error: string }> = [];

    for (const site of sites ?? []) {
      if (!site.base_url) continue;
      const { data: job, error: jErr } = await context.supabase
        .from("discovery_jobs")
        .insert({ url: site.base_url, requested_by: context.userId, status: "running" })
        .select().single();
      if (jErr || !job) { failed++; errors.push({ slug: site.slug, error: jErr?.message ?? "job insert failed" }); continue; }

      try {
        const result = await analyzeUrl(site.base_url);
        await context.supabase.from("discovery_jobs")
          .update({ status: "completed", result, completed_at: new Date().toISOString() })
          .eq("id", job.id);

        if (result.discovered_services.length) {
          const rows = result.discovered_services.map((s) => ({
            site_id: site.id,
            name: s.name,
            slug: slugify(s.name),
            category: s.category ?? null,
            method: s.method,
            endpoint_path: s.endpoint_path ?? null,
            description: s.description ?? null,
            confidence_score: s.confidence_score,
            api_required: s.api_required,
            approval_status: "pending",
            discovered_from_job_id: job.id,
            is_active: false,
          }));
          const { data: inserted } = await context.supabase
            .from("services")
            .upsert(rows, { onConflict: "site_id,slug", ignoreDuplicates: false })
            .select("id");
          servicesCreated += inserted?.length ?? 0;

          if (inserted?.length && result.systems.length) {
            const svcIds = inserted.map((s: any) => s.id);
            await context.supabase.from("service_dependencies" as any)
              .delete().in("service_id", svcIds).eq("source", "auto")
              .not("depends_on_system", "is", null);
            const depRows = inserted.flatMap((svc: any) =>
              result.systems.map((sys) => ({
                service_id: svc.id, depends_on_system: sys,
                relation_type: "depends_on", confidence: 70, source: "auto",
              }))
            );
            await context.supabase.from("service_dependencies" as any).insert(depRows);
          }
        }
        analyzed++;
      } catch (e: any) {
        failed++;
        errors.push({ slug: site.slug, error: e?.message ?? String(e) });
        await context.supabase.from("discovery_jobs")
          .update({ status: "failed", error: e?.message ?? String(e), completed_at: new Date().toISOString() })
          .eq("id", job.id);
      }
    }

    return { total: sites?.length ?? 0, analyzed, failed, servicesCreated, errors: errors.slice(0, 10) };
  });

// One-shot: import the bundled HN ecosystem catalog (152 sites + capabilities as services).
export const importHnCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const catalog = hnCatalog as unknown as { sites: HnCatalogSite[] };
    const list = catalog.sites ?? [];
    if (!list.length) return { sites: 0, services: 0, skipped: 0 };

    // 1) Build unique site rows keyed by slug (dedupe URL variants like www.*)
    const seen = new Set<string>();
    const siteRows: Array<Record<string, unknown>> = [];
    const slugByIndex: string[] = [];
    for (const s of list) {
      const host = (s.host || s.url.replace(/^https?:\/\//, "").split("/")[0]).toLowerCase();
      let slug = host.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "site";
      let n = 2;
      const base = slug;
      while (seen.has(slug)) slug = `${base}-${n++}`;
      seen.add(slug);
      slugByIndex.push(slug);
      siteRows.push({
        name: s.serviceNameAr || s.serviceNameEn || host,
        slug,
        base_url: s.url || s.defaultUrl || `https://${host}`,
        category: s.categoryKey ?? null,
        status: "active",
        owner_id: context.userId,
        discovered_at: new Date().toISOString(),
        metadata: {
          projectId: s.projectId,
          categoryEmoji: s.categoryEmoji,
          categoryAr: s.categoryAr,
          categoryEn: s.categoryEn,
          nameEn: s.serviceNameEn,
          urlEnv: s.urlEnv,
          keyEnv: s.keyEnv,
          keyFallbackEnv: s.keyFallbackEnv,
          defaultUrl: s.defaultUrl,
          generationEngine: s.generationEngine,
          aiEngine: s.aiEngine,
          capabilityIds: s.capabilityIds ?? [],
          source: "hn-catalog-import",
        },
      });
    }

    // 2) Upsert sites in chunks of 100 to avoid oversize payloads.
    const upserted: Array<{ id: string; slug: string }> = [];
    for (let i = 0; i < siteRows.length; i += 100) {
      const chunk = siteRows.slice(i, i + 100);
      const { data, error } = await context.supabase
        .from("sites")
        .upsert(chunk, { onConflict: "slug" })
        .select("id, slug");
      if (error) throw new Error(`sites upsert failed: ${error.message}`);
      if (data) upserted.push(...data);
    }
    const idBySlug = new Map(upserted.map((s) => [s.slug, s.id]));

    // 3) Build service rows from capabilityIds.
    const svcRows: Array<Record<string, unknown>> = [];
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const siteSlug = slugByIndex[i];
      const siteId = idBySlug.get(siteSlug);
      if (!siteId) continue;
      const caps = s.capabilityIds ?? [];
      const svcSeen = new Set<string>();
      for (const cap of caps) {
        const svcSlug = cap.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "svc";
        if (svcSeen.has(svcSlug)) continue;
        svcSeen.add(svcSlug);
        svcRows.push({
          site_id: siteId,
          name: cap,
          slug: svcSlug,
          category: s.categoryKey ?? null,
          method: "POST",
          description: `HN capability: ${cap}`,
          confidence_score: 100,
          api_required: true,
          approval_status: "approved",
          is_active: true,
        });
      }
    }

    // 4) Upsert services in chunks of 200.
    let servicesInserted = 0;
    for (let i = 0; i < svcRows.length; i += 200) {
      const chunk = svcRows.slice(i, i + 200);
      const { data, error } = await context.supabase
        .from("services")
        .upsert(chunk, { onConflict: "site_id,slug" })
        .select("id");
      if (error) throw new Error(`services upsert failed: ${error.message}`);
      servicesInserted += data?.length ?? 0;
    }

    return { sites: upserted.length, services: servicesInserted, totalInCatalog: list.length };
  });



