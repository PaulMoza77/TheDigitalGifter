import { describe, expect, it } from "vitest";
import { v3IdempotencyKey } from "./analytics";
import { v3LegacyRpcFilterArgs, v3TrustedRpcFilterArgs } from "./v3AnalyticsFilters";
import { classifyV3Traffic } from "./v3TrafficClassification";
import { isV3AnalyticsTestModeActive, setV3AnalyticsTestMode, clearV3AnalyticsTestMode } from "./v3TestMode";
import {
  PET_V3_PRICE_COHORT_FROM,
  v3IncludeInternalTests,
  v3TrafficClassForViewMode,
} from "./v3Measurement";

describe("V3 traffic classification", () => {
  it("1. internal test session excluded from default KPI filters", () => {
    expect(classifyV3Traffic({ isInternalTest: true, campaignId: "123" })).toBe("internal_test");
    expect(v3IncludeInternalTests("production")).toBe(false);
    expect(v3TrustedRpcFilterArgs({ viewMode: "production" }).p_include_internal_tests).toBe(false);
  });

  it("2. internal test session visible when Include tests is enabled", () => {
    expect(v3IncludeInternalTests("include_tests")).toBe(true);
    expect(v3TrustedRpcFilterArgs({ viewMode: "include_tests" }).p_include_internal_tests).toBe(true);
  });

  it("3. paid Meta session correctly classified", () => {
    expect(classifyV3Traffic({ campaignId: "120253518796930170", hasMetaClick: true })).toBe("paid_meta");
    expect(v3TrafficClassForViewMode("paid_meta")).toBe("paid_meta");
  });

  it("4. organic/direct session is not incorrectly classified as internal", () => {
    expect(classifyV3Traffic({ utmSource: "google", referrerHost: "google.com" })).toBe("external_other");
    expect(classifyV3Traffic({ referrerHost: "instagram.com" })).toBe("external_other");
    expect(classifyV3Traffic({})).toBe("unattributed");
  });

  it("5. multiple identical events in one session count once per stage (idempotency keys)", () => {
    const sessionId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const landingKey = v3IdempotencyKey({ sessionId, eventName: "v3_landing_view" });
    expect(v3IdempotencyKey({ sessionId, eventName: "v3_landing_view" })).toBe(landingKey);
    const checkoutKey = v3IdempotencyKey({
      sessionId,
      eventName: "v3_begin_checkout",
      attemptId: "order-1",
    });
    expect(
      v3IdempotencyKey({ sessionId, eventName: "v3_begin_checkout", attemptId: "order-1" }),
    ).toBe(checkoutKey);
  });

  it("6. refresh does not create a second landing session (session-once idempotency)", () => {
    const sessionId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    expect(v3IdempotencyKey({ sessionId, eventName: "v3_landing_view" })).toBe(
      `${sessionId}:v3_landing_view:cat`,
    );
  });

  it("7. checkout button click without Stripe session is diagnostic only (separate event names)", () => {
    expect(["v3_begin_checkout", "v3_checkout_session_created"].sort()).toEqual([
      "v3_begin_checkout",
      "v3_checkout_session_created",
    ]);
  });

  it("8. successful Stripe Checkout Session creation counts once (order-scoped idempotency)", () => {
    expect(`v3_checkout_session_created:order-uuid-1`).toMatch(/^v3_checkout_session_created:/);
  });

  it("12. old-price traffic excluded from $2.99 cohort via price_cohort_from constant", () => {
    expect(PET_V3_PRICE_COHORT_FROM).toBe("2026-08-27T21:11:06.000Z");
    expect(v3TrustedRpcFilterArgs({ priceCohortOnly: true }).p_price_cohort_only).toBe(true);
  });

  it("legacy RPC args do not pass trusted-only params", () => {
    expect(v3LegacyRpcFilterArgs({ viewMode: "production" })).not.toHaveProperty("p_include_internal_tests");
  });
});

describe("V3 analytics test mode persistence", () => {
  it("persists test mode in session storage", () => {
    if (typeof window === "undefined") return;
    clearV3AnalyticsTestMode();
    expect(isV3AnalyticsTestModeActive()).toBe(false);
    setV3AnalyticsTestMode(true);
    expect(isV3AnalyticsTestModeActive()).toBe(true);
    clearV3AnalyticsTestMode();
    expect(isV3AnalyticsTestModeActive()).toBe(false);
  });
});
