import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createHash, createHmac } from "crypto";

// The 6 core tables we mirror to HN-DB as external schema definitions.
// Kept as static definitions so the payload is deterministic and reviewable.
const MIRRORED_TABLES = [
  {
    name: "service_registry",
    description: "فهرس جميع الخدمات داخل منظومة HN",
    columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "name", type: "text", notNull: true },
      { name: "slug", type: "text", notNull: true, unique: true },
      { name: "base_url", type: "text" },
      { name: "network_type", type: "text" },
      { name: "status", type: "text" },
      { name: "created_at", type: "timestamptz" },
      { name: "updated_at", type: "timestamptz" },
    ],
  },
  {
    name: "service_capabilities",
    description: "قدرات كل خدمة (task_type -> service)",
    columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "service_id", type: "uuid", fk: "service_registry.id" },
      { name: "task_type", type: "text", notNull: true },
      { name: "input_schema", type: "jsonb" },
      { name: "output_schema", type: "jsonb" },
      { name: "status", type: "text" },
    ],
  },
  {
    name: "service_dependencies",
    description: "علاقات الاعتماد بين الخدمات",
    columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "service_id", type: "uuid", fk: "service_registry.id" },
      { name: "depends_on_service_id", type: "uuid", fk: "service_registry.id" },
      { name: "dependency_type", type: "text" },
    ],
  },
  {
    name: "task_router",
    description: "ربط نوع المهمة بالخدمة المنفِّذة",
    columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "task_type", type: "text", notNull: true },
      { name: "service_id", type: "uuid", fk: "service_registry.id" },
      { name: "priority", type: "integer" },
      { name: "active", type: "boolean" },
    ],
  },
  {
    name: "task_runs",
    description: "سجل كل عملية تنفيذ لمهمة",
    columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "task_type", type: "text" },
      { name: "service_id", type: "uuid", fk: "service_registry.id" },
      { name: "requested_by", type: "uuid" },
      { name: "status", type: "text" },
      { name: "input", type: "jsonb" },
      { name: "output", type: "jsonb" },
      { name: "started_at", type: "timestamptz" },
      { name: "finished_at", type: "timestamptz" },
    ],
  },
  {
    name: "task_steps",
    description: "خطوات تنفيذ كل مهمة",
    columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "task_run_id", type: "uuid", fk: "task_runs.id" },
      { name: "step_index", type: "integer" },
      { name: "name", type: "text" },
      { name: "status", type: "text" },
      { name: "started_at", type: "timestamptz" },
      { name: "finished_at", type: "timestamptz" },
      { name: "payload", type: "jsonb" },
    ],
  },
];

const HN_DB_MIRROR_PATH = "/api/external-schemas/mirror";

export const listSchemaMirrors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("external_schema_mirrors")
      .select("*")
      .order("target_name");
    if (error) throw new Error(error.message);
    return {
      mirrors: data ?? [],
      tables: MIRRORED_TABLES.map((t) => ({
        name: t.name,
        description: t.description,
        columns_count: t.columns.length,
      })),
    };
  });

export const syncSchemaMirror = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { target_name?: string }) => ({
    target_name: input?.target_name ?? "hn-db",
  }))
  .handler(async ({ data, context }) => {
    // admin only
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const { data: mirror, error: mErr } = await context.supabase
      .from("external_schema_mirrors")
      .select("*")
      .eq("target_name", data.target_name)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!mirror) throw new Error(`Mirror target not found: ${data.target_name}`);

    const payload = {
      source: mirror.source_name,
      target: mirror.target_name,
      mirrored_at: new Date().toISOString(),
      schema: "public",
      tables: MIRRORED_TABLES,
      note:
        "External schema mirror. Definitions only — no DDL is executed on the target. " +
        "The source of truth remains inside HN Service Hub.",
    };

    const bodyStr = JSON.stringify(payload);
    const payloadHash = createHash("sha256").update(bodyStr).digest("hex");

    const secret = process.env.HN_DB_MIRROR_SECRET;
    const signature = secret
      ? createHmac("sha256", secret).update(bodyStr).digest("hex")
      : null;

    // Allow env override per target so secrets can supply the real URL
    // without exposing it in DB rows.
    const envOverride =
      mirror.target_name === "hn-db"
        ? process.env.HN_DB_API_URL
        : mirror.target_name === "hn-cloud"
        ? process.env.HN_CLOUD_API_URL
        : null;
    const baseUrl = (envOverride || mirror.target_url).replace(/\/$/, "");
    const url = `${baseUrl}${HN_DB_MIRROR_PATH}`;
    const attemptedAt = new Date().toISOString();

    let status = "success";
    let lastError: string | null = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-source": "hn-service-hub",
          ...(signature ? { "x-signature": `sha256=${signature}` } : {}),
        },
        body: bodyStr,
      });
      if (!res.ok) {
        status = "failed";
        lastError = `HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`;
      }
    } catch (e) {
      status = "failed";
      lastError = e instanceof Error ? e.message : String(e);
    }

    const { error: uErr } = await context.supabase
      .from("external_schema_mirrors")
      .update({
        tables_count: MIRRORED_TABLES.length,
        payload_hash: payloadHash,
        last_attempt_at: attemptedAt,
        status,
        last_error: lastError,
        tables_snapshot: payload,
        ...(status === "success" ? { last_sync_at: attemptedAt } : {}),
      })
      .eq("id", mirror.id);
    if (uErr) throw new Error(uErr.message);

    return { status, lastError, url, payloadHash, tables: MIRRORED_TABLES.length };
  });
