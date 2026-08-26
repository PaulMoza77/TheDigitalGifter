/**
 * Canonical V3 purchase reporting contract (mirrors SQL in admin_pet_v3_dashboard_context).
 * Paid pet_orders are the source of truth; v3_purchase events supply attribution only.
 */

export const V3_PURCHASE_IDEMPOTENCY_PREFIX = "v3_purchase:" as const;

export type V3PaidOrderRow = {
  id: string;
  funnel_variant: string | null;
  paid_at: string | null;
  status: string | null;
  charged_amount_cents: number | null;
  amount_cents: number | null;
  currency: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  discount_percent: number | null;
  stripe_payment_status: string | null;
};

export type V3PurchaseEventRow = {
  event_name: string;
  idempotency_key: string;
  funnel_session_id: string;
  amount_cents: number | null;
  campaign_id: string | null;
  adset_id: string | null;
  ad_id: string | null;
  creative_id: string | null;
  utm_content: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  funnel_version: string | null;
  is_test: boolean | null;
};

export type V3AttributionFilter = {
  campaignId?: string | null;
  adsetId?: string | null;
  adId?: string | null;
  creativeId?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  funnelVersion?: string | null;
};

export function v3PurchaseIdempotencyKey(orderId: string): string {
  return `${V3_PURCHASE_IDEMPOTENCY_PREFIX}${orderId}`;
}

export function orderIdFromV3PurchaseKey(idempotencyKey: string): string | null {
  const key = String(idempotencyKey || "").trim();
  if (!key.startsWith(V3_PURCHASE_IDEMPOTENCY_PREFIX)) return null;
  const orderId = key.slice(V3_PURCHASE_IDEMPOTENCY_PREFIX.length);
  return orderId.length > 0 ? orderId : null;
}

export function petOrderAnalyticsClass(order: V3PaidOrderRow): "paid" | "free" | "test" {
  const sessionId = String(order.stripe_checkout_session_id || "");
  const paymentIntent = String(order.stripe_payment_intent_id || "");
  if (sessionId.startsWith("cs_test") || paymentIntent.startsWith("pi_test")) return "test";
  const charged = Number(order.charged_amount_cents ?? order.amount_cents ?? 0);
  const discount = Number(order.discount_percent ?? 0);
  const paymentStatus = String(order.stripe_payment_status || "");
  if (
    discount >= 100 ||
    sessionId.startsWith("promo:") ||
    paymentStatus === "no_payment_required" ||
    paymentStatus === "not_required" ||
    charged <= 0
  ) {
    return "free";
  }
  return "paid";
}

export function isConfirmedV3PaidOrder(order: V3PaidOrderRow): boolean {
  if (String(order.funnel_variant || "v1") !== "v3") return false;
  if (!order.paid_at) return false;
  if (String(order.status || "") === "refunded") return false;
  return petOrderAnalyticsClass(order) === "paid";
}

export function paidAmountCents(order: V3PaidOrderRow): number {
  const charged = Number(order.charged_amount_cents ?? order.amount_cents ?? 0);
  return Number.isFinite(charged) ? Math.round(charged) : 0;
}

function trimFilter(value?: string | null): string | null {
  const next = String(value || "").trim();
  return next.length > 0 ? next : null;
}

export function v3PurchaseEventMatchesFilters(
  event: V3PurchaseEventRow,
  filters: V3AttributionFilter = {},
): boolean {
  if (event.event_name !== "v3_purchase") return false;
  if (event.is_test) return false;
  const version = trimFilter(filters.funnelVersion) || "v3";
  if (version !== "all") {
    const rowVersion = String(event.funnel_version || "v3").toLowerCase();
    if (rowVersion !== version) return false;
  }
  const campaignId = trimFilter(filters.campaignId);
  if (campaignId && event.campaign_id !== campaignId) return false;
  const adsetId = trimFilter(filters.adsetId);
  if (adsetId && event.adset_id !== adsetId) return false;
  const adId = trimFilter(filters.adId);
  if (adId && event.ad_id !== adId) return false;
  const creativeId = trimFilter(filters.creativeId);
  if (creativeId && event.creative_id !== creativeId && event.utm_content !== creativeId) return false;
  const utmSource = trimFilter(filters.utmSource);
  if (utmSource && event.utm_source !== utmSource) return false;
  const utmMedium = trimFilter(filters.utmMedium);
  if (utmMedium && event.utm_medium !== utmMedium) return false;
  return true;
}

export function buildV3ConfirmedPurchases(input: {
  orders: V3PaidOrderRow[];
  purchaseEvents: V3PurchaseEventRow[];
  filters?: V3AttributionFilter;
  fromMs?: number;
  toMs?: number;
}): Array<{ orderId: string; revenueCents: number; currency: string; funnelSessionId: string | null }> {
  const filters = input.filters || {};
  const eventsByOrder = new Map<string, V3PurchaseEventRow>();
  for (const event of input.purchaseEvents) {
    if (event.event_name !== "v3_purchase") continue;
    const orderId = orderIdFromV3PurchaseKey(event.idempotency_key);
    if (!orderId) continue;
    if (!eventsByOrder.has(orderId)) {
      eventsByOrder.set(orderId, event);
    }
  }

  const rows: Array<{ orderId: string; revenueCents: number; currency: string; funnelSessionId: string | null }> = [];
  for (const order of input.orders) {
    if (!isConfirmedV3PaidOrder(order)) continue;
    const paidAtMs = Date.parse(String(order.paid_at));
    if (input.fromMs != null && (Number.isNaN(paidAtMs) || paidAtMs < input.fromMs)) continue;
    if (input.toMs != null && (Number.isNaN(paidAtMs) || paidAtMs >= input.toMs)) continue;
    const event = eventsByOrder.get(order.id);
    if (!event) continue;
    if (!v3PurchaseEventMatchesFilters(event, filters)) continue;
    rows.push({
      orderId: order.id,
      revenueCents: paidAmountCents(order),
      currency: String(order.currency || "usd").toLowerCase(),
      funnelSessionId: event.funnel_session_id || null,
    });
  }
  return rows;
}

export function summarizeV3ConfirmedPurchases(
  rows: Array<{ orderId: string; revenueCents: number; currency: string }>,
): { purchases: number; revenueCents: number; currency: string } {
  const currency = rows[0]?.currency || "usd";
  const revenueCents = rows.reduce((sum, row) => sum + row.revenueCents, 0);
  return { purchases: rows.length, revenueCents, currency };
}
