import { PET_PRICE_CENTS, PET_V2_PRICE_CENTS } from "./constants.ts";

/** Live V1 promo charged instead of the $27 list price. */
export const PET_SALE_PRICE_CENTS = 1700 as const;
export const PET_SALE_PRICE_DISPLAY = "$17" as const;

/**
 * Shared real expiry for every visitor.
 * Tuesday Aug 25, 2026 10:30 AM Pacific — 24 hours from this change.
 * After this instant, checkout and the public offer return $27 again.
 */
export const PET_SALE_EXPIRES_AT_ISO = "2026-08-25T17:30:00.000Z" as const;
export const PET_SALE_EXPIRES_AT_MS = Date.parse(PET_SALE_EXPIRES_AT_ISO);

export type PetFlashSale = {
  active: boolean;
  amountCents: number;
  priceDisplay: string;
  compareAtCents: number;
  compareAtDisplay: string;
  expiresAt: string | null;
  remainingMs: number;
};

export function petFlashSale(nowMs = Date.now()): PetFlashSale {
  const remainingMs = PET_SALE_EXPIRES_AT_MS - nowMs;
  if (remainingMs <= 0) {
    return {
      active: false,
      amountCents: PET_PRICE_CENTS,
      priceDisplay: "$27",
      compareAtCents: PET_PRICE_CENTS,
      compareAtDisplay: "$27",
      expiresAt: null,
      remainingMs: 0,
    };
  }
  return {
    active: true,
    amountCents: PET_SALE_PRICE_CENTS,
    priceDisplay: PET_SALE_PRICE_DISPLAY,
    compareAtCents: PET_PRICE_CENTS,
    compareAtDisplay: "$27",
    expiresAt: PET_SALE_EXPIRES_AT_ISO,
    remainingMs,
  };
}

export function applyPetFlashSaleAmount(listAmountCents: number, nowMs = Date.now()): number {
  const sale = petFlashSale(nowMs);
  return sale.active ? sale.amountCents : listAmountCents;
}

/** V2 charges $12 while the shared promo window is open, then $27. Never uses the V1 $17 overlay. */
export function applyV2SaleAmount(nowMs = Date.now()): number {
  return nowMs < PET_SALE_EXPIRES_AT_MS ? PET_V2_PRICE_CENTS : PET_PRICE_CENTS;
}

export function checkoutAmountNeedsRefresh(orderAmountCents: number, liveAmountCents: number): boolean {
  return Number(orderAmountCents) !== Number(liveAmountCents);
}

export function publicFlashSaleFields(nowMs = Date.now()) {
  const sale = petFlashSale(nowMs);
  return {
    amountCents: sale.amountCents,
    priceDisplay: sale.priceDisplay,
    compareAtCents: sale.active ? sale.compareAtCents : undefined,
    compareAtDisplay: sale.active ? sale.compareAtDisplay : undefined,
    saleExpiresAt: sale.expiresAt,
    saleActive: sale.active,
  };
}
