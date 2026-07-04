# Site Inventory → Service Discovery → Capability Registry → Task Engine

Add the missing layer that lets the Task Planner actually know what each HN site can do. Today `services.capabilities` is a free-text array — good enough to route, not good enough to plan against. This turns it into a structured, discoverable registry, wired directly into the 5-engine orchestrator.

## The 4 layers, in order

```text
1. Site Inventory       ← TVCC verified sites
        │
        ▼
2. Service Discovery    ← Hub probes each site's manifest
        │
        ▼
3. Capability Registry  ← site | service | task_type | inputs | outputs | status
        │
        ▼
4. Task Engine          ← Planner + Dispatcher read from registry only
```

## Database

New table **site_capabilities** — the canonical registry row per (service, task_type):

- `id`, `site_id`, `service_id`, `task_type` (e.g. `image_generation`, `audio_generation`, `video_generation`, `text_generation`, `database_creation`, `website_building`, `deployment`)
- `input_schema` jsonb (e.g. `{ text: "string", style?: "string" }`)
- `output_schema` jsonb (e.g. `{ url: "string", mime: "image/png" }`)
- `status` enum: `online | degraded | offline | unknown`
- `last_probed_at`, `last_ok_at`, `probe_error`
- `source` enum: `manifest | manual | inferred`
- Unique on `(service_id, task_type)`.

New table **discovery_runs** — one row per discovery pass:

- `id`, `site_id` (nullable = all sites), `started_at`, `finished_at`, `services_found`, `capabilities_found`, `errors_count`, `status`, `initiated_by`.

Extend **sites** with a discovery-manifest hint: `manifest_path text default '/.well-known/hn-services'`.

Grants + RLS: admins/developers can view; admins manage; `service_role` full.

Task-type vocabulary is stable/enumerable in code (`TASK_TYPES` constant) so the Planner can plan against a known set even when the registry is empty.

## Service Discovery

For each verified internal site (TVCC status = `verified`, `network_type = internal`):

1. Hub `GET`s the site's manifest URL (`base_url + manifest_path`) with the internal service token.
2. Manifest shape (Hub-defined, sites implement it):
   ```json
   {
     "site": { "name": "HN Audio AI", "version": "1.2.0" },
     "services": [
       {
         "slug": "voice-over",
         "name": "Voice Over",
         "endpoint": "/api/voice-over",
         "method": "POST",
         "capabilities": [
           {
             "task_type": "audio_generation",
             "input_schema": { "text": "string", "voice?": "string" },
             "output_schema": { "url": "string", "mime": "audio/mpeg" }
           }
         ]
       }
     ]
   }
   ```
3. Hub upserts `services` and `site_capabilities` rows, marks missing ones as `offline`.
4. Sites without a manifest fall back to `inferred` capabilities from existing `services.category` / `capabilities` columns so nothing breaks mid-migration.
5. Optional per-capability health probe (`HEAD` or configured `probe_path`) sets `status`.

Discovery is a `createServerFn` (admin/developer-gated) plus a public route `POST /api/public/v1/discovery/refresh` (internal token or admin JWT), so it can be triggered manually, on schedule, or by a webhook when TVCC verifies a new site.

## Task Engine, rewired

- **Planner** now receives the registry (`{ task_type, sites_offering_it, sample_input_schema }`) instead of a flat capabilities list, so it plans only against task types that are actually offered.
- **Dispatcher** picks a service by exact `task_type` match with `status = online`; ties broken by trust level then latency. Falls back to `degraded` if no `online`. Records the chosen capability id on each subtask.
- Subtasks store `capability_id` (nullable) so the UI can show "task X → HN Audio AI · voice_over · audio_generation".

## UI

New route `/registry` (under Discovery engine in the sidebar):

- **Sites tab** — TVCC-verified sites, "Refresh" per site, "Refresh all", last-discovered timestamp.
- **Registry tab** — searchable grid: task_type · site · service · status · last probed. Filter by task_type.
- **Manifest preview** — for a selected site, show the raw manifest JSON we ingested.

The Orchestration page (`/orchestration`) gets a small "Available task types" header pulled from the registry, so it's obvious what the planner can produce.

## Files

- `supabase/migrations/<ts>_site_registry.sql` — `site_capabilities`, `discovery_runs`, `sites.manifest_path`.
- `src/lib/hub-engines/service-discovery.server.ts` — manifest probe + registry upsert.
- `src/lib/hub-engines/capability-registry.server.ts` — read helpers (listByTaskType, listAll, forSite).
- `src/lib/hub-engines/task-types.ts` — canonical `TASK_TYPES` enum shared with Planner.
- `src/lib/hub-engines/task-dispatcher.server.ts` — swap capability lookup to `site_capabilities`.
- `src/lib/hub-engines/task-planner.server.ts` — feed registry-derived context into the AI prompt + template.
- `src/lib/registry.functions.ts` — server fns: `runDiscovery`, `listCapabilities`, `listRegistrySites`, `getSiteManifest`.
- `src/routes/api/public/v1/discovery.refresh.ts` — external trigger (internal-token or admin).
- `src/routes/_authenticated.registry.tsx` — Sites / Registry / Manifest UI.
- `src/components/app-shell.tsx`, `src/i18n/translations.ts` — nav + strings (`navRegistry`).

## Technical notes

- Manifest fetch uses the same credential-injection path as `hub-executor` (`site.metadata.keyEnv` → `HN_API_KEY` fallback). No new secret plumbing.
- All manifest ingestion is server-only (`.server.ts`) and gated by the internal auth path; external callers can never mutate the registry.
- Registry writes are idempotent (upsert on `(service_id, task_type)`); a discovery run never drops a capability, only marks it `offline` — history is preserved.
- Task Planner's fallback templates stay, but they now cross-check against the live registry and drop tasks with no online provider (Planner returns a `warnings[]` listing them instead of silently failing at dispatch time).

Approve and I'll implement.
