import {
  CHRISTMAS_CATALOG_SEED,
  resolvePurchasableOffer,
  type ChristmasProductDef,
} from "./catalog";

export const CHRISTMAS_PRODUCT_FAMILY = "christmas" as const;
export const CHRISTMAS_CHECKOUT_UI_MODE = "custom" as const;

/** Kill switch — checkout sessions are never created while false. */
export function christmasCheckoutEnabled(): boolean {
  const raw = String(
    (typeof process !== "undefined" && process.env?.CHRISTMAS_CHECKOUT_ENABLED) || "",
  )
    .trim()
    .toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
}

export type CreateChristmasCheckoutInput = {
  productKey: string;
  packageKey: string;
  email?: string | null;
  /** Ignored for amount — security gate. */
  clientAmountCents?: number | null;
  clientCurrency?: string | null;
  locale?: string | null;
  successUrl: string;
  cancelUrl?: string | null;
  attribution?: {
    landingPath?: string | null;
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    utmContent?: string | null;
    utmTerm?: string | null;
    affiliateRef?: string | null;
    campaignId?: string | null;
    adsetId?: string | null;
    adId?: string | null;
    funnelSessionId?: string | null;
  };
  catalog?: ChristmasProductDef[];
};

export type ChristmasCheckoutPlan =
  | {
      ok: true;
      productKey: string;
      packageKey: string;
      sku: string;
      amountCents: number;
      currency: string;
      productName: string;
      packageName: string;
      metadata: Record<string, string>;
    }
  | { ok: false; code: string; message: string };

/**
 * Build the authoritative checkout plan. Never trusts client price.
 */
export function planChristmasCheckout(
  input: CreateChristmasCheckoutInput,
): ChristmasCheckoutPlan {
  if (!christmasCheckoutEnabled()) {
    return {
      ok: false,
      code: "checkout_disabled",
      message: "Christmas checkout is not enabled.",
    };
  }

  const resolved = resolvePurchasableOffer({
    catalog: input.catalog || CHRISTMAS_CATALOG_SEED,
    productKey: input.productKey,
    packageKey: input.packageKey,
    clientAmountCents: input.clientAmountCents,
    clientCurrency: input.clientCurrency,
  });

  if (!resolved.ok) {
    return {
      ok: false,
      code: resolved.code,
      message: `Cannot purchase: ${resolved.code}`,
    };
  }

  if (resolved.amountCents <= 0) {
    return {
      ok: false,
      code: "invalid_price",
      message: "Configured package price is not valid for checkout.",
    };
  }

  return {
    ok: true,
    productKey: resolved.product.productKey,
    packageKey: resolved.package.packageKey,
    sku: resolved.sku,
    amountCents: resolved.amountCents,
    currency: resolved.currency,
    productName: resolved.product.name,
    packageName: resolved.package.packageName,
    metadata: {
      product_family: CHRISTMAS_PRODUCT_FAMILY,
      product_type: "christmas",
      product_key: resolved.product.productKey,
      package_key: resolved.package.packageKey,
      sku: resolved.sku,
    },
  };
}

export function isChristmasCheckoutMetadata(metadata: Record<string, unknown>): boolean {
  const family = String(metadata.product_family || "").trim();
  const productType = String(metadata.product_type || "").trim();
  return family === CHRISTMAS_PRODUCT_FAMILY || productType === "christmas";
}

export function stripeCheckoutIdempotencyKey(orderId: string, issuedCount = 0): string {
  if (issuedCount <= 0) return `xmas-checkout-${orderId}`;
  return `xmas-checkout-${orderId}-${issuedCount}`;
}
