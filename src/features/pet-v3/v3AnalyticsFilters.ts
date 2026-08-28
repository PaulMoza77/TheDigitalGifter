import {
  v3IncludeInternalTests,
  v3TrafficClassForViewMode,
  type V3AnalyticsViewMode,
} from "./v3Measurement";

export type V3AnalyticsFilters = {
  campaignId?: string;
  adsetId?: string;
  adId?: string;
  creativeId?: string;
  utmSource?: string;
  utmMedium?: string;
  funnelVersion?: string;
  viewMode?: V3AnalyticsViewMode;
  priceCohortOnly?: boolean;
};

export const EMPTY_V3_ANALYTICS_FILTERS: V3AnalyticsFilters = {};

export function v3LegacyRpcFilterArgs(filters: V3AnalyticsFilters = EMPTY_V3_ANALYTICS_FILTERS) {
  const trim = (value?: string) => {
    const next = String(value || "").trim();
    return next.length > 0 ? next : null;
  };
  return {
    p_funnel_version: trim(filters.funnelVersion) || "v3",
    p_campaign_id: trim(filters.campaignId),
    p_adset_id: trim(filters.adsetId),
    p_ad_id: trim(filters.adId),
    p_creative_id: trim(filters.creativeId),
    p_utm_source: trim(filters.utmSource),
    p_utm_medium: trim(filters.utmMedium),
  };
}

export function v3TrustedRpcFilterArgs(filters: V3AnalyticsFilters = EMPTY_V3_ANALYTICS_FILTERS) {
  const viewMode: V3AnalyticsViewMode = filters.viewMode || "production";
  return {
    ...v3LegacyRpcFilterArgs(filters),
    p_include_internal_tests: v3IncludeInternalTests(viewMode),
    p_traffic_class: v3TrafficClassForViewMode(viewMode),
    p_price_cohort_only: filters.priceCohortOnly !== false,
  };
}

/** @deprecated Use v3LegacyRpcFilterArgs or v3TrustedRpcFilterArgs explicitly. */
export function v3RpcFilterArgs(filters: V3AnalyticsFilters = EMPTY_V3_ANALYTICS_FILTERS) {
  return v3LegacyRpcFilterArgs(filters);
}

export function v3FiltersActive(filters: V3AnalyticsFilters = EMPTY_V3_ANALYTICS_FILTERS): boolean {
  return Boolean(
    filters.campaignId?.trim() ||
      filters.adsetId?.trim() ||
      filters.adId?.trim() ||
      filters.creativeId?.trim() ||
      filters.utmSource?.trim() ||
      filters.utmMedium?.trim(),
  );
}
