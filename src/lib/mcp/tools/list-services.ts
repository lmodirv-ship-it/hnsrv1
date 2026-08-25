import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_services",
  title: "List services",
  description: "List services registered in the HN mesh, optionally filtered by site.",
  inputSchema: {
    site_slug: z.string().optional().describe("Filter services by site slug."),
    limit: z.number().int().min(1).max(500).default(100).describe("Max services to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ site_slug, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("services")
      .select("id, name, slug, category, capabilities, is_active, site_id")
      .order("name", { ascending: true })
      .limit(limit);
    if (site_slug) {
      const { data: site, error: sErr } = await supabase
        .from("sites")
        .select("id")
        .eq("slug", site_slug)
        .maybeSingle();
      if (sErr) return { content: [{ type: "text", text: sErr.message }], isError: true };
      if (!site) return { content: [{ type: "text", text: `Site not found: ${site_slug}` }], isError: true };
      query = query.eq("site_id", site.id);
    }
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { services: data ?? [] },
    };
  },
});
