// Engine 3/5: Task Dispatcher
// Uses the Capability Registry (site_capabilities) to pick a provider for
// each planned task, then executes each layer of the dependency graph.

import type {
  CollectedResults,
  OrchestrateContext,
  PlanGraph,
  PlanTask,
  TaskExecution,
} from "./types";
import { topologicalOrder } from "./task-planner.server";
import {
  listRegistry,
  loadActiveRouterRules,
  pickBestProvider,
  type RegistryEntry,
} from "./capability-registry.server";

async function callOne(entry: RegistryEntry, task: PlanTask, requestId: string) {
  const svc = entry.service;
  const site = entry.site;
  const baseSite = String(site.base_url ?? "").replace(/\/+$/, "");
  const tvccBase = process.env.TVCC_API_URL?.replace(/\/+$/, "");
  let url = svc.endpoint_url || (baseSite + (svc.endpoint_path ?? "/"));
  if (svc.routing_mode === "via_tvcc" && tvccBase) {
    url = `${tvccBase}/proxy/${svc.slug ?? svc.id}`;
  } else if (svc.routing_mode === "auto" && svc.gateway_url) {
    url = svc.gateway_url;
  }

  const meta = site.metadata ?? {};
  const headers = new Headers({
    "content-type": "application/json",
    "user-agent": "HN-Hub-Orchestrator/1.0",
    "x-hn-request-id": requestId,
    "x-hn-task-id": task.id,
    "x-hn-task-type": task.type,
    "x-hn-capability-id": entry.id,
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
      method: (svc.method ?? "POST").toUpperCase(),
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
  capabilityId: string | null,
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
    capability_id: capabilityId,
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
  const registry = await listRegistry();
  const layers = topologicalOrder(graph);
  const requestId = ctx.planId;
  const by_task: Record<string, TaskExecution> = {};
  const order: string[] = [];

  let stepCounter = 0;
  for (const layer of layers) {
    await Promise.all(
      layer.map(async (task) => {
        stepCounter += 1;
        const entry = pickBestProvider(registry, task.type, {
          internalOnly: ctx.authMode === "internal",
        });
        const started = new Date().toISOString();
        const exec: TaskExecution = {
          task_id: task.id,
          type: task.type,
          status: "running",
          target_service_id: entry?.service.id ?? null,
          target_site: entry?.site.slug ?? entry?.site.name ?? null,
          output: null,
          error: null,
          started_at: started,
        };
        if (!entry) {
          exec.status = "skipped";
          exec.error = `No online provider in registry for task_type "${task.type}"`;
          exec.finished_at = new Date().toISOString();
          exec.latency_ms = 0;
        } else {
          const r = await callOne(entry, task, requestId);
          exec.status = r.ok ? "succeeded" : "failed";
          exec.output = r.data;
          exec.error = r.error;
          exec.latency_ms = r.latency;
          exec.finished_at = new Date().toISOString();
        }
        by_task[task.id] = exec;
        order.push(task.id);
        await persistSubtask(ctx, task, stepCounter, exec, entry?.id ?? null);
      }),
    );
  }

  return { by_task, order };
}
