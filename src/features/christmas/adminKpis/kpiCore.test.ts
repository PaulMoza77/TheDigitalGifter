import { describe, expect, it } from "vitest";
import {
  buildChristmasKpiSnapshot,
  formatPct,
  rangeForChristmasKpiPreset,
  type ChristmasFunnelEventRow,
  type ChristmasOrderKpiRow,
} from "./kpiCore";

function event(
  overrides: Partial<ChristmasFunnelEventRow> & { event_name: string },
): ChristmasFunnelEventRow {
  return {
    funnel_session_id: "11111111-1111-4111-8111-111111111111",
    order_id: null,
    product_key: "christmas_photo",
    package_key: "single",
    amount_cents: null,
    utm_source: null,
    utm_campaign: null,
    device_type: "mobile",
    is_test: false,
    created_at: "2026-09-05T12:00:00.000Z",
    ...overrides,
  };
}

function order(
  overrides: Partial<ChristmasOrderKpiRow> & { id: string },
): ChristmasOrderKpiRow {
  return {
    product_key: "christmas_photo",
    package_key: "single",
    amount_cents: 999,
    currency: "eur",
    payment_status: "pending",
    fulfillment_status: "not_started",
    stripe_checkout_session_id: "cs_test_1",
    utm_source: "meta",
    utm_campaign: "xmas",
    created_at: "2026-09-05T12:00:00.000Z",
    paid_at: null,
    ...overrides,
  };
}

describe("christmas admin kpi core", () => {
  it("supports today/7d/30d/all ranges", () => {
    const now = new Date("2026-09-05T15:00:00.000Z");
    expect(rangeForChristmasKpiPreset("all", now).from).toBeNull();
    expect(rangeForChristmasKpiPreset("today", now).from?.toISOString()).toBe(
      "2026-09-05T00:00:00.000Z",
    );
    expect(rangeForChristmasKpiPreset("7d", now).from).toBeTruthy();
    expect(rangeForChristmasKpiPreset("30d", now).from).toBeTruthy();
  });

  it("zero-data snapshot does not crash and labels aggregate mode", () => {
    const snap = buildChristmasKpiSnapshot({
      preset: "all",
      events: [],
      orders: [],
      lifecycle: [],
    });
    expect(snap.funnel.entriesSessions).toBe(0);
    expect(snap.commercial.paidOrders).toBe(0);
    expect(snap.progressionMode).toBe("aggregate_stage_ratio");
    expect(snap.telemetryQuality.length).toBeGreaterThan(0);
  });

  it("never counts checkout session creation as purchase", () => {
    const snap = buildChristmasKpiSnapshot({
      preset: "all",
      events: [
        event({ event_name: "christmas_page_view" }),
        event({ event_name: "checkout_started" }),
      ],
      orders: [
        order({ id: "o1", payment_status: "pending" }),
        order({
          id: "o2",
          payment_status: "paid",
          fulfillment_status: "completed",
          paid_at: "2026-09-05T13:00:00.000Z",
          amount_cents: 1499,
        }),
      ],
    });
    expect(snap.commercial.checkoutSessionsCreated).toBe(2);
    expect(snap.commercial.paidOrders).toBe(1);
    expect(snap.commercial.abandonedCheckouts).toBe(1);
    expect(snap.commercial.grossRevenueCents).toBe(1499);
    expect(snap.checkoutHealth.zeroPurchaseSessions).toBe(1);
  });

  it("dedupes funnel stages by unique session and excludes is_test", () => {
    const snap = buildChristmasKpiSnapshot({
      preset: "all",
      events: [
        event({ event_name: "upload_completed", funnel_session_id: "s1" }),
        event({ event_name: "upload_completed", funnel_session_id: "s1" }),
        event({ event_name: "upload_completed", funnel_session_id: "s2" }),
        event({
          event_name: "upload_completed",
          funnel_session_id: "stest",
          is_test: true,
        }),
      ],
      orders: [],
    });
    expect(snap.funnel.uploads).toBe(2);
  });

  it("reports package mix for multiple packages", () => {
    const snap = buildChristmasKpiSnapshot({
      preset: "all",
      events: [],
      orders: [
        order({
          id: "a",
          payment_status: "paid",
          paid_at: "2026-09-05T13:00:00.000Z",
          package_key: "single",
          amount_cents: 1000,
        }),
        order({
          id: "b",
          payment_status: "paid",
          paid_at: "2026-09-05T14:00:00.000Z",
          package_key: "bundle",
          amount_cents: 2000,
          product_key: "christmas_santa_video",
        }),
      ],
    });
    expect(snap.packageMix).toHaveLength(2);
    expect(snap.commercial.aovCents).toBe(1500);
    expect(formatPct(0.5)).toBe("50%");
  });

  it("handles refund status separately from paid gross", () => {
    const snap = buildChristmasKpiSnapshot({
      preset: "all",
      events: [],
      orders: [
        order({
          id: "p",
          payment_status: "paid",
          paid_at: "2026-09-05T13:00:00.000Z",
          amount_cents: 1000,
        }),
        order({
          id: "r",
          payment_status: "refunded",
          amount_cents: 1000,
          created_at: "2026-09-05T14:00:00.000Z",
        }),
      ],
    });
    expect(snap.commercial.paidOrders).toBe(1);
    expect(snap.commercial.refundOrders).toBe(1);
    expect(snap.commercial.refundAmountCents).toBe(1000);
  });
});
