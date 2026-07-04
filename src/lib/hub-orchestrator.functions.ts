// Client-callable server functions for the HN Service Hub orchestrator.
// Used by the /orchestration UI to preview and inspect plans.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const runOrchestration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      prompt: z.string().min(1).max(4000),
      requester_site: z.string().max(200).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Verify the caller has admin or developer role
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { data: isDev } = await supabase.rpc("has_role", { _user_id: context.userId, _role: "developer" });
    if (!isAdmin && !isDev) throw new Error("Forbidden");

    const { orchestrate } = await import("@/lib/hub-orchestrator.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve the built-in "Hub Console" internal connector so the caller
    // identity satisfies hub_plans/service_requests foreign keys.
    const { data: consoleConn } = await supabaseAdmin
      .from("internal_connectors")
      .select("id, site_id, name, trust_level, allowed_internal_services, sites!inner(slug, name)")
      .eq("id", "00000000-0000-0000-0000-0000000c0002")
      .maybeSingle();

    if (!consoleConn) throw new Error("Hub Console connector not provisioned");

    const result = await orchestrate(
      {
        id: consoleConn.id,
        client_id: null,
        auth_mode: "internal",
        client: null,
        connector: {
          site_id: consoleConn.site_id,
          site_slug: (consoleConn as any).sites?.slug ?? "hub-console",
          site_name: (consoleConn as any).sites?.name ?? "Hub Console",
          trust_level: consoleConn.trust_level,
          allowed_internal_services: (consoleConn.allowed_internal_services as any) ?? [],
        },
      } as any,
      { prompt: data.prompt, requester_site: data.requester_site ?? "hub-console" },
    );
    return result;
  });

export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("hub_plans")
      .select("id, prompt, status, user_intent, language, timings, created_at, final_response")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: plan, error } = await context.supabase
      .from("hub_plans")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!plan) throw new Error("Plan not found");

    const { data: subtasks } = await context.supabase
      .from("pipeline_subtasks")
      .select("id, task_key, task_type, depends_on, plan_step, engine_stage, service_id, status, error, latency_ms, started_at, finished_at, payload, response")
      .eq("plan_id", data.id)
      .order("plan_step", { ascending: true });

    return { plan, subtasks: subtasks ?? [] };
  });
