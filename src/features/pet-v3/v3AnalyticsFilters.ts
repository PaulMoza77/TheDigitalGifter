export type V3AnalyticsFilters = {
  campaignId?: string;
  adsetId?: string;
  adId?: string;
  creativeId?: string;
  utmSource?: string;
  utmMedium?: string;
  funnelVersion?: string;
};

export const EMPTY_V3_ANALYTICS_FILTERS: V3AnalyticsFilters = {};

export function v3RpcFilterArgs(filters: V3AnalyticsFilters = EMPTY_V3_ANALYTICS_FILTERS) {
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
