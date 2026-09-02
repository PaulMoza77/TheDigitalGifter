export const CHRISTMAS_PAYMENT_STATUSES = [
  "draft",
  "pending",
  "paid",
  "failed",
  "refunded",
] as const;
export type ChristmasPaymentStatus = (typeof CHRISTMAS_PAYMENT_STATUSES)[number];

export const CHRISTMAS_FULFILLMENT_STATUSES = [
  "not_started",
  "queued",
  "processing",
  "completed",
  "failed",
] as const;
export type ChristmasFulfillmentStatus = (typeof CHRISTMAS_FULFILLMENT_STATUSES)[number];

export type ChristmasOrderSnapshot = {
  id: string;
  paymentStatus: ChristmasPaymentStatus;
  fulfillmentStatus: ChristmasFulfillmentStatus;
  amountCents: number;
  currency: string;
  stripeCheckoutSessionId: string | null;
  productKey: string;
  packageKey: string;
};

export type PaymentTransitionResult =
  | { ok: true; order: ChristmasOrderSnapshot; alreadyPaid: boolean }
  | { ok: false; code: string; message: string };

export function applyPaymentPaid(input: {
  order: ChristmasOrderSnapshot;
  stripeSessionId: string;
  stripeAmountCents: number;
  stripeCurrency: string;
}): PaymentTransitionResult {
  const order = input.order;
  if (order.paymentStatus === "paid") {
    return { ok: true, order, alreadyPaid: true };
  }
  if (order.paymentStatus === "refunded") {
    return { ok: false, code: "already_refunded", message: "Order already refunded" };
  }
  if (order.amountCents !== input.stripeAmountCents) {
    return { ok: false, code: "amount_mismatch", message: "Stripe amount does not match order" };
  }
  if (order.currency.toLowerCase() !== input.stripeCurrency.toLowerCase()) {
    return { ok: false, code: "currency_mismatch", message: "Stripe currency does not match order" };
  }
  if (
    order.stripeCheckoutSessionId &&
    order.stripeCheckoutSessionId !== input.stripeSessionId
  ) {
    return { ok: false, code: "stripe_session_mismatch", message: "Stripe session mismatch" };
  }

  const next: ChristmasOrderSnapshot = {
    ...order,
    paymentStatus: "paid",
    stripeCheckoutSessionId: input.stripeSessionId,
    fulfillmentStatus:
      order.fulfillmentStatus === "not_started" ? "queued" : order.fulfillmentStatus,
  };
  return { ok: true, order: next, alreadyPaid: false };
}

/** Duplicate webhook delivery must be a no-op success when already paid. */
export function isIdempotentPaidReplay(result: PaymentTransitionResult): boolean {
  return result.ok && result.alreadyPaid;
}
