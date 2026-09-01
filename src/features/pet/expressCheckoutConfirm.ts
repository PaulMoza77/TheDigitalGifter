import type { StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";

/**
 * Stripe Checkout Sessions (ui_mode=elements) must call checkout.confirm() immediately
 * inside onConfirm for Express wallets. Awaiting a network round-trip first breaks Apple Pay.
 */
export function isExpressCheckoutConfirmEvent(
  event?: StripeExpressCheckoutElementConfirmEvent,
): event is StripeExpressCheckoutElementConfirmEvent {
  return Boolean(event);
}

export const CARD_PAY_INCOMPLETE_MESSAGE =
  "Enter your card details below, or pay with Apple Pay / Link above.";
