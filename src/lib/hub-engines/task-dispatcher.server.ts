// Engine 3/5: Task Dispatcher
// Maps each planned task to an HN service (by capability) and executes
// them layer-by-layer via the existing hub executor logic, respecting
// dependency order and parallelizing independent tasks.

import type {
  CollectedResults,
  OrchestrateContext,
  PlanGraph,
  PlanTask,
  TaskExecution,
} from "./types";
import { topologicalOrder } from "./task-planner.server";

type ServiceRow = {
  id: string;
  name: string;
  slug: string | null;
  category: string | null;
  capabilities: string[] | null;
  network_type: string | null;
  is_active: boolean;
  approval_status: string | null;
  sites: { slug: string | null; base_url: string | null; metadata: any } | null;
  endpoint_url: string | null;
  endpoint_path: string | null;
  method: string | null;
  routing_mode: string | null;
  gateway_url: string | null;
};

async function loadCandidateServices(): Promise<ServiceRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("services")
    .select("id, name, slug, category, capabilities, network_type, is_active, approval_status, endpoint_url, endpoint_path, method, routing_mode, gateway_url, sites(slug, base_url, metadata)")
    .eq("is_active", true)
    .eq("approval_status", "approved");
  return (data ?? []) as unknown as ServiceRow[];
}

export async function listAvailableCapabilities(): Promise<string[]> {
  const services = await loadCandidateServices();
  const caps = new Set<string>();
  for (const s of services) {
    for (const c of s.capabilities ?? []) caps.add(c);
    if (s.category) caps.add(s.category);
  }
  return [...caps];
}

function pickServiceForTask(
  task: PlanTask,
  services: ServiceRow[],
  allowInternalOnly: boolean,
): ServiceRow | null {
  const t = task.type.toLowerCase();
  const scored = services
    .filter((s) => (allowInternalOnly ? s.network_type === "internal" : true))
    .map((s) => {
      let score = 0;
      const caps = (s.capabilities ?? []).map((c) => c.toLowerCase());
      if (caps.includes(t)) score += 5;
      if ((s.category ?? "").toLowerCase() === t) score += 3;
      if ((s.slug ?? "").toLowerCase().includes(t)) score += 2;
      if ((s.name ?? "").toLowerCase().includes(t)) score += 1;
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.s ?? null;
}

// Very lightweight local executor for a single service call. Reuses
// hub-executor's URL/credential logic so behavior stays consistent.
async function callOne(service: ServiceRow, task: PlanTask, requestId: string) {
  const baseSite = String(service.sites?.base_url ?? "").replace(/\/+$/, "");
  const tvccBase = process.env.TVCC_API_URL?.replace(/\/+$/, "");
  let url = service.endpoint_url || (baseSite + (service.endpoint_path ?? "/"));
  if (service.routing_mode === "via_tvcc" && tvccBase) {
    url = `${tvccBase}/proxy/${service.slug ?? service.id}`;
  } else if (service.routing_mode === "auto" && service.gateway_url) {
    url = service.gateway_url;
  }

  const meta = service.sites?.metadata ?? {};
  const headers = new Headers({
    "content-type": "application/json",
    "user-agent": "HN-Hub-Orchestrator/1.0",
    "x-hn-request-id": requestId,
    "x-hn-task-id": task.id,
    "x-hn-task-type": task.type,
  });
  const envNames: string[] = [meta.keyEnv, meta.keyFallbackEnv].filter(Boolean);
  let injected = false;
  for (const name of envNames) {
    const val = process.env[name];
    if (val) {
      headers.set("authorization", `Bearer ${val}`);
      headers.set("x-api-key", val);
      injected = true;
      break;
    }
  }
  if (!injected && process.env.HN_API_KEY) {
    headers.set("authorization", `Bearer ${process.env.HN_API_KEY}`);
  }

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 20_000);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: (service.method ?? "POST").toUpperCase(),
      headers,
      body: JSON.stringify({ task: task.type, inputs: task.inputs, id: task.id }),
      signal: ctrl.signal,
    });
    const ct = res.headers.get("content-type") ?? "";
    let data: unknown = null;
    if (ct.includes("application/json")) {
      try { data = await res.json(); } catch { data = null; }
    } else {
      data = (await res.text()).slice(0, 100_000);
    }
    return {
      status: res.status,
      data,
      ok: res.ok,
      latency: Date.now() - t0,
      error: res.ok ? null : `Upstream ${res.status}`,
    };
  } catch (e: any) {
    const abort = e?.name === "AbortError";
    return {
      status: abort ? 504 : 502,
      data: null,
      ok: false,
      latency: Date.now() - t0,
      error: abort ? "Upstream timeout" : "Upstream fetch failed",
    };
  } finally {
    clearTimeout(to);
  }
}

async function persistSubtask(
  ctx: OrchestrateContext,
  task: PlanTask,
  step: number,
  exec: TaskExecution,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("pipeline_subtasks").insert({
    plan_id: ctx.planId,
    task_key: task.id,
    task_type: task.type,
    depends_on: task.depends_on,
    plan_step: step,
    engine_stage: "dispatch",
    service_id: exec.target_service_id,
    status: exec.status,
    error: exec.error,
    latency_ms: exec.latency_ms ?? null,
    started_at: exec.started_at ?? null,
    finished_at: exec.finished_at ?? null,
    payload: task.inputs as any,
    response: exec.output as any,
  } as any);
}

export async function dispatchPlan(
  graph: PlanGraph,
  ctx: OrchestrateContext,
): Promise<CollectedResults> {
  const services = await loadCandidateServices();
  const layers = topologicalOrder(graph);
  const requestId = ctx.planId;
  const by_task: Record<string, TaskExecution> = {};
  const order: string[] = [];

  let stepCounter = 0;
  for (const layer of layers) {
    await Promise.all(
      layer.map(async (task) => {
        stepCounter += 1;
        const svc = pickServiceForTask(task, services, ctx.authMode === "internal");
        const started = new Date().toISOString();
        const exec: TaskExecution = {
          task_id: task.id,
          type: task.type,
          status: "running",
          target_service_id: svc?.id ?? null,
          target_site: svc?.sites?.slug ?? null,
          output: null,
          error: null,
          started_at: started,
        };
        if (!svc) {
          exec.status = "skipped";
          exec.error = `No service found for capability "${task.type}"`;
          exec.finished_at = new Date().toISOString();
          exec.latency_ms = 0;
        } else {
          const r = await callOne(svc, task, requestId);
          exec.status = r.ok ? "succeeded" : "failed";
          exec.output = r.data;
          exec.error = r.error;
          exec.latency_ms = r.latency;
          exec.finished_at = new Date().toISOString();
        }
        by_task[task.id] = exec;
        order.push(task.id);
        await persistSubtask(ctx, task, stepCounter, exec);
      }),
    );
  }

  return { by_task, order };
}
