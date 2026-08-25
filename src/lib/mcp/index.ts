import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listSitesTool from "./tools/list-sites";
import listServicesTool from "./tools/list-services";
import listAgentsTool from "./tools/list-agents";

// The OAuth issuer MUST be the direct Supabase host (never the .lovable.cloud proxy).
// Vite inlines VITE_SUPABASE_PROJECT_ID as a literal at build time.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "hn-srv",
  title: "HN srv",
  version: "0.1.0",
  instructions:
    "Tools for the HN Service Hub. Use list_sites, list_services, and list_agents to inspect the HN mesh as the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listSitesTool, listServicesTool, listAgentsTool],
});
