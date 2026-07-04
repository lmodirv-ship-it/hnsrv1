import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PlanGraph, OrchestrateContext } from "../types";

// ---- Mocks ----------------------------------------------------------------

// site_capabilities rows returned by capability-registry.server → selectAll
const capabilityRows: any[] = [
  {
    id: "cap-a",
    site_id: "site-a",
    service_id: "svc-a",
    task_type: "summarize",
    input_schema: {},
    output_schema: {},
    status: "online",
    source: "manifest",
    last_probed_at: null,
    last_ok_at: null,
    metadata: {},
    services: {
      id: "svc-a",
      name: "svc-a",
      slug: "svc-a",
      endpoint_url: "https://a.example/api",
      endpoint_path: null,
      method: "POST",
      routing_mode: "direct",
      gateway_url: null,
      is_active: true,
      approval_status: "approved",
    },
    sites: {
      id: "site-a",
      slug: "site-a",
      name: "site-a",
      base_url: "https://a.example",
      metadata: {},
      network_type: "internal",
    },
  },
  {
    id: "cap-b",
    site_id: "site-b",
    service_id: "svc-b",
    task_type: "summarize",
    input_schema: {},
    output_schema: {},
    status: "degraded",
    source: "manifest",
    last_probed_at: null,
    last_ok_at: null,
    metadata: {},
    services: {
      id: "svc-b",
      name: "svc-b",
      slug: "svc-b",
      endpoint_url: "https://b.example/api",
      endpoint_path: null,
      method: "POST",
      routing_mode: "direct",
      gateway_url: null,
      is_active: true,
      approval_status: "approved",
    },
    sites: {
      id: "site-b",
      slug: "site-b",
      name: "site-b",
      base_url: "https://b.example",
      metadata: {},
      network_type: "internal",
    },
  },
];

// Mutable router-rule store the test tweaks per case
let routerRules: any[] = [];

// Records of DB inserts for assertions
const inserted: any[] = [];

vi.mock("@/integrations/supabase/client.server", () => {
  const supabaseAdmin = {
    from(table: string) {
      if (table === "site_capabilities") {
        return {
          select: () => Promise.resolve({ data: capabilityRows, error: null }),
        };
      }
      if (table === "task_router_rules") {
        // Chainable filter builder that resolves to filtered rows
        const state = { taskTypes: [] as string[], active: true };
        const builder: any = {
          select: () => builder,
          in: (_col: string, values: string[]) => {
            state.taskTypes = values;
            return builder;
          },
          eq: (col: string, val: any) => {
            if (col === "is_active") state.active = val;
            return builder;
          },
          order: () => {
            const rows = routerRules
              .filter(
                (r) =>
                  state.taskTypes.includes(r.task_type) &&
                  r.is_active === state.active,
              )
              .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
            return Promise.resolve({ data: rows, error: null });
          },
        };
        return builder;
      }
      if (table === "pipeline_subtasks") {
        return {
          insert: (row: any) => {
            inserted.push(row);
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    },
  };
  return { supabaseAdmin };
});

// ---- Import under test AFTER mocks ---------------------------------------

const { dispatchPlan } = await import("../task-dispatcher.server");

// ---- Test helpers --------------------------------------------------------

const graph: PlanGraph = {
  tasks: [
    {
      id: "t1",
      type: "summarize",
      title: "Summarize",
      inputs: { text: "hi" },
      depends_on: [],
    },
  ],
};

const ctx: OrchestrateContext = {
  planId: "plan-test-1",
  authMode: "external",
  apiKeyId: null,
  internalConnectorId: null,
  requesterSite: null,
};

// Track fetch calls (each returns a 200 JSON success)
let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  inserted.length = 0;
  routerRules = [];
  fetchSpy = vi.fn(async (url: string) => {
    return new Response(JSON.stringify({ ok: true, url }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---- Tests ---------------------------------------------------------------

describe("dispatchPlan — task_router_rules end-to-end", () => {
  it("routes to health-best (svc-a) when no rule is defined", async () => {
    routerRules = [];
    const res = await dispatchPlan(graph, ctx);
    const exec = res.by_task.t1;
    expect(exec.status).toBe("succeeded");
    expect(exec.target_service_id).toBe("svc-a");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe("https://a.example/api");
    // Persistence layer received the resolved service_id
    expect(inserted[0].service_id).toBe("svc-a");
  });

  it("routes to preferred service (svc-b) when an active rule points to it, even though svc-a is healthier", async () => {
    routerRules = [
      {
        task_type: "summarize",
        category: null,
        preferred_service_id: "svc-b",
        fallback_service_ids: [],
        priority: 1,
        conditions: {},
        is_active: true,
      },
    ];
    const res = await dispatchPlan(graph, ctx);
    const exec = res.by_task.t1;
    expect(exec.status).toBe("succeeded");
    expect(exec.target_service_id).toBe("svc-b");
    expect(fetchSpy.mock.calls[0][0]).toBe("https://b.example/api");
    expect(inserted[0].service_id).toBe("svc-b");
  });

  it("ignores inactive rules and falls back to health ranking", async () => {
    routerRules = [
      {
        task_type: "summarize",
        preferred_service_id: "svc-b",
        fallback_service_ids: [],
        priority: 1,
        conditions: {},
        is_active: false, // disabled
      },
    ];
    const res = await dispatchPlan(graph, ctx);
    expect(res.by_task.t1.target_service_id).toBe("svc-a");
  });

  it("uses fallback service when preferred is not in the registry", async () => {
    routerRules = [
      {
        task_type: "summarize",
        preferred_service_id: "svc-missing",
        fallback_service_ids: ["svc-b"],
        priority: 1,
        conditions: {},
        is_active: true,
      },
    ];
    const res = await dispatchPlan(graph, ctx);
    expect(res.by_task.t1.target_service_id).toBe("svc-b");
    expect(fetchSpy.mock.calls[0][0]).toBe("https://b.example/api");
  });

  it("applies distinct rules per task_type across a multi-task plan", async () => {
    // Add a second task_type to the registry
    capabilityRows.push({
      ...capabilityRows[0],
      id: "cap-a2",
      task_type: "translate",
      services: { ...capabilityRows[0].services },
      sites: { ...capabilityRows[0].sites },
    });
    capabilityRows.push({
      ...capabilityRows[1],
      id: "cap-b2",
      task_type: "translate",
      services: { ...capabilityRows[1].services },
      sites: { ...capabilityRows[1].sites },
    });

    routerRules = [
      // summarize prefers svc-b
      {
        task_type: "summarize",
        preferred_service_id: "svc-b",
        fallback_service_ids: [],
        priority: 1,
        conditions: {},
        is_active: true,
      },
      // translate has no rule → health wins (svc-a)
    ];

    const multi: PlanGraph = {
      tasks: [
        { id: "t1", type: "summarize", title: "s", inputs: {}, depends_on: [] },
        { id: "t2", type: "translate", title: "t", inputs: {}, depends_on: [] },
      ],
    };

    const res = await dispatchPlan(multi, ctx);
    expect(res.by_task.t1.target_service_id).toBe("svc-b");
    expect(res.by_task.t2.target_service_id).toBe("svc-a");

    // Cleanup added rows so other tests stay isolated
    capabilityRows.splice(2, 2);
  });
});
