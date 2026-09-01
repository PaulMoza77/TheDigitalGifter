import type {
  StripeExpressCheckoutElementClickEvent,
  StripeExpressCheckoutElementConfirmEvent,
} from "@stripe/stripe-js";

/**
 * Stripe Checkout Sessions (ui_mode=elements) must call checkout.confirm() immediately
 * inside onConfirm for Express wallets. Awaiting a network round-trip first breaks Apple Pay.
 */
export function isExpressCheckoutConfirmEvent(
  event?: StripeExpressCheckoutElementConfirmEvent,
): event is StripeExpressCheckoutElementConfirmEvent {
  return Boolean(event);
}

/**
 * Express Checkout `onClick` is the official click event.
 * If we handle it, Stripe requires resolve() within 1s or the wallet sheet never opens.
 */
export function resolveExpressCheckoutClick(
  event: StripeExpressCheckoutElementClickEvent,
  onInteraction?: () => void,
): void {
  onInteraction?.();
  event.resolve();
}

export const CARD_PAY_INCOMPLETE_MESSAGE =
  "Enter your card details below, or pay with Apple Pay / Link above.";
