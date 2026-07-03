import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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
  const desc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    ?? pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const ogTitle = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const ogImage = pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  return { title: ogTitle ?? title, description: desc, image: ogImage };
}

function extractLinks(html: string, base: string): string[] {
  const out = new Set<string>();
  const re = /<a[^>]+href=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) && out.size < 40) {
    try {
      const abs = new URL(m[1], base).toString();
      if (abs.startsWith("http")) out.add(abs);
    } catch { /* skip */ }
  }
  return Array.from(out);
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
      const html = (await res.text()).slice(0, 200_000);
      const meta = extractMeta(html);
      const links = extractLinks(html, data.url);
      const baseUrl = new URL(data.url).origin;

      // Try well-known API descriptors
      const apiHints: Array<{ path: string; ok: boolean; status?: number }> = [];
      for (const path of ["/openapi.json", "/swagger.json", "/api", "/robots.txt", "/sitemap.xml"]) {
        const r = await fetchWithTimeout(baseUrl + path, 4000);
        apiHints.push({ path, ok: !!r && r.ok, status: r?.status });
      }

      const result = {
        url: data.url,
        base_url: baseUrl,
        meta,
        api_hints: apiHints.filter((h) => h.ok),
        sample_links: links.slice(0, 20),
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
