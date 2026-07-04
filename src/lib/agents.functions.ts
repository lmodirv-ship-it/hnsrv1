// HN Agents: one agent per (site, service). Owner-only management.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type HnAgent = {
  id: string;
  agent_number: number;
  name: string;
  slug: string;
  site_id: string | null;
  service_id: string | null;
  site_name: string | null;
  service_name: string | null;
  role: string;
  description: string | null;
  inputs: unknown;
  outputs: unknown;
  tools: string[];
  script_lang: string;
  script_content: string | null;
  runtime_path: string | null;
  is_active: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  runs_count: number;
  updated_at: string;
};

async function assertAdmin(ctx: { userId: string; supabase: any }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

function inferRole(category: string | null, capabilities: string[] | null): string {
  const c = (category ?? "").toLowerCase();
  const caps = (capabilities ?? []).join(",").toLowerCase();
  if (/image|logo|photo/.test(c + caps)) return "image";
  if (/video/.test(c + caps)) return "video";
  if (/audio|voice|tts|speech/.test(c + caps)) return "audio";
  if (/translate|translation/.test(c + caps)) return "translation";
  if (/text|chat|llm|gpt|prompt/.test(c + caps)) return "text";
  if (/db|database|sql|postgres/.test(c + caps)) return "database";
  if (/deploy|hosting/.test(c + caps)) return "deployment";
  if (/site|web|build/.test(c + caps)) return "website";
  return "generic";
}

function pythonScript(agentName: string, role: string, endpoint: string): string {
  return `#!/usr/bin/env python3
"""HN Agent: ${agentName}
Role: ${role}
Runtime dir: d:\\\\hn (fallback c:\\\\hn)
"""
import os, sys, json, time, pathlib, urllib.request

RUNTIME_ROOT = pathlib.Path(r"d:\\hn") if pathlib.Path(r"d:\\hn").exists() else pathlib.Path(r"c:\\hn")
IN_DIR  = RUNTIME_ROOT / "in"  / "${role}"
OUT_DIR = RUNTIME_ROOT / "out" / "${role}"
LOG_DIR = RUNTIME_ROOT / "logs"
for d in (IN_DIR, OUT_DIR, LOG_DIR):
    d.mkdir(parents=True, exist_ok=True)

ENDPOINT = os.environ.get("HN_AGENT_ENDPOINT", "${endpoint}")
API_KEY  = os.environ.get("HN_API_KEY", "")

def run(payload: dict) -> dict:
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"},
        method="POST",
    )
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read().decode()
    return {"status": "ok", "ms": int((time.time() - t0) * 1000), "response": body}

if __name__ == "__main__":
    payload = json.loads(sys.stdin.read() or "{}")
    result = run(payload)
    (LOG_DIR / f"${agentName.replace(/[^a-z0-9]/gi, "_")}.log").write_text(json.dumps(result), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
`;
}

export const listAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HnAgent[]> => {
    const { data, error } = await context.supabase
      .from("hn_agents")
      .select("*")
      .order("agent_number", { ascending: true })
      .limit(2000);
    if (error) throw new Error(error.message);
    return (data ?? []) as HnAgent[];
  });

export const generateAgents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: services, error: sErr } = await supabaseAdmin
      .from("services")
      .select("id, name, slug, category, capabilities, endpoint_url, endpoint_path, site_id, sites:site_id(name, slug, base_url)")
      .eq("is_active", true)
      .limit(2000);
    if (sErr) throw new Error(sErr.message);

    const rows =
      (services ?? []).map((s: any) => {
        const role = inferRole(s.category, s.capabilities);
        const siteName = s.sites?.name ?? s.sites?.slug ?? "unknown";
        const endpoint = s.endpoint_url || `${String(s.sites?.base_url ?? "").replace(/\/+$/, "")}${s.endpoint_path ?? "/"}`;
        const name = `${siteName} · ${s.name}`;
        return {
          name,
          slug: `agent-${s.id.slice(0, 8)}-${s.slug}`.slice(0, 120),
          site_id: s.site_id,
          service_id: s.id,
          site_name: siteName,
          service_name: s.name,
          role,
          description: `HN agent for ${s.name} on ${siteName}`,
          inputs: { schema: "json", from: "IN_DIR" },
          outputs: { schema: "json", to: "OUT_DIR" },
          tools: [role, "http", "python"],
          script_lang: "python",
          script_content: pythonScript(name, role, endpoint),
          runtime_path: "d:\\hn",
          is_active: true,
        };
      }) ?? [];

    // Upsert in chunks to avoid payload limits
    let created = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { data, error } = await supabaseAdmin
        .from("hn_agents")
        .upsert(chunk as any, { onConflict: "site_id,service_id", ignoreDuplicates: false })
        .select("id");
      if (error) throw new Error(error.message);
      created += data?.length ?? 0;
    }
    return { ok: true, generated: created, total_services: rows.length };
  });

export const setAgentActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; active: boolean }) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("hn_agents")
      .update({ is_active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const activateAllAgents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("hn_agents")
      .update({ is_active: true })
      .eq("is_active", false)
      .select("id");
    if (error) throw new Error(error.message);
    return { ok: true, activated: data?.length ?? 0 };
  });

export const runAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; payload?: unknown }) =>
    z.object({ id: z.string().uuid(), payload: z.unknown().optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const t0 = Date.now();
    const started = new Date().toISOString();
    const { data: run, error: runErr } = await supabaseAdmin
      .from("hn_agent_runs")
      .insert({ agent_id: data.id, status: "running", input: (data.payload ?? {}) as any, started_at: started })
      .select("id")
      .single();
    if (runErr) throw new Error(runErr.message);

    const output = { simulated: true, message: "Agent invoked (offline dry-run). Real execution happens in the Python runtime on d:\\hn." };
    const finished = new Date().toISOString();
    const latency = Date.now() - t0;

    await supabaseAdmin
      .from("hn_agent_runs")
      .update({ status: "succeeded", output: output as any, finished_at: finished, latency_ms: latency })
      .eq("id", run.id);

    await supabaseAdmin.rpc("has_role", { _user_id: context.userId, _role: "admin" }); // noop safety
    const { data: existing } = await supabaseAdmin
      .from("hn_agents")
      .select("runs_count")
      .eq("id", data.id)
      .single();
    await supabaseAdmin
      .from("hn_agents")
      .update({
        last_run_at: finished,
        last_run_status: "succeeded",
        runs_count: (existing?.runs_count ?? 0) + 1,
      })
      .eq("id", data.id);

    return { ok: true, run_id: run.id, latency_ms: latency, output };
  });
