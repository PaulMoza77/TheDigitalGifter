/** Gift Tree paid-checkout UI rules (no React). */

export function shouldShowGiftTreePaymentSheet(input: {
  checkout: { clientSecret?: string | null } | null | undefined;
}): boolean {
  return Boolean(input.checkout?.clientSecret);
}

export function shouldShowGiftTreeCheckoutStarting(input: {
  purchasing: boolean;
  checkout: unknown;
}): boolean {
  return Boolean(input.purchasing) && !input.checkout;
}
