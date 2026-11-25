import { describe, expect, it } from "vitest";
import {
  buildAttributionBuckets,
  buildDailyTraffic,
  checkoutAbandonStats,
  organicProxyLabel,
  productPerformance,
} from "./growthMetrics";
import type { ChristmasEventRow, ChristmasOrderRow } from "./christmasAdminTypes";

function event(partial: Partial<ChristmasEventRow>): ChristmasEventRow {
  return {
    id: partial.id || "1",
    event_name: partial.event_name || "christmas_page_view",
    funnel_session_id: partial.funnel_session_id || "s1",
    product_key: partial.product_key || null,
    package_key: null,
    order_id: null,
    locale: null,
    pathname: partial.pathname || "/christmas/santa-call",
    device_type: null,
    amount_cents: null,
    utm_source: partial.utm_source ?? null,
    utm_campaign: null,
    is_test: false,
    environment: null,
    metadata: null,
    created_at: partial.created_at || "2026-11-24T12:00:00.000Z",
  };
}

describe("growthMetrics", () => {
  it("builds daily traffic and keeps unknown attribution unlabeled as organic", () => {
    const events = [
      event({ funnel_session_id: "a", created_at: "2026-11-24T10:00:00.000Z" }),
      event({
        funnel_session_id: "b",
        utm_source: "facebook",
        event_name: "checkout_started",
        created_at: "2026-11-24T11:00:00.000Z",
      }),
    ];
    expect(buildDailyTraffic(events)[0]?.sessions).toBe(2);
    const buckets = buildAttributionBuckets(events);
    expect(buckets.find((row) => row.key === "unknown")?.kind).toBe("unknown");
    expect(organicProxyLabel(events).label).toBe("Unattributed sessions");
  });

  it("summarizes product performance and abandon rate from confirmed rows", () => {
    const orders: ChristmasOrderRow[] = [
      {
        id: "1",
        product_key: "christmas_santa_voice_call",
        package_key: "single",
        amount_cents: 5900,
        currency: "ron",
        payment_status: "paid",
        fulfillment_status: "delivered",
        last_error: null,
        source_route: null,
        landing_path: "/christmas/santa-call",
        metadata: null,
        created_at: "2026-11-16T00:00:00.000Z",
        paid_at: "2026-11-16T00:01:00.000Z",
        delivery_email_sent_at: null,
      },
      {
        id: "2",
        product_key: "christmas_santa_voice_call",
        package_key: "single",
        amount_cents: 5900,
        currency: "ron",
        payment_status: "pending",
        fulfillment_status: "pending",
        last_error: null,
        source_route: null,
        landing_path: "/christmas/santa-call",
        metadata: null,
        created_at: "2026-11-16T00:00:00.000Z",
        paid_at: null,
        delivery_email_sent_at: null,
      },
    ];
    const events = [
      event({ event_name: "checkout_started", funnel_session_id: "c1" }),
      event({ event_name: "checkout_started", funnel_session_id: "c2" }),
      event({ event_name: "purchase", funnel_session_id: "c1" }),
    ];
    expect(productPerformance(orders)[0]?.paid).toBe(1);
    expect(checkoutAbandonStats(orders, events).abandonRate).toBe("50%");
  });
});
