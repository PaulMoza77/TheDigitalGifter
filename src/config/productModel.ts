/**
 * Canonical MVP commercial model for TheDigitalGifter.
 *
 * Keep this in sync with supabase/functions/_shared/mvpProduct.ts.
 * Do not add subscriptions, credits, enterprise, or extra SKUs here.
 */

export const MVP_SKU = "still_image_single" as const;

export const productModel = {
  sku: MVP_SKU,
  name: "Personalized still image",
  description:
    "One AI-generated still image from your uploaded photo, plus one included regeneration if the first result is not usable.",
  amountCents: 499,
  currency: "eur" as const,
  displayPrice: "€4.99",
  includedRegenerations: 1,
  maxGenerationAttempts: 3,
  outputType: "still_image" as const,
  license: "personal" as const,
  subscriptions: false,
  credits: false,
  enterprise: false,
  addOns: false,
  supportSla: "1–2 business days",
  estimatedAiCostUsdPerImage: 0.039,
  upload: {
    maxBytes: 10 * 1024 * 1024,
    allowedMime: ["image/jpeg", "image/png", "image/webp"] as const,
    allowedExt: ["jpg", "jpeg", "png", "webp"] as const,
    retentionHours: 24,
  },
  result: {
    retentionDays: 30,
    signedUrlTtlSeconds: 60 * 60,
  },
  refund: {
    ifNeverGenerated: true,
    ifTechnicalFailureAfterRetries: true,
    ifCustomerDislikesSuccessfulResult: false,
    contactEmail: "support@thedigitalgifter.com",
  },
} as const;

export type ProductModel = typeof productModel;

export function formatMvpPrice(): string {
  return productModel.displayPrice;
}
