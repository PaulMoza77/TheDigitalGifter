import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildChristmasKpiSnapshot,
  formatPct,
  isChristmasKpiEmpty,
  rangeForChristmasKpiPreset,
  type ChristmasFunnelEventRow,
  type ChristmasOrderKpiRow,
} from "./kpiCore";
import {
  CHRISTMAS_KPI_FORBIDDEN_SELECT_FIELDS,
  CHRISTMAS_KPI_FUNNEL_SELECT,
  CHRISTMAS_KPI_ORDER_SELECT,
  assertChristmasKpiSelectSafe,
} from "./kpiSelect";

function readSrc(relative: string): string {
  return readFileSync(resolve(process.cwd(), relative), "utf8");
}

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

  it("zero-data snapshot is empty and labels aggregate mode", () => {
    const snap = buildChristmasKpiSnapshot({
      preset: "all",
      events: [],
      orders: [],
    });
    expect(snap.funnel.entriesSessions).toBe(0);
    expect(snap.commercial.paidOrders).toBe(0);
    expect(snap.progressionMode).toBe("aggregate_stage_ratio");
    expect(isChristmasKpiEmpty(snap)).toBe(true);
    expect(snap.telemetryQuality.length).toBeGreaterThan(0);
  });

  it("never counts checkout session creation as purchase", () => {
    const snap = buildChristmasKpiSnapshot({
      preset: "all",
      events: [
        event({ event_name: "christmas_page_view" }),
        event({ event_name: "checkout_started" }),
        event({ event_name: "purchase", funnel_session_id: "s-client" }),
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
    expect(snap.funnel.clientPurchaseEvents).not.toBe(snap.commercial.paidOrders);
    expect(isChristmasKpiEmpty(snap)).toBe(false);
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

describe("christmas admin kpi service privacy", () => {
  it("allowlists selects without emails, tokens, or media", () => {
    expect(() => assertChristmasKpiSelectSafe(CHRISTMAS_KPI_FUNNEL_SELECT)).not.toThrow();
    expect(() => assertChristmasKpiSelectSafe(CHRISTMAS_KPI_ORDER_SELECT)).not.toThrow();
    for (const field of CHRISTMAS_KPI_FORBIDDEN_SELECT_FIELDS) {
      expect(CHRISTMAS_KPI_FUNNEL_SELECT.split(",")).not.toContain(field);
      expect(CHRISTMAS_KPI_ORDER_SELECT.split(",")).not.toContain(field);
    }
    expect(() => assertChristmasKpiSelectSafe("id,email,payment_status")).toThrow(
      /forbidden field: email/,
    );
  });

  it("keeps supabase access in the service layer, not the page", () => {
    const page = readSrc("src/pages/admin/ChristmasKpisPage.tsx");
    const service = readSrc("src/features/christmas/adminKpis/kpiService.ts");
    const app = readSrc("src/App.tsx");
    const layout = readSrc("src/layouts/AdminLayout.tsx");
    expect(page).toContain("loadChristmasKpiSources");
    expect(page).not.toMatch(/from\(["']christmas_/);
    expect(page).not.toContain('from "@/lib/supabase"');
    expect(service).toContain(".from(\"christmas_funnel_events\")");
    expect(service).toContain(".from(\"christmas_orders\")");
    expect(service).not.toContain("christmas_lifecycle_events");
    expect(service).not.toMatch(/\bmock\b/i);
    expect(app).toContain('path="christmas-kpis"');
    expect(app).toContain("ChristmasKpisPage");
    expect(layout).toContain("/admin/christmas-kpis");
  });
});
