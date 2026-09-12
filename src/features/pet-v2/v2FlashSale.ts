import { formatSaleCountdown } from "../pet/flashSale";
import {
  formatPetMoney,
  normalizePetCurrency,
  petV2CompareAmount,
  petV2SaleAmount,
  type PetCurrency,
} from "../pet/i18n/currency";
import {
  PET_V2_COMPARE_PRICE_CENTS,
  PET_V2_COMPARE_PRICE_DISPLAY,
  PET_V2_PRICE_CENTS,
  PET_V2_PRICE_DISPLAY,
} from "./types";

/** Rolling 24-hour urgency window — resets every cycle; checkout uses presentment currency. */
export const PET_V2_SALE_CYCLE_MS = 24 * 60 * 60 * 1000;

/** First cycle anchor (V2 dog funnel rolling offer). */
export const PET_V2_SALE_EPOCH_MS = Date.parse("2026-08-26T19:00:00.000Z");

export type V2FlashSale = {
  saleActive: boolean;
  currency: PetCurrency;
  amountCents: number;
  priceDisplay: string;
  compareAtCents: number;
  compareAtDisplay: string;
  expiresAt: string;
  remainingMs: number;
};

export function v2SaleRemainingMs(nowMs = Date.now()): number {
  const elapsed = Math.max(0, nowMs - PET_V2_SALE_EPOCH_MS);
  const positionInCycle = elapsed % PET_V2_SALE_CYCLE_MS;
  if (positionInCycle === 0 && elapsed > 0) {
    return PET_V2_SALE_CYCLE_MS;
  }
  return PET_V2_SALE_CYCLE_MS - positionInCycle;
}

/** Sale + compare amounts in presentment currency — timer rolls every 24h. */
export function v2FlashSale(nowMs = Date.now(), currency: PetCurrency | string = "usd"): V2FlashSale {
  const code = normalizePetCurrency(currency);
  const remainingMs = v2SaleRemainingMs(nowMs);
  const amountCents = petV2SaleAmount(code);
  const compareAtCents = petV2CompareAmount(code);
  return {
    saleActive: true,
    currency: code,
    amountCents,
    priceDisplay: formatPetMoney(amountCents, code),
    compareAtCents,
    compareAtDisplay: formatPetMoney(compareAtCents, code),
    expiresAt: new Date(nowMs + remainingMs).toISOString(),
    remainingMs,
  };
}

export function v2SaleCountdownLabel(nowMs = Date.now()): string {
  return formatSaleCountdown(v2SaleRemainingMs(nowMs));
}

/** USD defaults retained for isolation tests / legacy constants. */
void PET_V2_PRICE_CENTS;
void PET_V2_PRICE_DISPLAY;
void PET_V2_COMPARE_PRICE_CENTS;
void PET_V2_COMPARE_PRICE_DISPLAY;
