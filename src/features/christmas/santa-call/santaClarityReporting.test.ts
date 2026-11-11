import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clarityReport,
  parseClarityReport,
} from "../../../../supabase/functions/_shared/christmas/santaClarityReporting";
const payload = [
  {
    metricName: "Traffic",
    information: [{ totalSessionCount: "12", totalBotSessionCount: "2" }],
  },
];
afterEach(() => vi.unstubAllGlobals());
describe("Clarity reporting", () => {
  it("keeps project-wide rolling data distinct from Santa period totals", () => {
    const result = parseClarityReport(payload, "2026-11-11T09:00:00Z");
    expect(result.metrics.map((m) => m.value)).toEqual([12, 2]);
    expect(result.detail).toContain("Întregul site");
    expect(result.detail).toContain("72 de ore");
    expect(result.metrics[0].id).toBe("clarity_sessions");
  });
  it.each([
    null,
    [],
    [{ metricName: "Traffic", information: [] }],
    [
      {
        metricName: "Traffic",
        information: [{ totalSessionCount: "no", totalBotSessionCount: 0 }],
      },
    ],
  ])("rejects incomplete results instead of reporting zero", (value) => {
    expect(() => parseClarityReport(value, "2026-11-11T09:00:00Z")).toThrow();
  });
  it("does not make provider requests without credentials", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect((await clarityReport(() => undefined, {})).status).toBe(
      "unavailable",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses the shared cached result when another worker holds the lease", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const report = parseClarityReport(payload, "2026-11-11T09:00:00Z");
    const service = {
      rpc: vi.fn().mockResolvedValue({ data: { claimed: false, report } }),
    };
    expect(await clarityReport(() => "secret", service)).toEqual(report);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("fails closed if quota protection is unavailable", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(
      (
        await clarityReport(() => "secret", {
          rpc: async () => ({ error: { message: "missing" } }),
        })
      ).status,
    ).toBe("unavailable");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("persists a valid response without storing the provider token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))),
    );
    const update = vi.fn(() => ({ eq: async () => ({ error: null }) }));
    const service = {
      rpc: async () => ({ data: { claimed: true } }),
      from: () => ({ update }),
    };
    const result = await clarityReport(() => "private-token", service);
    expect(result.status).toBe("connected");
    expect(JSON.stringify(update.mock.calls)).not.toContain("private-token");
  });
  it("does not leak provider error content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("private-token", { status: 401 })),
    );
    const service = {
      rpc: async () => ({ data: { claimed: true } }),
      from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }),
    };
    const result = await clarityReport(() => "private-token", service);
    expect(result.status).toBe("error");
    expect(JSON.stringify(result)).not.toContain("private-token");
  });
});
