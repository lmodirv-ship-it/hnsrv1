// Engine 2/5: Task Planner
// Decomposes a user request into an ordered task graph with dependencies.
// The heart of the system — every downstream engine consumes this graph.

import type { AnalyzerResult, PlanGraph, PlanTask } from "./types";
import { chatJSON } from "./lovable-ai.server";

// Rule-based templates keyed by canonical intent. Used as fallback and as
// grounding examples for the AI planner.
const TEMPLATES: Record<string, PlanTask[]> = {
  build_website: [
    { id: "logo",       type: "logo",       title: "Design brand logo",       inputs: {}, depends_on: [] },
    { id: "images",     type: "images",     title: "Generate hero + section images", inputs: {}, depends_on: ["logo"] },
    { id: "texts",      type: "texts",      title: "Write site copy and sections",   inputs: {}, depends_on: [] },
    { id: "database",   type: "database",   title: "Provision database schema",       inputs: {}, depends_on: [] },
    { id: "website",    type: "website",    title: "Assemble website",                inputs: {}, depends_on: ["logo", "images", "texts", "database"] },
    { id: "deployment", type: "deployment", title: "Deploy to HN Cloud",              inputs: {}, depends_on: ["website"] },
  ],
  generate_logo: [
    { id: "logo", type: "logo", title: "Design logo", inputs: {}, depends_on: [] },
  ],
  generate_images: [
    { id: "images", type: "images", title: "Generate images", inputs: {}, depends_on: [] },
  ],
  generate_texts: [
    { id: "texts", type: "texts", title: "Generate texts", inputs: {}, depends_on: [] },
  ],
  setup_database: [
    { id: "database", type: "database", title: "Provision database", inputs: {}, depends_on: [] },
  ],
  deploy_site: [
    { id: "deployment", type: "deployment", title: "Deploy site", inputs: {}, depends_on: [] },
  ],
  video: [
    { id: "video", type: "video", title: "Generate video", inputs: {}, depends_on: [] },
  ],
  chat: [
    { id: "chat", type: "chat", title: "Answer with chat model", inputs: {}, depends_on: [] },
  ],
  single_task: [
    { id: "task", type: "generic", title: "Handle single task", inputs: {}, depends_on: [] },
  ],
  unknown: [
    { id: "task", type: "generic", title: "Handle request", inputs: {}, depends_on: [] },
  ],
};

function fromTemplate(analysis: AnalyzerResult, prompt: string): PlanGraph {
  const base = TEMPLATES[analysis.intent] ?? TEMPLATES.unknown;
  return {
    tasks: base.map((t) => ({
      ...t,
      inputs: {
        prompt,
        domain: analysis.domain ?? null,
        language: analysis.language,
        ...analysis.entities,
      },
    })),
  };
}

function sanitizeGraph(raw: unknown, analysis: AnalyzerResult, prompt: string): PlanGraph {
  const g = raw as { tasks?: unknown };
  const tasks = Array.isArray(g?.tasks) ? g.tasks : [];
  const ids = new Set<string>();
  const cleaned: PlanTask[] = [];
  for (const t of tasks as any[]) {
    const id = String(t?.id ?? "").trim();
    const type = String(t?.type ?? "").trim();
    if (!id || !type || ids.has(id)) continue;
    ids.add(id);
    cleaned.push({
      id,
      type,
      title: String(t?.title ?? type),
      inputs: {
        prompt,
        domain: analysis.domain ?? null,
        language: analysis.language,
        ...(t?.inputs && typeof t.inputs === "object" ? t.inputs : {}),
      },
      depends_on: Array.isArray(t?.depends_on)
        ? t.depends_on.map(String).filter((d: string) => d !== id)
        : [],
    });
  }
  // Drop dangling deps
  for (const t of cleaned) t.depends_on = t.depends_on.filter((d) => ids.has(d));
  if (!cleaned.length) return fromTemplate(analysis, prompt);
  return { tasks: cleaned };
}

export type RegistryHint = {
  task_type: string;
  providers: number;
  sample_input: Record<string, unknown>;
};

export async function planTasks(
  prompt: string,
  analysis: AnalyzerResult,
  registryHints: RegistryHint[],
): Promise<PlanGraph> {
  const template = fromTemplate(analysis, prompt);
  const catalog = registryHints.length
    ? registryHints
        .map((h) => `${h.task_type} (${h.providers} provider${h.providers === 1 ? "" : "s"})`)
        .join(", ")
    : "text_generation, image_generation, audio_generation, video_generation, logo_design, database_creation, website_building, deployment, chat";

  const ai = await chatJSON<PlanGraph>({
    system:
      "You are the Task Planner for HN Service Hub. Given a user request and its analysis, produce an ordered task graph. " +
      "Each task has: id (stable slug), type (task_type slug from the catalog), title, inputs (object of parameters), depends_on (list of task ids). " +
      "ONLY use task types from this live registry catalog (others have no provider): " + catalog + ". " +
      "Keep it minimal — do not add tasks that aren't needed. Model real dependencies (e.g. deployment depends on website; website depends on assets).",
    user: JSON.stringify({
      prompt,
      analysis,
      registry: registryHints,
      example_template_for_this_intent: template,
    }),
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        tasks: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              type: { type: "string" },
              title: { type: "string" },
              inputs: { type: "object", additionalProperties: true },
              depends_on: { type: "array", items: { type: "string" } },
            },
            required: ["id", "type", "title", "depends_on"],
          },
        },
      },
      required: ["tasks"],
    },
    timeoutMs: 20_000,
  });

  if (ai.ok) return sanitizeGraph(ai.data, analysis, prompt);
  return template;
}

// Topological order for the Dispatcher.
export function topologicalOrder(graph: PlanGraph): PlanTask[][] {
  const byId = new Map(graph.tasks.map((t) => [t.id, t]));
  const remaining = new Set(graph.tasks.map((t) => t.id));
  const done = new Set<string>();
  const layers: PlanTask[][] = [];
  let safety = 0;
  while (remaining.size && safety++ < 100) {
    const layer: PlanTask[] = [];
    for (const id of remaining) {
      const t = byId.get(id)!;
      if (t.depends_on.every((d) => done.has(d))) layer.push(t);
    }
    if (!layer.length) {
      // Cycle or dangling — flush remaining
      for (const id of remaining) layer.push(byId.get(id)!);
    }
    for (const t of layer) { remaining.delete(t.id); done.add(t.id); }
    layers.push(layer);
  }
  return layers;
}
