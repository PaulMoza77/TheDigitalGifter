import { describe, expect, it } from "vitest";
import {
  CHANNEL_STALE_AFTER_MS,
  combineHealth,
  resolveChannelHealth,
  resolveFirstPartyHealth,
  type ChannelDeliveryEvidence,
} from "./funnelHealth";

function evidence(overrides: Partial<ChannelDeliveryEvidence> = {}): ChannelDeliveryEvidence {
  return {
    enabled: true,
    configured: true,
    deliveredRowCount: 0,
    lastSuccessAt: null,
    lastStatus: null,
    lastRowsUpserted: 0,
    ...overrides,
  };
}

describe("funnelHealth", () => {
  it("never marks GA4/Meta healthy without delivered rows", () => {
    expect(resolveChannelHealth(evidence({ configured: true, deliveredRowCount: 0 }))).toBe(
      "unverified",
    );
    expect(
      resolveChannelHealth(
        evidence({
          deliveredRowCount: 0,
          lastStatus: "success",
          lastRowsUpserted: 0,
          lastSuccessAt: new Date().toISOString(),
        }),
      ),
    ).toBe("unverified");
    expect(
      resolveChannelHealth(
        evidence({
          deliveredRowCount: 12,
          lastStatus: "success",
          lastRowsUpserted: 12,
          lastSuccessAt: new Date().toISOString(),
        }),
      ),
    ).toBe("healthy");
  });

  it("treats a failed sync with no rows as degraded, not healthy", () => {
    expect(resolveChannelHealth(evidence({ lastStatus: "error", deliveredRowCount: 0 }))).toBe(
      "degraded",
    );
    expect(resolveChannelHealth(evidence({ lastStatus: "error", deliveredRowCount: 4 }))).toBe(
      "degraded",
    );
  });

  it("marks stale delivery as degraded even when historical rows exist", () => {
    const staleAt = new Date(Date.now() - CHANNEL_STALE_AFTER_MS - 1000).toISOString();
    expect(
      resolveChannelHealth(
        evidence({
          deliveredRowCount: 20,
          lastStatus: "success",
          lastSuccessAt: staleAt,
        }),
      ),
    ).toBe("degraded");
  });

  it("disables channels that are not wired or configured", () => {
    expect(resolveChannelHealth(evidence({ enabled: false, deliveredRowCount: 99 }))).toBe(
      "disabled",
    );
    expect(resolveChannelHealth(evidence({ configured: false, deliveredRowCount: 99 }))).toBe(
      "disabled",
    );
  });

  it("resolves first-party from ingest evidence only", () => {
    expect(
      resolveFirstPartyHealth({
        enabled: false,
        ingestWired: false,
        eventCount: 0,
        recentFailureCount: 0,
      }),
    ).toBe("disabled");
    expect(
      resolveFirstPartyHealth({
        enabled: true,
        ingestWired: true,
        eventCount: 0,
        recentFailureCount: 0,
      }),
    ).toBe("unverified");
    expect(
      resolveFirstPartyHealth({
        enabled: true,
        ingestWired: true,
        eventCount: 8,
        recentFailureCount: 0,
      }),
    ).toBe("healthy");
    expect(
      resolveFirstPartyHealth({
        enabled: true,
        ingestWired: true,
        eventCount: 8,
        recentFailureCount: 2,
      }),
    ).toBe("degraded");
  });

  it("combines active channels without letting a disabled channel dominate", () => {
    expect(combineHealth(["healthy", "disabled"])).toBe("healthy");
    expect(combineHealth(["healthy", "unverified", "disabled"])).toBe("unverified");
    expect(combineHealth(["healthy", "degraded", "unverified"])).toBe("degraded");
    expect(combineHealth(["disabled", "disabled"])).toBe("disabled");
  });
});
