/**
 * Runtime checkout gate. productTruth.flags.checkoutEnabled stays false.
 *
 * Preview may turn checkout on only when all of these are true:
 * - Vercel env is not production
 * - VITE_CHECKOUT_ENABLED=true
 * - VITE_STRIPE_TEST_MODE=true
 *
 * Production builds are hard-off even if someone sets the preview flags.
 */

export function isPreviewStripeTestCheckoutEnabled(env: {
  vercelEnv?: string;
  checkoutEnabled?: string;
  stripeTestMode?: string;
}): boolean {
  if (String(env.vercelEnv || "").toLowerCase() === "production") return false;
  return env.checkoutEnabled === "true" && env.stripeTestMode === "true";
}

export function isStripeTestSecret(key: string): boolean {
  return key.startsWith("sk_test_");
}

export function isStagingCheckoutEnabledOnServer(env: {
  checkoutEnabled?: string;
  allowStagingCheckout?: string;
  stripeSecretKey?: string;
}): boolean {
  if (env.checkoutEnabled !== "true") return false;
  if (env.allowStagingCheckout !== "true") return false;
  return isStripeTestSecret(String(env.stripeSecretKey || ""));
}

export function isCheckoutEnabled(): boolean {
  return isPreviewStripeTestCheckoutEnabled({
    vercelEnv: String(import.meta.env.VITE_VERCEL_ENV || ""),
    checkoutEnabled: String(import.meta.env.VITE_CHECKOUT_ENABLED || ""),
    stripeTestMode: String(import.meta.env.VITE_STRIPE_TEST_MODE || ""),
  });
}
