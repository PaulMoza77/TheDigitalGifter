/**
 * Deno copy of the MVP product model. Keep in sync with src/config/productModel.ts.
 */

export const MVP_SKU = "still_image_single";

export const mvpProduct = {
  sku: MVP_SKU,
  name: "Personalized still image",
  amountCents: 499,
  currency: "eur",
  includedRegenerations: 1,
  maxGenerationAttempts: 3,
  license: "personal",
  uploadMaxBytes: 10 * 1024 * 1024,
  uploadRetentionHours: 24,
  resultRetentionDays: 30,
  signedUrlTtlSeconds: 60 * 60,
  checkoutEnabledDefault: false,
} as const;

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

export function isCheckoutEnabledOnServer(): boolean {
  return isStagingCheckoutEnabledOnServer({
    checkoutEnabled: Deno.env.get("CHECKOUT_ENABLED"),
    allowStagingCheckout: Deno.env.get("ALLOW_STAGING_CHECKOUT"),
    stripeSecretKey: Deno.env.get("STRIPE_SECRET_KEY"),
  });
}
