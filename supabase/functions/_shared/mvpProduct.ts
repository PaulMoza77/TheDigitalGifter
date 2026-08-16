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

export function isCheckoutEnabledOnServer(): boolean {
  return Deno.env.get("CHECKOUT_ENABLED") === "true";
}
