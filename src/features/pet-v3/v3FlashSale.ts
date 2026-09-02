import { formatSaleCountdown } from "../pet/flashSale";
import {
  PET_V3_COMPARE_PRICE_DISPLAY,
  PET_V3_PRICE_CENTS,
  PET_V3_PRICE_DISPLAY,
} from "./types";

/** Rolling 24-hour urgency window — resets every cycle; checkout price stays $2.99. */
export const PET_V3_SALE_CYCLE_MS = 24 * 60 * 60 * 1000;

/** First cycle anchor (V3 cat funnel production launch). */
export const PET_V3_SALE_EPOCH_MS = Date.parse("2026-08-26T07:00:00.000Z");

export type V3FlashSale = {
  saleActive: boolean;
  amountCents: number;
  priceDisplay: string;
  compareAtCents: number;
  compareAtDisplay: string;
  expiresAt: string;
  remainingMs: number;
};

export function v3SaleRemainingMs(nowMs = Date.now()): number {
  const elapsed = Math.max(0, nowMs - PET_V3_SALE_EPOCH_MS);
  const positionInCycle = elapsed % PET_V3_SALE_CYCLE_MS;
  if (positionInCycle === 0 && elapsed > 0) {
    return PET_V3_SALE_CYCLE_MS;
  }
  return PET_V3_SALE_CYCLE_MS - positionInCycle;
}

/** Always $2.99 from $27 — timer rolls every 24h for urgency. */
export function v3FlashSale(nowMs = Date.now()): V3FlashSale {
  const remainingMs = v3SaleRemainingMs(nowMs);
  return {
    saleActive: true,
    amountCents: PET_V3_PRICE_CENTS,
    priceDisplay: PET_V3_PRICE_DISPLAY,
    compareAtCents: 2700,
    compareAtDisplay: PET_V3_COMPARE_PRICE_DISPLAY,
    expiresAt: new Date(nowMs + remainingMs).toISOString(),
    remainingMs,
  };
}

export function v3SaleCountdownLabel(nowMs = Date.now()): string {
  return formatSaleCountdown(v3SaleRemainingMs(nowMs));
}
