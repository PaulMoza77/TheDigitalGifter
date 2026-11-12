import { describe, expect, it } from "vitest";
import { buildAnalyticsReport, reportDay } from "./analyticsReport";
import type {
  ChristmasEventRow,
  ChristmasOrderRow,
} from "../christmasAdminTypes";
const now = new Date("2026-11-12T12:00:00Z");
const event = (
  event_name: string,
  extra: Partial<ChristmasEventRow> = {},
): ChristmasEventRow => ({
  id: event_name,
  event_name,
  funnel_session_id: "one",
  product_key: "christmas_santa_voice_call",
  package_key: null,
  order_id: null,
  locale: "ro",
  pathname: "/christmas/santa-call?lang=ro",
  device_type: null,
  amount_cents: null,
  utm_source: "facebook",
  utm_campaign: "santa",
  is_test: false,
  environment: "production",
  metadata: null,
  created_at: "2026-11-11T12:00:00Z",
  ...extra,
});
const order = (extra: Partial<ChristmasOrderRow> = {}): ChristmasOrderRow => ({
  id: "paid",
  product_key: "christmas_santa_voice_call",
  package_key: "base",
  amount_cents: 5900,
  currency: "RON",
  payment_status: "paid",
  fulfillment_status: "delivered",
  last_error: null,
  source_route: null,
  landing_path: "/christmas/santa-call",
  metadata: { funnel_session_id: "one" },
  created_at: "2026-11-11T12:00:00Z",
  paid_at: "2026-11-11T12:10:00Z",
  delivery_email_sent_at: null,
  ...extra,
});
describe("Flavours presentation TDG report adapter", () => {
  it("counts real views and distinct sessions while leaving missing measurements unavailable", () => {
    const r = buildAnalyticsReport(
      [
        event("christmas_page_view"),
        event("christmas_page_view", { id: "repeat" }),
        event("product_selected"),
        event("christmas_page_view", {
          funnel_session_id: "two",
          utm_source: null,
        }),
      ],
      [],
      7,
      "",
      now,
    );
    expect(r.totals).toMatchObject({
      sessions: 2,
      pageViews: 3,
      ctaClicks: 1,
      visitors: null,
      engagementSeconds: null,
    });
    expect(r.trend.find((d) => d.day === "2026-11-11")).toEqual({
      day: "2026-11-11",
      sessions: 2,
      views: 3,
      visitors: null,
    });
    expect(r.pages[0].path).toBe("/christmas/santa-call");
    expect(
      r.sources.find((s) => s.source === "facebook / santa")?.sessions,
    ).toBe(1);
  });
  it("uses paid ledger and one linked funnel; pending and unrelated checkout do not count as purchases", () => {
    const rows = [
      "christmas_page_view",
      "product_selected",
      "santa_form_started",
      "checkout_started",
      "purchase",
    ].map((n) => event(n, { order_id: "paid" }));
    rows.push(
      event("checkout_started", {
        funnel_session_id: "unrelated",
        order_id: null,
      }),
    );
    const r = buildAnalyticsReport(
      rows,
      [
        order(),
        order({ id: "pending", payment_status: "pending" }),
        order({ id: "test", metadata: { is_test: true } }),
      ],
      7,
      "",
      now,
    );
    expect(r.funnel.map((s) => s.sessions)).toEqual([1, 1, 1, 1, 1]);
    expect(r.totals.purchases).toBe(1);
    expect(r.totals.revenueLabel).toBe("59 RON");
    expect(r.totals.conversionRate).toBe(100);
    expect(r.sources[0].purchases).toBe(1);
  });
  it("excludes test/admin traffic and attributes page orders without leaking other pages", () => {
    const r = buildAnalyticsReport(
      [
        event("christmas_page_view"),
        event("christmas_page_view", { is_test: true }),
        event("christmas_page_view", { environment: "test" }),
        event("christmas_page_view", { pathname: "/admin" }),
        event("christmas_page_view", {
          pathname: "/other",
          funnel_session_id: "other",
        }),
      ],
      [order(), order({ id: "other", landing_path: "/other" })],
      7,
      "/christmas/santa-call",
      now,
    );
    expect(r.totals.sessions).toBe(1);
    expect(r.totals.pageViews).toBe(1);
    expect(r.totals.purchases).toBe(1);
    expect(r.pages).toHaveLength(1);
  });
  it("keeps money currencies separate and never treats an order link as proof of payment", () => {
    const r = buildAnalyticsReport(
      [event("checkout_started", { order_id: "pending" })],
      [order(), order({ id: "usd", currency: "USD", amount_cents: 1200 })],
      7,
      "",
      now,
    );
    expect(r.totals.revenueLabel).toBe("59 RON + 12 USD");
    expect(r.funnel.at(-1)?.sessions).toBe(0);
    expect(r.totals.conversionRate).toBeNull();
  });
  it("uses Bucharest calendar days, includes zero days, supports 90 days", () => {
    expect(reportDay("2026-11-11T23:30:00Z")).toBe("2026-11-12");
    const r = buildAnalyticsReport(
      [event("christmas_page_view", { created_at: "2026-11-11T23:30:00Z" })],
      [],
      90,
      "",
      now,
    );
    expect(r.trend).toHaveLength(90);
    expect(r.trend.at(-1)?.sessions).toBe(1);
    expect(r.trend[0].views).toBe(0);
  });
  it("handles empty data without inventing visitor counts or conversion", () => {
    const r = buildAnalyticsReport([], [], 7, "", now);
    expect(r.totals.conversionRate).toBeNull();
    expect(r.pages).toEqual([]);
    expect(r.trend.every((d) => d.sessions === 0)).toBe(true);
  });
});
