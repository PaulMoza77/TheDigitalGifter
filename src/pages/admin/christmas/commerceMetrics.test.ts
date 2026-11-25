import { describe, expect, it } from "vitest";
import { computeCommerceSnapshot, commerceKind } from "./commerceMetrics";
import type { ChristmasEventRow, ChristmasOrderRow } from "./christmasAdminTypes";

function order(partial: Partial<ChristmasOrderRow>): ChristmasOrderRow {
  return {
    id: partial.id || "o1",
    product_key: partial.product_key || "christmas_santa_voice_call",
    package_key: "single",
    amount_cents: partial.amount_cents ?? 5900,
    currency: partial.currency || "ron",
    payment_status: partial.payment_status || "paid",
    fulfillment_status: "delivered",
    last_error: null,
    source_route: null,
    landing_path: null,
    metadata: partial.metadata || null,
    created_at: "2026-11-16T00:00:00.000Z",
    paid_at: "2026-11-16T00:01:00.000Z",
    delivery_email_sent_at: null,
  };
}

function event(partial: Partial<ChristmasEventRow>): ChristmasEventRow {
  return {
    id: partial.id || "e1",
    event_name: partial.event_name || "purchase",
    funnel_session_id: "s1",
    product_key: "christmas_santa_voice_call",
    package_key: null,
    order_id: partial.order_id ?? "o1",
    locale: null,
    pathname: null,
    device_type: null,
    amount_cents: 5900,
    utm_source: null,
    utm_campaign: null,
    is_test: false,
    environment: null,
    metadata: null,
    created_at: "2026-11-16T00:01:00.000Z",
  };
}

describe("commerceMetrics", () => {
  it("separates base calls from extensions and funnel purchase duplicates", () => {
    expect(commerceKind("christmas_santa_voice_call_extension")).toBe("extension");
    const snap = computeCommerceSnapshot(
      [
        order({ id: "base", product_key: "christmas_santa_voice_call" }),
        order({
          id: "ext",
          product_key: "christmas_santa_voice_call_extension",
          amount_cents: 4900,
        }),
        order({ id: "test", amount_cents: 0 }),
      ],
      [
        event({ id: "p1", order_id: "base" }),
        event({ id: "p2", order_id: "base" }),
      ],
    );
    expect(snap.paidOrders).toBe(2);
    expect(snap.paidBaseCalls).toBe(1);
    expect(snap.paidExtensions).toBe(1);
    expect(snap.funnelPurchaseEvents).toBe(2);
    expect(snap.funnelPurchaseUniqueOrders).toBe(1);
    expect(snap.paidWithoutFunnelPurchase).toBe(1);
  });
});
