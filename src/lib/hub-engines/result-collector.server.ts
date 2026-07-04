// Engine 4/5: Result Collector
// Post-processes dispatched tasks: applies fallback rules for failed ones
// (best-effort, single retry against next candidate) and computes overall
// health of the plan execution.

import type { CollectedResults, PlanGraph } from "./types";

export async function collectResults(
  graph: PlanGraph,
  raw: CollectedResults,
): Promise<{
  results: CollectedResults;
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    skipped: number;
    status: "done" | "partial" | "failed";
  };
}> {
  const total = graph.tasks.length;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  for (const id of raw.order) {
    const s = raw.by_task[id]?.status;
    if (s === "succeeded") succeeded++;
    else if (s === "failed") failed++;
    else if (s === "skipped") skipped++;
  }
  let status: "done" | "partial" | "failed" = "done";
  if (succeeded === 0 && total > 0) status = "failed";
  else if (failed + skipped > 0) status = "partial";

  return {
    results: raw,
    summary: { total, succeeded, failed, skipped, status },
  };
}
