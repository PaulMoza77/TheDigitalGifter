import { KONTEXT_PRO_MODEL, KONTEXT_PRO_UNIT_COST_USD } from "../pet/aiCost";
import {
  PET_V2_MAX_FREE_PREVIEWS_PER_SESSION,
  PET_V2_PRODUCTION_PRICE_CENTS,
  PET_V2_TEST_PRICE_CENTS,
} from "./types";

/** Verified from src/features/pet/aiCost.ts — do not invent a different tariff. */
export const V2_PREVIEW_PROVIDER = "replicate" as const;
export const V2_PREVIEW_MODEL = KONTEXT_PRO_MODEL;
export const V2_PREVIEW_UNIT_COST_USD = KONTEXT_PRO_UNIT_COST_USD;
export const V2_PREVIEW_SCENE_COUNT = 1 as const;

export const V2_COST_SOURCE =
  "Repository tariff snapshot: KONTEXT_PRO_UNIT_COST_USD in src/features/pet/aiCost.ts (ai_model_pricing).";

export function costForPreviews(count: number, unitCostUsd = V2_PREVIEW_UNIT_COST_USD): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return roundUsd(count * unitCostUsd);
}

export function revenueAtPrice(purchases: number, priceCents: number): number {
  if (!Number.isFinite(purchases) || purchases <= 0) return 0;
  return roundUsd((purchases * priceCents) / 100);
}

export function purchasesAtConversion(previews: number, conversionPct: number): number {
  if (!Number.isFinite(previews) || previews <= 0) return 0;
  if (!Number.isFinite(conversionPct) || conversionPct <= 0) return 0;
  return Math.floor((previews * conversionPct) / 100);
}

export type PreviewEconomicsRow = {
  previews: number;
  conversionPct: number;
  purchases: number;
  generationCostUsd: number;
  testRevenueUsd: number;
  productionRevenueUsd: number;
  grossAfterAiTestUsd: number;
  grossAfterAiProductionUsd: number;
};

export function economicsAtConversion(
  previews: number,
  conversionPct: number,
): PreviewEconomicsRow {
  const purchases = purchasesAtConversion(previews, conversionPct);
  const generationCostUsd = costForPreviews(previews);
  const testRevenueUsd = revenueAtPrice(purchases, PET_V2_TEST_PRICE_CENTS);
  const productionRevenueUsd = revenueAtPrice(purchases, PET_V2_PRODUCTION_PRICE_CENTS);
  return {
    previews,
    conversionPct,
    purchases,
    generationCostUsd,
    testRevenueUsd,
    productionRevenueUsd,
    grossAfterAiTestUsd: roundUsd(testRevenueUsd - generationCostUsd),
    grossAfterAiProductionUsd: roundUsd(productionRevenueUsd - generationCostUsd),
  };
}

export function worstCaseSessionCostUsd(): number {
  return costForPreviews(PET_V2_MAX_FREE_PREVIEWS_PER_SESSION);
}

function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}
