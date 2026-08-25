import { PET_PRICE_CENTS, PET_PRICE_DISPLAY } from "./types";

/** Live V1 promo charged instead of the $27 list price. */
export const PET_SALE_PRICE_CENTS = 1700 as const;
export const PET_SALE_PRICE_DISPLAY = "$17" as const;

/**
 * V1 dog-funnel $17 overlay expiry (ended).
 * Kept so unpaid V1 checkouts refresh back to $27.
 */
export const PET_SALE_EXPIRES_AT_ISO = "2026-08-25T17:30:00.000Z" as const;
export const PET_SALE_EXPIRES_AT_MS = Date.parse(PET_SALE_EXPIRES_AT_ISO);

/**
 * V2 pack offer: $12 from $27 for every visitor until this instant.
 * Wednesday Aug 26, 2026 11:35 AM Pacific — 24 hours from this change.
 * After this, V2 UI + checkout return to $27.
 */
export const PET_V2_SALE_EXPIRES_AT_ISO = "2026-08-26T18:35:00.000Z" as const;
export const PET_V2_SALE_EXPIRES_AT_MS = Date.parse(PET_V2_SALE_EXPIRES_AT_ISO);

export type PetFlashSale = {
  active: boolean;
  amountCents: number;
  priceDisplay: string;
  compareAtCents: number;
  compareAtDisplay: string;
  expiresAt: string | null;
  remainingMs: number;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function petFlashSale(nowMs = Date.now()): PetFlashSale {
  const remainingMs = PET_SALE_EXPIRES_AT_MS - nowMs;
  if (remainingMs <= 0) {
    return {
      active: false,
      amountCents: PET_PRICE_CENTS,
      priceDisplay: PET_PRICE_DISPLAY,
      compareAtCents: PET_PRICE_CENTS,
      compareAtDisplay: PET_PRICE_DISPLAY,
      expiresAt: null,
      remainingMs: 0,
    };
  }
  return {
    active: true,
    amountCents: PET_SALE_PRICE_CENTS,
    priceDisplay: PET_SALE_PRICE_DISPLAY,
    compareAtCents: PET_PRICE_CENTS,
    compareAtDisplay: PET_PRICE_DISPLAY,
    expiresAt: PET_SALE_EXPIRES_AT_ISO,
    remainingMs,
  };
}

export function applyPetFlashSaleAmount(listAmountCents: number, nowMs = Date.now()): number {
  const sale = petFlashSale(nowMs);
  return sale.active ? sale.amountCents : listAmountCents;
}

export function checkoutAmountNeedsRefresh(orderAmountCents: number, liveAmountCents: number): boolean {
  return Number(orderAmountCents) !== Number(liveAmountCents);
}

export function formatSaleCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return "";
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
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
