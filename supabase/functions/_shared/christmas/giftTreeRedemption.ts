/**
 * Gift Tree entitlement redemption helpers for Christmas checkout / fulfillment.
 * Keep entitlement keys aligned with giftTreeRewards.ts / rewardCatalog.ts.
 */

export type GiftTreeDiscountEntitlement = {
  id: string;
  entitlement_key: string;
  percent_off: number;
};

export type GiftTreeFreeEntitlement = {
  id: string;
  entitlement_key: string;
};

const FREE_PRODUCT_KEYS: Record<string, string[]> = {
  gift_tree_free_image: ["christmas_photo"],
  gift_tree_christmas_portrait: ["christmas_family", "christmas_kids", "christmas_couple"],
  gift_tree_pet_christmas_portrait: ["christmas_pet"],
};

const DISCOUNT_PRODUCT_KEYS: Record<string, { percent: number; products: string[] }> = {
  gift_tree_santa_discount_15: {
    percent: 15,
    products: ["christmas_santa_video"],
  },
  gift_tree_premium_discount_25: {
    percent: 25,
    products: ["christmas_gift_tree", "christmas_tree"],
  },
};

export function freeEntitlementKeysForProduct(productKey: string): string[] {
  return Object.entries(FREE_PRODUCT_KEYS)
    .filter(([, products]) => products.includes(productKey))
    .map(([key]) => key);
}

export function discountSpecForProduct(
  productKey: string,
): Array<{ key: string; percent: number }> {
  return Object.entries(DISCOUNT_PRODUCT_KEYS)
    .filter(([, spec]) => spec.products.includes(productKey))
    .map(([key, spec]) => ({ key, percent: spec.percent }));
}

export function applyPercentOff(amountCents: number, percentOff: number): number {
  const pct = Math.min(100, Math.max(0, Math.floor(percentOff)));
  if (!Number.isFinite(amountCents) || amountCents <= 0) return 0;
  return Math.max(0, Math.round((amountCents * (100 - pct)) / 100));
}

type EntitlementRow = {
  id: string;
  entitlement_key: string;
  redeemed_at?: string | null;
  status?: string | null;
  expires_at?: string | null;
};

export function isEntitlementRedeemable(row: EntitlementRow, now = new Date()): boolean {
  if (row.redeemed_at) return false;
  if (row.status && !["available", "credits_granted", "claimed"].includes(row.status)) {
    return false;
  }
  if (row.expires_at && new Date(row.expires_at).getTime() < now.getTime()) return false;
  return true;
}

export function pickFreeEntitlement(
  rows: EntitlementRow[],
  productKey: string,
): GiftTreeFreeEntitlement | null {
  const keys = new Set(freeEntitlementKeysForProduct(productKey));
  for (const row of rows) {
    if (!keys.has(row.entitlement_key)) continue;
    if (!isEntitlementRedeemable(row)) continue;
    return { id: row.id, entitlement_key: row.entitlement_key };
  }
  return null;
}

export function pickDiscountEntitlement(
  rows: EntitlementRow[],
  productKey: string,
): GiftTreeDiscountEntitlement | null {
  const specs = discountSpecForProduct(productKey);
  let best: GiftTreeDiscountEntitlement | null = null;
  for (const row of rows) {
    const spec = specs.find((s) => s.key === row.entitlement_key);
    if (!spec) continue;
    if (!isEntitlementRedeemable(row)) continue;
    if (!best || spec.percent > best.percent_off) {
      best = {
        id: row.id,
        entitlement_key: row.entitlement_key,
        percent_off: spec.percent,
      };
    }
  }
  return best;
}
