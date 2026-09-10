/**
 * Christmas suite ops snapshot — not founder conversion KPIs.
 * Pure functions only. Counts and catalog flags; never emails, tokens, or media.
 */

import {
  CHRISTMAS_CATALOG_SEED,
  ctaStateForProduct,
  type ChristmasProductDef,
} from "@/features/christmas/catalog";

export const CHRISTMAS_CONTROL_PATH = "/admin/christmas-control";
export const CHRISTMAS_ORDERS_PATH = "/admin/christmas-orders";
export const CHRISTMAS_SEND_A_GIFT_PATH = "/admin/send-a-gift";
export const CHRISTMAS_FUNNELS_HASH = `${CHRISTMAS_CONTROL_PATH}#funnels`;
export const CHRISTMAS_SEND_A_GIFT_HASH = `${CHRISTMAS_CONTROL_PATH}#send-a-gift`;

export const SEND_A_GIFT_PRODUCT_KEYS = [
  "christmas_send_a_gift",
  "send_a_gift",
  "christmas_send-a-gift",
] as const;

export type ChristmasControlLinkId = "orders" | "send-a-gift" | "funnels";

export type ChristmasControlLink = {
  id: ChristmasControlLinkId;
  label: string;
  to: string;
  note: string;
};

export const CHRISTMAS_CONTROL_PRIMARY_LINKS: readonly ChristmasControlLink[] = [
  {
    id: "orders",
    label: "Orders",
    to: CHRISTMAS_ORDERS_PATH,
    note: "Commerce queue, fulfillment, and retries",
  },
  {
    id: "send-a-gift",
    label: "Send a Gift",
    to: CHRISTMAS_SEND_A_GIFT_PATH,
    note: "Prepaid gift ops — no recipient PII on this surface",
  },
  {
    id: "funnels",
    label: "Funnels",
    to: CHRISTMAS_FUNNELS_HASH,
    note: "Suite funnel map and first-party event volume",
  },
] as const;

export type ControlOrderRow = {
  id: string;
  product_key: string;
  package_key: string;
  payment_status: string;
  fulfillment_status: string;
  created_at: string;
};

export type ControlFunnelRow = {
  event_name: string;
  funnel_session_id: string;
  product_key: string | null;
  created_at: string;
};

export type ControlProductRow = {
  id: string;
  product_key: string;
  active: boolean;
  public_discoverable: boolean;
  route_path: string | null;
};

export type ControlPackageRow = {
  product_id: string;
  package_key: string;
  active: boolean;
  purchasable: boolean;
};

export type ControlAttention = {
  fulfillmentFailed: number;
  fulfillmentQueued: number;
  fulfillmentProcessing: number;
  paymentFailed: number;
};

export type ControlProductOps = {
  productKey: string;
  label: string;
  routePath: string;
  adminHref: string;
  catalogActive: boolean;
  liveActive: boolean | null;
  purchasablePackages: number;
  ctaState: "open" | "coming_soon" | "unavailable";
  orders: number;
  paid: number;
  fulfillmentFailed: number;
  funnelSessions: number;
};

export type SendAGiftOps = {
  inLiveCatalog: boolean;
  productKey: string | null;
  orders: number;
  paid: number;
  fulfillmentFailed: number;
  funnelSessions: number;
};

export type ChristmasControlSnapshot = {
  attention: ControlAttention;
  paymentCounts: Record<string, number>;
  fulfillmentCounts: Record<string, number>;
  products: ControlProductOps[];
  sendAGift: SendAGiftOps;
  orderRows: number;
  funnelRows: number;
};

export function isSendAGiftProductKey(productKey: string | null | undefined): boolean {
  const key = String(productKey || "").trim().toLowerCase();
  return SEND_A_GIFT_PRODUCT_KEYS.some((candidate) => candidate === key);
}

export function incrementCount(map: Record<string, number>, key: string): void {
  const normalized = String(key || "").trim() || "unknown";
  map[normalized] = (map[normalized] || 0) + 1;
}

