/**
 * Future product-specific fulfillment dispatcher.
 * Handlers are intentionally unset until product tasks implement them.
 * Paid → fulfillment_status queued is handled by fulfill_christmas_order_payment.
 */

import type { ChristmasPaymentStatus, ChristmasFulfillmentStatus } from "./orderStatus";

export type ChristmasFulfillmentOrder = {
  id: string;
  productKey: string;
  packageKey: string;
  paymentStatus: ChristmasPaymentStatus;
  fulfillmentStatus: ChristmasFulfillmentStatus;
};

export type ChristmasFulfillmentHandler = (
  order: ChristmasFulfillmentOrder,
) => Promise<{ accepted: boolean; reason?: string }>;

/**
 * Client-side registry only — no fake result generators.
 * christmas_photo post-pay generation is enqueued by stripeFulfill → christmas-generate
 * (edge), not via this in-browser registry.
 */
export const CHRISTMAS_FULFILLMENT_HANDLERS: Partial<
  Record<string, ChristmasFulfillmentHandler>
> = {
  // christmas_santa_video: implemented in a later task
};

export function getChristmasFulfillmentHandler(
  productKey: string,
): ChristmasFulfillmentHandler | null {
  return CHRISTMAS_FULFILLMENT_HANDLERS[productKey] ?? null;
}

export function canEnqueueFulfillment(order: ChristmasFulfillmentOrder): {
  ok: boolean;
  reason?: string;
} {
  if (order.paymentStatus !== "paid") {
    return { ok: false, reason: "payment_required" };
  }
  if (order.fulfillmentStatus === "completed") {
    return { ok: false, reason: "already_completed" };
  }
  if (order.fulfillmentStatus === "processing") {
    return { ok: false, reason: "already_processing" };
  }
  return { ok: true };
}

/**
 * Enqueue seam: marks intent only when a handler exists.
 * Without a handler, order stays `queued` for ops visibility — no fake output.
 */
export async function enqueueChristmasFulfillment(
  order: ChristmasFulfillmentOrder,
): Promise<{ enqueued: boolean; reason: string }> {
  const gate = canEnqueueFulfillment(order);
  if (!gate.ok) return { enqueued: false, reason: gate.reason || "blocked" };

  const handler = getChristmasFulfillmentHandler(order.productKey);
  if (!handler) {
    return { enqueued: false, reason: "handler_not_implemented" };
  }

  const result = await handler(order);
  return {
    enqueued: result.accepted,
    reason: result.reason || (result.accepted ? "accepted" : "handler_rejected"),
  };
}

/**
 * Result / delivery design:
 * Attach outputs via `christmas_order_assets` (image | images | card | video)
 * optionally linking `generation_id` / `job_id` to existing tables.
 * Prefer relational assets over large JSON on `christmas_orders.metadata`.
 */
export const CHRISTMAS_ASSET_KINDS = ["image", "images", "card", "video", "other"] as const;
export type ChristmasAssetKind = (typeof CHRISTMAS_ASSET_KINDS)[number];
