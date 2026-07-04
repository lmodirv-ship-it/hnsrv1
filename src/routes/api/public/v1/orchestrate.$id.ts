import { createFileRoute } from "@tanstack/react-router";

// GET /api/public/v1/orchestrate/:id — poll a plan's status + subtasks.
export const Route = createFileRoute("/api/public/v1/orchestrate/$id")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { corsHeaders } = await import("@/lib/hub-executor.server");
        return new Response(null, { status: 204, headers: corsHeaders() });
      },
      GET: async ({ request, params }) => {
        const { authenticate, jsonResponse } = await import("@/lib/hub-executor.server");
        const auth = await authenticate(request);
        if ("error" in auth) return jsonResponse(401, { ok: false, error: auth.error });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: plan, error } = await supabaseAdmin
          .from("hub_plans")
          .select("*")
          .eq("id", params.id)
          .maybeSingle();
        if (error) return jsonResponse(500, { ok: false, error: error.message });
        if (!plan) return jsonResponse(404, { ok: false, error: "Plan not found" });

        const { data: subtasks } = await supabaseAdmin
          .from("pipeline_subtasks")
          .select("task_key, task_type, depends_on, plan_step, status, error, latency_ms, service_id, response")
          .eq("plan_id", params.id)
          .order("plan_step", { ascending: true });

        return jsonResponse(200, { ok: true, plan, subtasks: subtasks ?? [] });
      },
    },
  },
});
