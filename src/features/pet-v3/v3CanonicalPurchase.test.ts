import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildV3ConfirmedPurchases,
  orderIdFromV3PurchaseKey,
  summarizeV3ConfirmedPurchases,
  v3PurchaseIdempotencyKey,
  type V3PaidOrderRow,
  type V3PurchaseEventRow,
} from "./v3CanonicalPurchase";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

function paidV3Order(overrides: Partial<V3PaidOrderRow> = {}): V3PaidOrderRow {
  return {
    id: "order-v3-1",
    funnel_variant: "v3",
    paid_at: "2026-08-26T12:00:00.000Z",
    status: "paid",
    charged_amount_cents: 1999,
    amount_cents: 2499,
    currency: "usd",
    stripe_checkout_session_id: "cs_live_abc",
    stripe_payment_intent_id: "pi_live_abc",
    discount_percent: 0,
    stripe_payment_status: "paid",
    ...overrides,
  };
}

function purchaseEvent(overrides: Partial<V3PurchaseEventRow> = {}): V3PurchaseEventRow {
  return {
    event_name: "v3_purchase",
    idempotency_key: v3PurchaseIdempotencyKey("order-v3-1"),
    funnel_session_id: "session-v3-1",
    amount_cents: 2499,
    campaign_id: "120000000001",
    adset_id: "220000000001",
    ad_id: "330000000001",
    creative_id: "cat-v3-creative-01",
    utm_content: "cat-v3-creative-01",
    utm_source: "meta",
    utm_medium: "paid_social",
    funnel_version: "v3",
    is_test: false,
    ...overrides,
  };
}

describe("V3 canonical purchase contract", () => {
  const fromMs = Date.parse("2026-08-26T00:00:00.000Z");
  const toMs = Date.parse("2026-08-27T00:00:00.000Z");

  it("no filters versus all-null filters produce identical totals", () => {
    const orders = [paidV3Order()];
    const events = [purchaseEvent()];
    const noFilters = summarizeV3ConfirmedPurchases(
      buildV3ConfirmedPurchases({ orders, purchaseEvents: events, fromMs, toMs }),
    );
    const nullFilters = summarizeV3ConfirmedPurchases(
      buildV3ConfirmedPurchases({
        orders,
        purchaseEvents: events,
        filters: {
          campaignId: null,
          adsetId: null,
          adId: null,
          creativeId: null,
          utmSource: null,
          utmMedium: null,
        },
        fromMs,
        toMs,
      }),
    );
    expect(nullFilters).toEqual(noFilters);
    expect(noFilters).toEqual({ purchases: 1, revenueCents: 1999, currency: "usd" });
  });

  it("matching creative filter counts the same purchase once", () => {
    const summary = summarizeV3ConfirmedPurchases(
      buildV3ConfirmedPurchases({
        orders: [paidV3Order()],
        purchaseEvents: [purchaseEvent()],
        filters: { creativeId: "cat-v3-creative-01" },
        fromMs,
        toMs,
      }),
    );
    expect(summary.purchases).toBe(1);
    expect(summary.revenueCents).toBe(1999);
  });

  it("non-matching filter yields zero purchases and revenue", () => {
    const summary = summarizeV3ConfirmedPurchases(
      buildV3ConfirmedPurchases({
        orders: [paidV3Order()],
        purchaseEvents: [purchaseEvent({ creative_id: "other-creative", utm_content: "other-creative" })],
        filters: { creativeId: "cat-v3-creative-01" },
        fromMs,
        toMs,
      }),
    );
    expect(summary).toEqual({ purchases: 0, revenueCents: 0, currency: "usd" });
  });

  it("duplicate v3_purchase events still count the purchase once", () => {
    const duplicate = purchaseEvent({ idempotency_key: v3PurchaseIdempotencyKey("order-v3-1") });
    const rows = buildV3ConfirmedPurchases({
      orders: [paidV3Order()],
      purchaseEvents: [duplicate, { ...duplicate, funnel_session_id: "session-v3-dup" }],
      fromMs,
      toMs,
    });
    expect(rows).toHaveLength(1);
    expect(summarizeV3ConfirmedPurchases(rows).purchases).toBe(1);
  });

  it("unpaid order with purchase-like client event does not count", () => {
    const summary = summarizeV3ConfirmedPurchases(
      buildV3ConfirmedPurchases({
        orders: [paidV3Order({ paid_at: null, stripe_payment_status: "requires_payment_method" })],
        purchaseEvents: [purchaseEvent()],
        fromMs,
        toMs,
      }),
    );
    expect(summary).toEqual({ purchases: 0, revenueCents: 0, currency: "usd" });
  });

  it("V2 paid order is absent from V3 totals", () => {
    const summary = summarizeV3ConfirmedPurchases(
      buildV3ConfirmedPurchases({
        orders: [paidV3Order({ id: "order-v2-1", funnel_variant: "v2" })],
        purchaseEvents: [purchaseEvent({ idempotency_key: v3PurchaseIdempotencyKey("order-v2-1") })],
        fromMs,
        toMs,
      }),
    );
    expect(summary.purchases).toBe(0);
  });

  it("revenue uses charged_amount_cents from Stripe, not advertised amount_cents", () => {
    const rows = buildV3ConfirmedPurchases({
      orders: [paidV3Order({ charged_amount_cents: 1799, amount_cents: 2499 })],
      purchaseEvents: [purchaseEvent({ amount_cents: 2499 })],
      fromMs,
      toMs,
    });
    expect(rows[0]?.revenueCents).toBe(1799);
    expect(summarizeV3ConfirmedPurchases(rows).revenueCents).toBe(1799);
  });

  it("respects half-open paid_at date boundaries and preserves currency", () => {
    expect(
      buildV3ConfirmedPurchases({
        orders: [paidV3Order({ paid_at: "2026-08-25T23:59:59.999Z" })],
        purchaseEvents: [purchaseEvent()],
        fromMs,
        toMs,
      }),
    ).toHaveLength(0);

    const inRange = buildV3ConfirmedPurchases({
      orders: [paidV3Order({ paid_at: "2026-08-26T23:59:59.999Z", currency: "EUR" })],
      purchaseEvents: [purchaseEvent()],
      fromMs,
      toMs,
    });
    expect(inRange).toHaveLength(1);
    expect(inRange[0]?.currency).toBe("eur");

    expect(
      buildV3ConfirmedPurchases({
        orders: [paidV3Order({ paid_at: "2026-08-27T00:00:00.000Z" })],
        purchaseEvents: [purchaseEvent()],
        fromMs,
        toMs,
      }),
    ).toHaveLength(0);
  });

  it("orphan v3_purchase without confirmed paid order is excluded", () => {
    const summary = summarizeV3ConfirmedPurchases(
      buildV3ConfirmedPurchases({
        orders: [],
        purchaseEvents: [purchaseEvent()],
        fromMs,
        toMs,
      }),
    );
    expect(summary.purchases).toBe(0);
  });

  it("SQL migration always joins pet_orders to v3_purchase by order_id", () => {
    const sql = readSrc("supabase/migrations/20260826210000_pet_v3_canonical_purchase.sql");
    expect(sql).toContain("inner join public.pet_v3_funnel_events e");
    expect(sql).toContain("e.idempotency_key = ('v3_purchase:' || o.id::text)");
    expect(sql).toContain("coalesce(o.charged_amount_cents, o.amount_cents");
    expect(sql).not.toMatch(/when\s+campaign_filter\s+is\s+not\s+null/i);
    expect(orderIdFromV3PurchaseKey(v3PurchaseIdempotencyKey("abc"))).toBe("abc");
  });
});
