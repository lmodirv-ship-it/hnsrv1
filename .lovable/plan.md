# HN Service Hub — 5-Engine Architecture

Restructure the Hub from a simple router into a full orchestration brain with five sequential engines. The **Task Planner** becomes the heart of the system: it turns a natural-language request into an ordered task graph, then the Dispatcher sends each task to the right HN site.

## The 5 Engines

```text
User Request
     │
     ▼
┌────────────────────┐
│ 1. Request Analyzer│  → understand intent, extract entities, detect language
└────────────────────┘
     │
     ▼
┌────────────────────┐
│ 2. Task Planner    │  → decompose into ordered tasks with dependencies
└────────────────────┘   (uses Lovable AI to build a task graph)
     │
     ▼
┌────────────────────┐
│ 3. Task Dispatcher │  → map each task → HN site (Logo→HN Image, DB→HN DB…)
└────────────────────┘   run in parallel where possible, serial where dependent
     │
     ▼
┌────────────────────┐
│ 4. Result Collector│  → gather subtask outputs, retry/fallback on failure
└────────────────────┘
     │
     ▼
┌────────────────────┐
│ 5. Response Builder│  → assemble final structured response for the caller
└────────────────────┘
     │
     ▼
Final Response
```

## What Changes

### 1. Database (new migration)
- New table `hub_plans` — one row per user request, stores analyzer output + planner graph + final response.
  - `id`, `request_id` (FK service_requests), `user_intent`, `entities` jsonb, `language`, `plan_graph` jsonb, `status`, `final_response` jsonb, timestamps.
- Extend `pipeline_subtasks` with `depends_on uuid[]`, `plan_step` int, `engine_stage` text (`analyze|plan|dispatch|collect|build`).
- Grants + RLS aligned with existing tables (authenticated + service_role; org-scoped).

### 2. Engine modules (`src/lib/hub-engines/`)
Each engine is a pure server module composed by the executor:
- `request-analyzer.server.ts` — calls Lovable AI to classify intent (`website|logo|content|deployment|…`), extract entities, detect language.
- `task-planner.server.ts` — calls Lovable AI with a structured JSON schema to produce `{ tasks: [{ id, type, inputs, depends_on }] }`. Includes a rule-based fallback for common patterns (e.g. "restaurant website" → logo→images→texts→db→site→deploy).
- `task-dispatcher.server.ts` — resolves each task type to a target site via `services` table (`service.capability = task.type`), respects `depends_on` topological order, parallelizes independent tasks. Reuses the existing internal-connector auth path.
- `result-collector.server.ts` — awaits subtasks, applies `fallback_rules` on failure, stores partial results.
- `response-builder.server.ts` — merges collected artifacts (urls, ids, text) into one caller-facing payload keyed by task id.

### 3. Hub Executor
`src/lib/hub-executor.server.ts` gains a new entry `orchestrate(request)` that runs the 5 engines in sequence, writing progress into `hub_plans` and `pipeline_subtasks`. The existing single-service `execute()` path stays for direct calls; `orchestrate()` is the default for natural-language requests coming through `/api/public/v1/ask`.

### 4. Public API
- `POST /api/public/v1/orchestrate` — new endpoint: `{ prompt, context? }` → returns `{ plan_id, tasks, response }`.
- `GET /api/public/v1/orchestrate/:id` — poll plan status + partial results.
- `/api/public/v1/ask` switches to call `orchestrate()` internally instead of a single service.

### 5. UI (`/orchestration`)
New authenticated route showing:
- Live plan graph (each node = task, edges = dependencies, colored by stage).
- Per-engine timing (analyze / plan / dispatch / collect / build).
- Drill-down into each subtask (target site, request, response, tokens/cost).
- Replay button (re-runs planner with same prompt).

Sidebar entry under "HN Service Hub" section (i18n keys added for AR/EN).

## Technical Notes

- Task Planner prompt uses `response_format: json_schema` (Lovable AI Gateway supports it) so we get a strict `{ tasks: [...] }` back.
- Dispatcher's site resolution: extend `services` with a `capabilities text[]` column so a task type like `"logo"` finds any service declaring that capability; falls back to `fallback_rules`.
- All engines run inside a single `createServerFn` `orchestrate` so SSR / RPC boundary is respected; no client-side orchestration.
- Internal-connector auth from previous work is reused verbatim for dispatcher → HN sites.
- Response Builder returns a stable shape: `{ plan_id, status, results: { [taskId]: { type, output, site, ms } }, summary }`.

## Files (approximate)

- `supabase/migrations/<ts>_hub_engines.sql` — `hub_plans`, subtask cols, `services.capabilities`.
- `src/lib/hub-engines/{request-analyzer,task-planner,task-dispatcher,result-collector,response-builder}.server.ts`
- `src/lib/hub-orchestrator.functions.ts` — `orchestrate`, `getPlan` server fns.
- `src/lib/hub-executor.server.ts` — wire `orchestrate()`.
- `src/routes/api/public/v1/orchestrate.ts` (+ `orchestrate.$id.ts`)
- `src/routes/api/public/v1/ask.ts` — delegate to orchestrator.
- `src/routes/_authenticated.orchestration.tsx` — plan graph UI.
- `src/components/app-shell.tsx`, `src/i18n/translations.ts` — nav + strings.

Approve and I'll build it end-to-end.
