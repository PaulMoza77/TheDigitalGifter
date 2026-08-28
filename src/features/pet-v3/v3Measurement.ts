/**
 * V3 certified measurement and price cohort boundaries.
 * `measurementReliableFrom` is set in production after this analytics release deploys.
 * `priceCohortFrom` is proven from prod-publish commit a1e03c7 (2026-08-27T21:11:06Z).
 */
export const PET_V3_PRICE_COHORT_CENTS = 299 as const;

/** Set via DB `pet_v3_measurement_settings` after production deploy certifies tracking. */
export const PET_V3_MEASUREMENT_RELIABLE_FROM: string | null = null;

/** $2.99 became active in production at this UTC timestamp (git: a1e03c7 [prod-publish]). */
export const PET_V3_PRICE_COHORT_FROM = "2026-08-27T21:11:06.000Z";

export type V3AnalyticsViewMode =
  | "production"
  | "include_tests"
  | "paid_meta"
  | "external_other"
  | "unattributed"
  | "raw";

export const V3_ANALYTICS_VIEW_MODES: V3AnalyticsViewMode[] = [
  "production",
  "include_tests",
  "paid_meta",
  "external_other",
  "unattributed",
  "raw",
];

export function v3AnalyticsViewModeLabel(mode: V3AnalyticsViewMode): string {
  switch (mode) {
    case "production":
      return "Production only";
    case "include_tests":
      return "Include internal tests";
    case "paid_meta":
      return "Paid Meta only";
    case "external_other":
      return "External / organic";
    case "unattributed":
      return "Unattributed";
    case "raw":
      return "Raw diagnostic totals";
  }
}

/** Maps dashboard view mode to RPC traffic_class filter (null = all classes). */
export function v3TrafficClassForViewMode(mode: V3AnalyticsViewMode): string | null {
  switch (mode) {
    case "paid_meta":
      return "paid_meta";
    case "external_other":
      return "external_other";
    case "unattributed":
      return "unattributed";
    default:
      return null;
  }
}

export function v3IncludeInternalTests(mode: V3AnalyticsViewMode): boolean {
  return mode === "include_tests" || mode === "raw";
}

export function v3UseProductionKpiFilters(mode: V3AnalyticsViewMode): boolean {
  return mode === "production" || mode === "paid_meta" || mode === "external_other" || mode === "unattributed";
}
