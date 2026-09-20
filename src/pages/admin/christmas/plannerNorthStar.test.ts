import { describe, expect, it } from "vitest";
import { computePlannerNorthStar } from "./plannerNorthStar";
import type { ChristmasEventRow, ChristmasOrderRow } from "./christmasAdminTypes";

function event(partial: Partial<ChristmasEventRow>): ChristmasEventRow {
  return {
    id: "e",
    event_name: "planner_landing_view",
    funnel_session_id: "s1",
    product_key: "christmas_planner_2026",
    package_key: null,
    order_id: null,
    locale: "en",
    pathname: "/christmas/planner",
    device_type: "mobile",
    amount_cents: null,
    utm_source: "meta",
    utm_campaign: "founding",
    is_test: false,
    environment: "production",
    metadata: {},
    created_at: "2026-09-20T00:00:00Z",
    ...partial,
  };
}

describe("planner north star kpis", () => {
  it("computes funnel counts without using private text", () => {
    const events = [
      event({ id: "1", event_name: "planner_landing_view" }),
      event({ id: "2", event_name: "planner_cta_clicked" }),
      event({ id: "3", event_name: "planner_preview_viewed" }),
      event({ id: "4", event_name: "planner_checkout_started" }),
      event({ id: "5", event_name: "planner_purchase" }),
      event({ id: "6", event_name: "planner_module_opened", metadata: { module: "recipes" } }),
      event({ id: "7", event_name: "planner_landing_view", funnel_session_id: "drop", utm_source: "direct" }),
    ];
    const orders: ChristmasOrderRow[] = [
      {
        id: "o1",
        product_key: "christmas_planner_2026",
        package_key: "founding_pass",
        amount_cents: 1700,
        currency: "usd",
        payment_status: "paid",
        fulfillment_status: "fulfilled",
        last_error: null,
        source_route: "/christmas/planner",
        landing_path: "/christmas/planner",
        metadata: {},
        created_at: "2026-09-20T00:00:00Z",
        paid_at: "2026-09-20T00:00:00Z",
        delivery_email_sent_at: null,
      },
    ];
    const kpis = computePlannerNorthStar({ events, orders });
    expect(kpis.visitors).toBe(2);
    expect(kpis.purchases).toBeGreaterThanOrEqual(1);
    expect(kpis.revenueCents).toBe(1700);
    expect(kpis.aovCents).toBe(1700);
    expect(kpis.activations.some((a) => a.module === "recipes")).toBe(true);
    expect(JSON.stringify(kpis)).not.toMatch(/@|secret/);
  });
});
