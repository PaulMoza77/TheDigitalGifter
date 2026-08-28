/**
 * V3 certified measurement and price cohort boundaries.
 * Neither timestamp is client-defined — both are set via admin RPC after deploy verification.
 */
export const PET_V3_PRICE_COHORT_CENTS = 299 as const;

/** Set via DB `pet_v3_measurement_settings` after production deploy certifies tracking. */
export const PET_V3_MEASUREMENT_RELIABLE_FROM: string | null = null;

/** Not certified until `admin_pet_v3_certify_measurement` sets `price_cohort_certified_at`. */
export const PET_V3_PRICE_COHORT_CERTIFIED_AT: string | null = null;

/**
 * Documented production deploy reference for $2.99 pricing code (NOT a certified cohort timestamp).
 * Vercel Production deploy SHA `01fde32` at 2026-08-27T21:28:28Z merged PR #55.
 * Production KPI cohort still requires explicit admin certification after analytics audit.
 */
export const PET_V3_PRICE_DEPLOY_REFERENCE = {
  sha: "01fde3223ace0c17a183db0b93ee11296795653f",
  deployedAt: "2026-08-27T21:28:28.000Z",
  note: "Historical/unverified until price_cohort_certified_at is set in pet_v3_measurement_settings",
} as const;

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

export function v3PriceCohortIsCertified(certifiedAt: string | null | undefined): boolean {
  return Boolean(certifiedAt);
}
