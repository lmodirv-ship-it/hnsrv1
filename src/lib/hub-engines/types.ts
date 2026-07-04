// Shared types for the 5-engine HN Service Hub orchestrator.

export type EngineStage =
  | "analyze"
  | "plan"
  | "dispatch"
  | "collect"
  | "build";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export type AnalyzerResult = {
  language: string;
  intent: string; // canonical intent slug (e.g. "build_website", "generate_logo")
  entities: Record<string, Json>;
  domain?: string; // e.g. restaurant, ecommerce, blog
  summary: string;
};

export type PlanTask = {
  id: string; // stable id used for depends_on refs (e.g. "t1", "logo")
  type: string; // capability slug (e.g. "logo", "images", "texts", "database", "website", "deployment")
  title: string;
  inputs: Record<string, unknown>;
  depends_on: string[]; // ids of other tasks
};

export type PlanGraph = {
  tasks: PlanTask[];
};

export type TaskExecution = {
  task_id: string;
  type: string;
  status: "pending" | "running" | "succeeded" | "failed" | "skipped";
  target_service_id: string | null;
  target_site: string | null;
  output: unknown;
  error: string | null;
  started_at?: string;
  finished_at?: string;
  latency_ms?: number;
};

export type CollectedResults = {
  by_task: Record<string, TaskExecution>;
  order: string[];
};

export type BuiltResponse = {
  status: "done" | "partial" | "failed";
  summary: string;
  results: Record<string, {
    type: string;
    site: string | null;
    output: unknown;
    error: string | null;
    ms?: number;
  }>;
};

export type OrchestrateContext = {
  planId: string;
  authMode: "internal" | "external";
  apiKeyId: string | null;
  internalConnectorId: string | null;
  requesterSite: string | null;
};
