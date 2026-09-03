import type {
  StripeExpressCheckoutElementClickEvent,
  StripeExpressCheckoutElementConfirmEvent,
  StripeExpressCheckoutElementReadyEvent,
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

/** Safe readiness log — never prints secrets. Helps diagnose Link-only vs Apple Pay. */
export function logExpressCheckoutReady(event: StripeExpressCheckoutElementReadyEvent): void {
  const methods = event?.availablePaymentMethods;
  console.info("[express-checkout-ready]", {
    applePay: Boolean(methods?.applePay),
    googlePay: Boolean(methods?.googlePay),
    link: Boolean(methods?.link),
  });
}

export const CARD_PAY_INCOMPLETE_MESSAGE =
  "Enter your card details below, or pay with Apple Pay / Link above.";
