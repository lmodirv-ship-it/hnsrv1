// Top-level HN Service Hub orchestration entrypoint. SERVER ONLY.
// Runs the 5 engines end-to-end for a single natural-language request and
// persists progress into hub_plans + pipeline_subtasks.

import type { AuthedKey } from "./hub-executor.server";
import { analyzeRequest } from "./hub-engines/request-analyzer.server";
import { dispatchPlan } from "./hub-engines/task-dispatcher.server";
import { planTasks } from "./hub-engines/task-planner.server";
import { collectResults } from "./hub-engines/result-collector.server";
import { buildResponse } from "./hub-engines/response-builder.server";
import { listAvailableTaskTypes } from "./hub-engines/capability-registry.server";
import type { OrchestrateContext } from "./hub-engines/types";
import { collectResults } from "./hub-engines/result-collector.server";
import { buildResponse } from "./hub-engines/response-builder.server";
import type { OrchestrateContext } from "./hub-engines/types";

export type OrchestrateInput = {
  prompt: string;
  requester_site?: string | null;
};

export async function orchestrate(key: AuthedKey, input: OrchestrateInput) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const prompt = input.prompt.trim();
  const authMode = key.auth_mode;
  const requesterSite =
    input.requester_site ??
    (authMode === "internal" ? key.connector?.site_slug ?? null : key.client?.name ?? null);

  // Create plan row up-front so callers can poll.
  const { data: created, error: cErr } = await supabaseAdmin
    .from("hub_plans")
    .insert({
      auth_mode: authMode,
      api_key_id: authMode === "external" ? key.id : null,
      internal_connector_id: authMode === "internal" ? key.id : null,
      requester_site: requesterSite,
      prompt,
      status: "analyzing",
    })
    .select("id")
    .single();
  if (cErr || !created) {
    return { ok: false as const, error: cErr?.message ?? "Failed to create plan" };
  }
  const planId = created.id as string;
  const ctx: OrchestrateContext = {
    planId,
    authMode,
    apiKeyId: authMode === "external" ? key.id : null,
    internalConnectorId: authMode === "internal" ? key.id : null,
    requesterSite,
  };

  const timings: Record<string, number> = {};
  const stamp = async (
    stage: "analyze" | "plan" | "dispatch" | "collect" | "build",
    ms: number,
    patch: Record<string, unknown>,
  ) => {
    timings[stage] = ms;
    await supabaseAdmin.from("hub_plans").update({ ...patch, timings }).eq("id", planId);
  };

  try {
    // 1) Analyze
    let t = Date.now();
    const analysis = await analyzeRequest(prompt);
    await stamp("analyze", Date.now() - t, {
      status: "planning",
      language: analysis.language,
      user_intent: analysis.intent,
      entities: analysis.entities as any,
    });

    // 2) Plan
    t = Date.now();
    const caps = await listAvailableCapabilities();
    const graph = await planTasks(prompt, analysis, caps);
    await stamp("plan", Date.now() - t, {
      status: "dispatching",
      plan_graph: graph as any,
    });

    // 3) Dispatch
    t = Date.now();
    const raw = await dispatchPlan(graph, ctx);
    await stamp("dispatch", Date.now() - t, { status: "collecting" });

    // 4) Collect
    t = Date.now();
    const collected = await collectResults(graph, raw);
    await stamp("collect", Date.now() - t, { status: "building" });

    // 5) Build
    t = Date.now();
    const response = buildResponse(analysis, graph, collected);
    await stamp("build", Date.now() - t, {
      status: response.status === "failed" ? "failed" : "done",
      final_response: response as any,
    });

    return {
      ok: true as const,
      plan_id: planId,
      analysis,
      plan: graph,
      response,
      timings,
    };
  } catch (e: any) {
    const message = String(e?.message ?? e);
    await supabaseAdmin.from("hub_plans").update({ status: "failed", error: message, timings }).eq("id", planId);
    return { ok: false as const, plan_id: planId, error: message };
  }
}
