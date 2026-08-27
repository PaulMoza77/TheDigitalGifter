import { formatSaleCountdown } from "../pet/flashSale";
import {
  PET_V2_COMPARE_PRICE_CENTS,
  PET_V2_COMPARE_PRICE_DISPLAY,
  PET_V2_PRICE_CENTS,
  PET_V2_PRICE_DISPLAY,
} from "./types";

/** Rolling 24-hour urgency window — resets every cycle; checkout price stays $2.99. */
export const PET_V2_SALE_CYCLE_MS = 24 * 60 * 60 * 1000;

/** First cycle anchor (V2 dog funnel $2.99 rolling offer). */
export const PET_V2_SALE_EPOCH_MS = Date.parse("2026-08-26T19:00:00.000Z");

export type V2FlashSale = {
  saleActive: boolean;
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

/** Always $2.99 from $27 — timer rolls every 24h for urgency. */
export function v2FlashSale(nowMs = Date.now()): V2FlashSale {
  const remainingMs = v2SaleRemainingMs(nowMs);
  return {
    saleActive: true,
    amountCents: PET_V2_PRICE_CENTS,
    priceDisplay: PET_V2_PRICE_DISPLAY,
    compareAtCents: PET_V2_COMPARE_PRICE_CENTS,
    compareAtDisplay: PET_V2_COMPARE_PRICE_DISPLAY,
    expiresAt: new Date(nowMs + remainingMs).toISOString(),
    remainingMs,
  };
}

export function v2SaleCountdownLabel(nowMs = Date.now()): string {
  return formatSaleCountdown(v2SaleRemainingMs(nowMs));
}
