/**
 * Single source of truth for Christmas commerce metrics in Admin.
 * Do NOT mix: Stripe transactions ≠ entitlements ≠ funnel purchase events.
 */

import type { ChristmasEventRow, ChristmasOrderRow } from "./christmasAdminTypes";

export type CommerceKind = "base_call" | "extension" | "other";

export function commerceKind(productKey: string): CommerceKind {
  if (productKey === "christmas_santa_voice_call") return "base_call";
  if (productKey === "christmas_santa_voice_call_extension") return "extension";
  return "other";
}

export function isConfirmedPaidOrder(row: ChristmasOrderRow): boolean {
  return row.payment_status === "paid" && Number(row.amount_cents || 0) > 0;
}

export function isLikelyTestOrder(row: ChristmasOrderRow): boolean {
  const meta = row.metadata || {};
  if (meta.manual_qa === true || meta.is_test === true) return true;
  if (String(meta.stripe_mode || "").toLowerCase() === "test") return true;
  return Number(row.amount_cents || 0) === 0;
}

export type CommerceSnapshot = {
  /** Confirmed paid orders (DB), amount > 0 */
  paidOrders: number;
  paidBaseCalls: number;
  paidExtensions: number;
  paidOther: number;
  revenueByCurrency: Record<string, number>;
  /** Raw funnel `purchase` event rows (may duplicate) */
  funnelPurchaseEvents: number;
  /** Distinct order_id on funnel purchase events */
  funnelPurchaseUniqueOrders: number;
  /** Paid orders missing a matching funnel purchase event */
  paidWithoutFunnelPurchase: number;
  testPaidExcluded: number;
};

export function computeCommerceSnapshot(
  orders: ChristmasOrderRow[],
  events: ChristmasEventRow[],
  opts?: { includeTests?: boolean },
): CommerceSnapshot {
  const includeTests = opts?.includeTests === true;
  let testPaidExcluded = 0;
  const paid = orders.filter((row) => {
    if (!isConfirmedPaidOrder(row)) return false;
    if (!includeTests && isLikelyTestOrder(row)) {
      testPaidExcluded += 1;
      return false;
    }
    return true;
  });

  const revenueByCurrency: Record<string, number> = {};
  let paidBaseCalls = 0;
  let paidExtensions = 0;
  let paidOther = 0;
  for (const row of paid) {
    const kind = commerceKind(row.product_key);
    if (kind === "base_call") paidBaseCalls += 1;
    else if (kind === "extension") paidExtensions += 1;
    else paidOther += 1;
    const cur = String(row.currency || "usd").toUpperCase();
    revenueByCurrency[cur] = (revenueByCurrency[cur] || 0) + Number(row.amount_cents || 0);
  }

  const purchaseEvents = events.filter((row) => row.event_name === "purchase");
  const uniqueOrders = new Set(
    purchaseEvents.map((row) => row.order_id).filter((id): id is string => Boolean(id)),
  );

  const paidIds = new Set(paid.map((row) => row.id));
  let paidWithoutFunnelPurchase = 0;
  for (const id of paidIds) {
    if (!uniqueOrders.has(id)) paidWithoutFunnelPurchase += 1;
  }

  return {
    paidOrders: paid.length,
    paidBaseCalls,
    paidExtensions,
    paidOther,
    revenueByCurrency,
    funnelPurchaseEvents: purchaseEvents.length,
    funnelPurchaseUniqueOrders: uniqueOrders.size,
    paidWithoutFunnelPurchase,
    testPaidExcluded,
  };
}

export function formatRevenueMap(map: Record<string, number>): string {
  const parts = Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([cur, cents]) => `${(cents / 100).toFixed(2)} ${cur}`);
  return parts.length ? parts.join(" · ") : "—";
}
