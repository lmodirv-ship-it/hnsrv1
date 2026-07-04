// Engine 5/5: Response Builder
// Assembles the final caller-facing payload from collected task outputs.

import type {
  AnalyzerResult,
  BuiltResponse,
  CollectedResults,
  PlanGraph,
} from "./types";

export function buildResponse(
  analysis: AnalyzerResult,
  graph: PlanGraph,
  collected: {
    results: CollectedResults;
    summary: { total: number; succeeded: number; failed: number; skipped: number; status: "done" | "partial" | "failed" };
  },
): BuiltResponse {
  const results: BuiltResponse["results"] = {};
  for (const t of graph.tasks) {
    const exec = collected.results.by_task[t.id];
    if (!exec) continue;
    results[t.id] = {
      type: t.type,
      site: exec.target_site,
      output: exec.output,
      error: exec.error,
      ms: exec.latency_ms,
    };
  }

  const summaryParts: string[] = [];
  summaryParts.push(
    `Executed ${collected.summary.total} task(s) for intent "${analysis.intent}"`,
  );
  summaryParts.push(
    `${collected.summary.succeeded} succeeded, ${collected.summary.failed} failed, ${collected.summary.skipped} skipped`,
  );

  return {
    status: collected.summary.status,
    summary: summaryParts.join(" — "),
    results,
  };
}
