import { describe, expect, it } from "vitest";
import {
  FunnelIngestError,
  PET_FUNNEL_MAX_BODY_BYTES,
  classifyFunnelTraffic,
  firstPartyConversionPct,
  logicalIdempotencyKey,
  sequentialConversionPct,
  trackingCoverageSignal,
  validateFunnelIngestPayload,
} from "./funnelEventContract";

const session = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";

function payload(overrides: Record<string, unknown> = {}) {
  return {
    event_name: "landing_view",
    funnel_session_id: session,
    event_id: eventId,
    species: "dog",
    ...overrides,
  };
}

describe("pet funnel ingest contract", () => {
  it("accepts a valid event", () => {
    const row = validateFunnelIngestPayload(payload(), 200);
    expect(row.eventName).toBe("landing_view");
    expect(row.funnelSessionId).toBe(session);
  });

  it("rejects an unknown event name", () => {
    expect(() => validateFunnelIngestPayload(payload({ event_name: "drop_table" }), 40)).toThrow(FunnelIngestError);
  });

  it("rejects a malformed session id", () => {
    try {
      validateFunnelIngestPayload(payload({ funnel_session_id: "not-a-uuid" }), 40);
      throw new Error("expected reject");
    } catch (error) {
      expect(error).toBeInstanceOf(FunnelIngestError);
      expect((error as FunnelIngestError).reason).toBe("invalid_session");
    }
  });

  it("rejects an oversized payload", () => {
    try {
      validateFunnelIngestPayload(payload(), PET_FUNNEL_MAX_BODY_BYTES + 1);
      throw new Error("expected reject");
    } catch (error) {
      expect(error).toBeInstanceOf(FunnelIngestError);
      expect((error as FunnelIngestError).reason).toBe("payload_too_large");
    }
  });

  it("builds stable logical idempotency keys", () => {
    expect(logicalIdempotencyKey({ sessionId: session, eventName: "pet_name_submitted" })).toBe(
      `${session}:pet_name_submitted`,
    );
    expect(logicalIdempotencyKey({ sessionId: session, eventName: "landing_view", species: "dog" })).toBe(
      `${session}:landing_view:dog`,
    );
  });

  it("never uses Meta LPV as the first-party conversion denominator", () => {
    expect(firstPartyConversionPct(6, 20, 25)).toBe(30);
    expect(firstPartyConversionPct(2, 20, 25)).toBe(10);
    expect(firstPartyConversionPct(6, 0, 25)).toBeNull();
  });

  it("accepts photo_step_viewed and caps sequential conversion at 100%", () => {
    const row = validateFunnelIngestPayload(payload({ event_name: "photo_step_viewed" }), 80);
    expect(row.eventName).toBe("photo_step_viewed");
    expect(sequentialConversionPct(4, 3)).toBe(100);
  });

  it("flags tracking coverage as unhealthy when Meta LPV exists without first-party landings", () => {
    expect(trackingCoverageSignal(0, 25).unhealthy).toBe(true);
    expect(trackingCoverageSignal(20, 25).unhealthy).toBe(false);
    expect(classifyFunnelTraffic({ hasFbclid: true })).toBe("meta_paid");
    expect(classifyFunnelTraffic({})).toBe("direct");
  });
});
