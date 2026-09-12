import { PET_PRICE_CENTS, PET_V2_PRICE_CENTS, PET_V3_PRICE_CENTS } from "./constants.ts";
import {
  formatPetMoneyServer,
  normalizePetCurrency,
  petV2SaleAmount,
  petV3SaleAmount,
  type PetCurrency,
} from "./currency.ts";

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
 * @deprecated V2 now always charges the presentment-currency sale amount with a rolling UI timer.
 * Kept so older imports still resolve.
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

/** V2 always charges presentment-currency sale amount. Never uses the V1 $17 overlay. */
export function applyV2SaleAmount(_nowMs = Date.now(), currency: PetCurrency | string = "usd"): number {
  return petV2SaleAmount(normalizePetCurrency(currency));
}

/** V3 cat funnel sale amount in presentment currency. */
export function applyV3SaleAmount(currency: PetCurrency | string = "usd"): number {
  return petV3SaleAmount(normalizePetCurrency(currency));
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

export function v2PresentmentPrice(currency: PetCurrency | string = "usd") {
  const code = normalizePetCurrency(currency);
  const amount = petV2SaleAmount(code);
  return {
    currency: code,
    amountCents: amount,
    priceDisplay: formatPetMoneyServer(amount, code),
  };
}

// Keep unused constant references for compatibility with older bundles.
void PET_V2_PRICE_CENTS;
void PET_V3_PRICE_CENTS;