function uniqueSessionCount(rows: ControlFunnelRow[], productKey: string): number {
  const sessions = new Set<string>();
  for (const row of rows) {
    if (String(row.product_key || "") !== productKey) continue;
    const id = String(row.funnel_session_id || "").trim();
    if (id) sessions.add(id);
  }
  return sessions.size;
}

function sendAGiftSessionCount(rows: ControlFunnelRow[]): number {
  const sessions = new Set<string>();
  for (const row of rows) {
    if (!isSendAGiftProductKey(row.product_key)) continue;
    const id = String(row.funnel_session_id || "").trim();
    if (id) sessions.add(id);
  }
  return sessions.size;
}

function productOrders(rows: ControlOrderRow[], productKey: string): ControlOrderRow[] {
  return rows.filter((row) => String(row.product_key || "") === productKey);
}

function sendAGiftOrders(rows: ControlOrderRow[]): ControlOrderRow[] {
  return rows.filter((row) => isSendAGiftProductKey(row.product_key));
}

export function buildChristmasControlSnapshot(input: {
  catalog?: ChristmasProductDef[];
  orders: ControlOrderRow[];
  events: ControlFunnelRow[];
  products: ControlProductRow[];
  packages: ControlPackageRow[];
}): ChristmasControlSnapshot {
  const catalog = input.catalog ?? CHRISTMAS_CATALOG_SEED;
  const paymentCounts: Record<string, number> = {};
  const fulfillmentCounts: Record<string, number> = {};

  for (const order of input.orders) {
    incrementCount(paymentCounts, order.payment_status);
    incrementCount(fulfillmentCounts, order.fulfillment_status);
  }

  const liveByKey = new Map(input.products.map((row) => [row.product_key, row]));
  const purchasableByProductId = new Map<string, number>();
  for (const pkg of input.packages) {
    if (!pkg.active || !pkg.purchasable) continue;
    purchasableByProductId.set(
      pkg.product_id,
      (purchasableByProductId.get(pkg.product_id) || 0) + 1,
    );
  }

  const suite = catalog.filter((product) => product.productKey !== "christmas_hub");

  const products: ControlProductOps[] = suite.map((product) => {
    const live = liveByKey.get(product.productKey) ?? null;
    const rows = productOrders(input.orders, product.productKey);
    return {
      productKey: product.productKey,
      label: product.name,
      routePath: product.routePath,
      adminHref: CHRISTMAS_ORDERS_PATH,
      catalogActive: product.active && product.publicDiscoverable,
      liveActive: live ? live.active && live.public_discoverable : null,
      purchasablePackages: live
        ? purchasableByProductId.get(live.id) || 0
        : product.packages.filter((pkg) => pkg.active && pkg.purchasable).length,
      ctaState: ctaStateForProduct(product),
      orders: rows.length,
      paid: rows.filter((row) => row.payment_status === "paid").length,
      fulfillmentFailed: rows.filter((row) => row.fulfillment_status === "failed").length,
      funnelSessions: uniqueSessionCount(input.events, product.productKey),
    };
  });

  const giftRows = sendAGiftOrders(input.orders);
  const liveGift = input.products.find((row) => isSendAGiftProductKey(row.product_key)) ?? null;

  return {
    attention: {
      fulfillmentFailed: fulfillmentCounts.failed || 0,
      fulfillmentQueued: fulfillmentCounts.queued || 0,
      fulfillmentProcessing: fulfillmentCounts.processing || 0,
      paymentFailed: paymentCounts.failed || 0,
    },
    paymentCounts,
    fulfillmentCounts,
    products,
    sendAGift: {
      inLiveCatalog: Boolean(liveGift),
      productKey: liveGift?.product_key ?? null,
      orders: giftRows.length,
      paid: giftRows.filter((row) => row.payment_status === "paid").length,
      fulfillmentFailed: giftRows.filter((row) => row.fulfillment_status === "failed").length,
      funnelSessions: sendAGiftSessionCount(input.events),
    },
    orderRows: input.orders.length,
    funnelRows: input.events.length,
  };
}

export function isChristmasControlEmpty(snap: ChristmasControlSnapshot): boolean {
  return snap.orderRows === 0 && snap.funnelRows === 0;
}
