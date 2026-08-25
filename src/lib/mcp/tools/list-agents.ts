import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_agents",
  title: "List agents",
  description: "List HN agents (one per site × service) with their status and run counts.",
  inputSchema: {
    active_only: z.boolean().default(false).describe("Only return active agents."),
    limit: z.number().int().min(1).max(500).default(100).describe("Max agents to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ active_only, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("hn_agents")
      .select("id, agent_number, name, slug, site_name, service_name, role, is_active, last_run_at, last_run_status, runs_count")
      .order("agent_number", { ascending: true })
      .limit(limit);
    if (active_only) query = query.eq("is_active", true);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { agents: data ?? [] },
    };
  },
});
