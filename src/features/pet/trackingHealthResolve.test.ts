import { describe, expect, it } from "vitest";
import { resolveDatasetTrackingHealth } from "./trackingHealthResolve";

const mixedHealth = {
  v1_failed_write_count: 11,
  v2_failed_write_count: 22,
  failed_write_count: 33,
  v1_rejected_request_count: 4,
  v2_rejected_request_count: 5,
  rejected_request_count: 9,
  latest_v1_event_at: "2026-08-20T00:00:00.000Z",
  latest_v2_event_at: "2026-08-25T00:00:00.000Z",
  latest_first_party_event_at: "2026-08-25T00:00:00.000Z",
};

describe("resolveDatasetTrackingHealth", () => {
  it("does not display V1 or V2 health values on the V3 tab", () => {
    const resolved = resolveDatasetTrackingHealth({
      datasetId: "v3",
      health: mixedHealth,
      firstEventAtFallback: "2026-08-01T00:00:00.000Z",
    });
    expect(resolved.failedWrites).toBeNull();
    expect(resolved.rejectedRequests).toBeNull();
    expect(resolved.latestFirstPartyAt).toBeNull();
    expect(resolved.unavailableReason).toMatch(/V3 tracking health/i);
    expect(resolved.failedWrites).not.toBe(mixedHealth.v1_failed_write_count);
    expect(resolved.failedWrites).not.toBe(mixedHealth.v2_failed_write_count);
    expect(resolved.latestFirstPartyAt).not.toBe(mixedHealth.latest_v1_event_at);
    expect(resolved.latestFirstPartyAt).not.toBe(mixedHealth.latest_v2_event_at);
  });

  it("keeps V2 failed-write mapping on the V2 key", () => {
    const resolved = resolveDatasetTrackingHealth({
      datasetId: "v2",
      health: mixedHealth,
      firstEventAtFallback: null,
    });
    expect(resolved.failedWrites).toBe(22);
    expect(resolved.rejectedRequests).toBe(5);
    expect(resolved.latestFirstPartyAt).toBe("2026-08-25T00:00:00.000Z");
    expect(resolved.unavailableReason).toBeNull();
  });

  it("keeps V1 failed-write mapping on the V1 key", () => {
    const resolved = resolveDatasetTrackingHealth({
      datasetId: "v1",
      health: mixedHealth,
      firstEventAtFallback: null,
    });
    expect(resolved.failedWrites).toBe(11);
    expect(resolved.rejectedRequests).toBe(4);
    expect(resolved.latestFirstPartyAt).toBe("2026-08-20T00:00:00.000Z");
    expect(resolved.unavailableReason).toBeNull();
  });
});
