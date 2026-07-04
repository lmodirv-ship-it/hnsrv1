import { describe, it, expect } from "vitest";
import { pickBestProvider, type RegistryEntry } from "../capability-registry.server";

function entry(overrides: {
  id: string;
  service_id: string;
  status: RegistryEntry["status"];
  network_type?: string;
  task_type?: string;
}): RegistryEntry {
  return {
    id: overrides.id,
    site_id: `site-${overrides.id}`,
    service_id: overrides.service_id,
    task_type: overrides.task_type ?? "summarize",
    input_schema: {},
    output_schema: {},
    status: overrides.status,
    source: "manifest",
    last_probed_at: null,
    last_ok_at: null,
    metadata: {},
    service: {
      id: overrides.service_id,
      name: `svc-${overrides.service_id}`,
      slug: overrides.service_id,
      endpoint_url: "https://x.example/api",
      endpoint_path: null,
      method: "POST",
      routing_mode: "direct",
      gateway_url: null,
    },
    site: {
      id: `site-${overrides.id}`,
      slug: `site-${overrides.id}`,
      name: `site-${overrides.id}`,
      base_url: "https://x.example",
      metadata: {},
      network_type: overrides.network_type ?? "internal",
    },
  };
}

describe("pickBestProvider — task_router_rules precedence", () => {
  const registry: RegistryEntry[] = [
    entry({ id: "cap-a", service_id: "svc-a", status: "online" }),      // healthy default
    entry({ id: "cap-b", service_id: "svc-b", status: "degraded" }),    // preferred but degraded
    entry({ id: "cap-c", service_id: "svc-c", status: "offline" }),     // fallback but offline
    entry({ id: "cap-d", service_id: "svc-d", status: "unknown" }),     // unrelated
  ];

  it("falls back to health ranking when no rule is provided", () => {
    const pick = pickBestProvider(registry, "summarize", { internalOnly: false });
    expect(pick?.service.id).toBe("svc-a"); // online wins
  });

  it("prefers rule.preferred_service_id even when its status is degraded", () => {
    const pick = pickBestProvider(registry, "summarize", {
      internalOnly: false,
      preferredServiceId: "svc-b",
      fallbackServiceIds: ["svc-c"],
    });
    expect(pick?.service.id).toBe("svc-b");
  });

  it("picks a fallback service before non-rule services", () => {
    // Preferred svc missing from registry → fallback should still be chosen
    const pick = pickBestProvider(registry, "summarize", {
      internalOnly: false,
      preferredServiceId: "svc-missing",
      fallbackServiceIds: ["svc-c"],
    });
    expect(pick?.service.id).toBe("svc-c"); // offline but rule-listed beats non-rule
  });

  it("still filters by task_type and internalOnly regardless of rule", () => {
    const mixed: RegistryEntry[] = [
      entry({ id: "cap-x", service_id: "svc-x", status: "online", network_type: "external" }),
      entry({ id: "cap-y", service_id: "svc-y", status: "degraded", network_type: "internal" }),
    ];
    const pick = pickBestProvider(mixed, "summarize", {
      internalOnly: true,
      preferredServiceId: "svc-x", // external, must be excluded
    });
    expect(pick?.service.id).toBe("svc-y");
  });

  it("returns null when no candidate matches the task_type", () => {
    const pick = pickBestProvider(registry, "nonexistent-task", {
      internalOnly: false,
      preferredServiceId: "svc-a",
    });
    expect(pick).toBeNull();
  });

  it("ranks preferred > fallback > others, then by health", () => {
    const pick = pickBestProvider(registry, "summarize", {
      internalOnly: false,
      preferredServiceId: "svc-c", // offline preferred
      fallbackServiceIds: ["svc-b"], // degraded fallback
    });
    // preferred wins even though offline
    expect(pick?.service.id).toBe("svc-c");
  });
});
