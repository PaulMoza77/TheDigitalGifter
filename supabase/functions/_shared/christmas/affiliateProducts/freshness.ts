export type AffiliateFreshnessState = "fresh" | "aging" | "stale" | "unknown";

export type AffiliateFreshnessThresholds = {
  freshMs: number;
  staleAfterMs: number;
};

export const DEFAULT_AFFILIATE_FRESHNESS: AffiliateFreshnessThresholds = {
  freshMs: 24 * 60 * 60 * 1000,
  staleAfterMs: 7 * 24 * 60 * 60 * 1000,
};

export function affiliateFreshnessState(
  checkedAt: string | null | undefined,
  nowMs: number = Date.now(),
  thresholds: AffiliateFreshnessThresholds = DEFAULT_AFFILIATE_FRESHNESS,
): AffiliateFreshnessState {
  if (!checkedAt) return "unknown";
  const then = Date.parse(checkedAt);
  if (!Number.isFinite(then)) return "unknown";
  const age = nowMs - then;
  if (age < 0) return "fresh";
  if (age < thresholds.freshMs) return "fresh";
  if (age <= thresholds.staleAfterMs) return "aging";
  return "stale";
}

export function freshnessAgeDays(checkedAt: string | null | undefined, nowMs: number = Date.now()): number | null {
  if (!checkedAt) return null;
  const then = Date.parse(checkedAt);
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.floor((nowMs - then) / (24 * 60 * 60 * 1000)));
}

export function freshnessCheckedLabel(
  checkedAt: string | null | undefined,
  nowMs: number = Date.now(),
): string | null {
  const days = freshnessAgeDays(checkedAt, nowMs);
  if (days == null) return null;
  if (days <= 0) return "Price checked today";
  if (days === 1) return "Price checked 1 day ago";
  return `Price checked ${days} days ago`;
}

export function shouldPromptPriceCheck(state: AffiliateFreshnessState): boolean {
  return state === "stale" || state === "unknown" || state === "aging";
}
