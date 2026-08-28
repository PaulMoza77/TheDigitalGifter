import * as React from "react";
import { supabase } from "@/lib/supabase";
import {
  attributionFallbackLabel,
  biggestFunnelDrop,
  buildFunnelSteps,
  buildKpis,
  countsFromRows,
  emptyStepCounts,
  funnelWarnings,
  percent,
  rangeForPreset,
  type AttributionBreakdownRow,
  type DatePreset,
  type PetFunnelAnalyticsReport,
  type SpeciesBreakdownRow,
} from "@/features/pet/funnelDashboard";
import {
  biggestHybridDrop,
  buildDailyPerformance,
  buildHybridKpis,
  buildHybridStages,
  classifyRangeMode,
  mergeMetaAdRows,
  safeCpaCents,
  safeRoas,
} from "@/features/pet/funnelHybrid";
import {
  datasetCampaignId,
  datasetSwitchLabel,
  isDatasetConfigured,
  isMetaCampaignConfigured,
  mapV2CountsToPrimarySteps,
  mapV3CountsToExtendedSteps,
  mapV3CountsToPrimarySteps,
  buildV3ExtendedFunnelSteps,
  namedEventCounts,
  rpcCampaignIdForDataset,
  type FunnelDatasetId,
} from "@/features/pet/funnelDatasetConfig";
import {
  v3RpcFilterArgs,
  v3LegacyRpcFilterArgs,
  v3TrustedRpcFilterArgs,
  type V3AnalyticsFilters,
  EMPTY_V3_ANALYTICS_FILTERS,
} from "@/features/pet-v3/v3AnalyticsFilters";
import { v3IncludeInternalTests } from "@/features/pet-v3/v3Measurement";
import { sequentialConversionPct } from "@/features/pet/funnelEventContract";
import { V1_PHOTO_PATH_STAGES } from "@/features/pet/funnelCohort";

type RpcRow = Record<string, unknown>;

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseRpcJsonArray(value: unknown): RpcRow[] {
  if (Array.isArray(value)) return value as RpcRow[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed as RpcRow[];
    } catch {
      // Fall through.
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const steps = (value as RpcRow).steps;
    if (Array.isArray(steps)) return steps as RpcRow[];
  }
  return [];
}

function parseRpcJsonObject(value: unknown): RpcRow | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as RpcRow;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as RpcRow;
    } catch {
      // Fall through.
    }
  }
  return null;
}

function mapBreakdown(row: RpcRow, kind: "campaign" | "ad", metaSpendByKey?: Map<string, { spendCents: number; purchaseValueCents: number; purchases: number }>): AttributionBreakdownRow {
  const sourceGroup = row.source_group === "meta" || row.source_group === "other" ? row.source_group : "unattributed";
  const fallback = attributionFallbackLabel({
    utmSource: sourceGroup === "unattributed" ? null : String(row.campaign || ""),
    campaignId: sourceGroup === "meta" ? String(row.campaign || "") : null,
  });
  const lpv = asNumber(row.lpv);
  const purchase = asNumber(row.purchase_count);
  const campaignId = row.campaign_id ? String(row.campaign_id) : null;
  const adId = row.ad_id ? String(row.ad_id) : null;
  const metaKey = kind === "ad" ? adId : campaignId;
  const meta = metaKey && metaSpendByKey ? metaSpendByKey.get(metaKey) : undefined;
  const spendCents = meta?.spendCents ?? null;
  const cpaCents = spendCents == null ? null : safeCpaCents(spendCents, purchase);
  const roas = spendCents == null ? null : safeRoas(asNumber(row.revenue_cents) || meta?.purchaseValueCents || 0, spendCents);
  return {
    campaign: String(row.campaign || fallback.label),
    adSet: String(row.ad_set || "—"),
    ad: String(row.ad || (kind === "ad" ? fallback.label : "—")),
    campaignId,
    adsetId: row.adset_id ? String(row.adset_id) : null,
    adId,
    sourceGroup,
    lpv,
    name: asNumber(row.name_count),
    upload: asNumber(row.upload_count),
    review: asNumber(row.review_count),
    checkout: asNumber(row.checkout_count),
    purchase,
    revenueCents: asNumber(row.revenue_cents),
    cvr: percent(purchase, lpv),
    spendCents,
    cpaCents,
    roas,
    spend: spendCents,
    cpa: cpaCents,
  };
}

function mapSpecies(row: RpcRow): SpeciesBreakdownRow | null {
  const species = row.species;
  if (species !== "dog" && species !== "cat" && species !== "other") return null;
  const lpv = asNumber(row.lpv);
  const purchase = asNumber(row.purchase_count);
  return {
    species,
    lpv,
    checkout: asNumber(row.checkout_count),
    purchase,
    cvr: percent(purchase, lpv),
    revenueCents: asNumber(row.revenue_cents),
  };
}

export type SyncActionResult = {
  ok?: boolean;
  error?: string;
  results?: Array<Record<string, unknown>>;
};

export function usePetFunnelAnalytics(
  preset: DatePreset,
  custom?: { from: string; to: string },
  datasetId: FunnelDatasetId = "v1",
  v3Filters: V3AnalyticsFilters = EMPTY_V3_ANALYTICS_FILTERS,
) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [report, setReport] = React.useState<PetFunnelAnalyticsReport | null>(null);
  const [syncing, setSyncing] = React.useState(false);
  const [syncMessage, setSyncMessage] = React.useState("");
  const [syncStatus, setSyncStatus] = React.useState<{
    metaConfigured: boolean | null;
    ga4Configured: boolean | null;
    metaLastSyncedAt: string | null;
    ga4LastSyncedAt: string | null;
    metaMissing: string[];
    ga4Missing: string[];
  }>({
    metaConfigured: null,
    ga4Configured: null,
    metaLastSyncedAt: null,
    ga4LastSyncedAt: null,
    metaMissing: [],
    ga4Missing: [],
  });

  const loadSyncStatus = React.useCallback(async () => {
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("pet-analytics-sync", {
        body: { action: "status" },
      });
      if (invokeError) return;
      const payload = (data || {}) as RpcRow;
      const meta = (payload.meta || {}) as RpcRow;
      const ga4 = (payload.ga4 || {}) as RpcRow;
      setSyncStatus({
        metaConfigured: Boolean(meta.configured),
        ga4Configured: Boolean(ga4.configured),
        metaLastSyncedAt: meta.lastSyncedAt ? String(meta.lastSyncedAt) : null,
        ga4LastSyncedAt: ga4.lastSyncedAt ? String(ga4.lastSyncedAt) : null,
        metaMissing: Array.isArray(meta.missing) ? (meta.missing as string[]) : [],
        ga4Missing: Array.isArray(ga4.missing) ? (ga4.missing as string[]) : [],
      });
    } catch {
      // Status is best-effort; dashboard still works from RPC data.
    }
  }, []);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError("");
    const range = rangeForPreset(preset, new Date(), custom);
    let v3AllowlistCampaignId: string | null = null;
    let v3AllowlistLabel: string | null = null;
    if (datasetId === "v3") {
      const { data: allowRow } = await supabase
        .from("pet_meta_campaign_allowlist")
        .select("campaign_id, label")
        .eq("enabled", true)
        .or("funnel_variant.eq.v3_cat_preview,label.ilike.cat v3")
        .limit(1)
        .maybeSingle();
      v3AllowlistCampaignId = allowRow?.campaign_id ? String(allowRow.campaign_id) : null;
      v3AllowlistLabel = allowRow?.label ? String(allowRow.label) : null;

      if (!v3AllowlistCampaignId) {
        const { data: metricRow } = await supabase
          .from("pet_meta_daily_metrics")
          .select("campaign_id, campaign_name")
          .ilike("campaign_name", "cat v3")
          .order("metric_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (metricRow?.campaign_id) {
          v3AllowlistCampaignId = String(metricRow.campaign_id);
          v3AllowlistLabel = metricRow.campaign_name ? String(metricRow.campaign_name) : "Cat V3";
        }
      }
    }
    const configured = isDatasetConfigured(datasetId, v3AllowlistCampaignId);
    const metaCampaignConfigured = isMetaCampaignConfigured(datasetId, v3AllowlistCampaignId);
    const campaignId = rpcCampaignIdForDataset(datasetId, v3AllowlistCampaignId);
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_pet_funnel_analytics", {
        p_from: range.from.toISOString(),
        p_to: range.to.toISOString(),
        p_prev_from: range.previousFrom.toISOString(),
        p_prev_to: range.previousTo.toISOString(),
        p_campaign_id: campaignId,
        p_view_mode: "campaign",
        p_adset_id: null,
      });
      if (rpcError) throw new Error(rpcError.message);
      const payload = (data || {}) as RpcRow;

      let cohortPayload: RpcRow | null = null;
      if (datasetId === "v1" && configured) {
        const { data: cohortData, error: cohortError } = await supabase.rpc("admin_pet_v1_landing_cohort_funnel", {
          p_from: range.from.toISOString(),
          p_to: range.to.toISOString(),
          p_campaign_id: campaignId,
          p_view_mode: "campaign",
          p_measurement_reliable_from: payload.measurement_reliable_from || null,
        });
        if (!cohortError && cohortData) {
          cohortPayload = cohortData as RpcRow;
        }
      }

      let v3StepRows: RpcRow[] = [];
      let v3Context: RpcRow | null = null;
      let v3Meta: RpcRow | null = null;
      let v3Trusted: RpcRow | null = null;
      let v3Drilldown: RpcRow[] = [];
      if (datasetId === "v3") {
        const legacyFilterArgs = v3LegacyRpcFilterArgs(v3Filters);
        const trustedFilterArgs = v3TrustedRpcFilterArgs(v3Filters);
        const resolvedV3CampaignId = campaignId === "__not_configured__" ? null : campaignId;
        const [v3StepsRes, v3ContextRes, v3MetaRes, v3TrustedRes, v3DrillRes] = await Promise.all([
          supabase.rpc("admin_pet_v3_funnel_step_counts", {
            p_from: range.from.toISOString(),
            p_to: range.to.toISOString(),
            ...legacyFilterArgs,
          }),
          supabase.rpc("admin_pet_v3_dashboard_context", {
            p_from: range.from.toISOString(),
            p_to: range.to.toISOString(),
            ...legacyFilterArgs,
          }),
          supabase.rpc("admin_pet_v3_meta_context", {
            p_from: range.from.toISOString(),
            p_to: range.to.toISOString(),
            p_campaign_id: resolvedV3CampaignId,
          }),
          supabase.rpc("admin_pet_v3_trusted_summary", {
            p_from: range.from.toISOString(),
            p_to: range.to.toISOString(),
            ...trustedFilterArgs,
          }),
          supabase.rpc("admin_pet_v3_session_drilldown", {
            p_from: range.from.toISOString(),
            p_to: range.to.toISOString(),
            p_include_internal_tests: trustedFilterArgs.p_include_internal_tests,
            p_traffic_class: trustedFilterArgs.p_traffic_class,
            p_limit: 40,
          }),
        ]);
        if (v3StepsRes.error) throw new Error(v3StepsRes.error.message);
        if (v3ContextRes.error) throw new Error(v3ContextRes.error.message);
        v3StepRows = parseRpcJsonArray(v3StepsRes.data);
        v3Context = parseRpcJsonObject(v3ContextRes.data);
        if (!v3MetaRes.error) {
          v3Meta = parseRpcJsonObject(v3MetaRes.data);
        }
        if (!v3TrustedRes.error) {
          v3Trusted = parseRpcJsonObject(v3TrustedRes.data);
        }
        if (!v3DrillRes.error) {
          v3Drilldown = parseRpcJsonArray(v3DrillRes.data);
        }
      }

      const v1RawCounts = countsFromRows((payload.steps as RpcRow[]) || []);
      const v1CohortCounts = cohortPayload
        ? countsFromRows((cohortPayload.cohort_steps as RpcRow[]) || [])
        : null;
      const v1PreviousCounts = countsFromRows((payload.previous_steps as RpcRow[]) || []);
      const v2Counts = mapV2CountsToPrimarySteps(namedEventCounts((payload.v2_steps as RpcRow[]) || []));
      const v3RawCounts = namedEventCounts(v3StepRows);
      let v3Counts = mapV3CountsToPrimarySteps(v3RawCounts);
      const v3TrustedSeq = (v3Trusted?.production_sequential || null) as RpcRow | null;
      const v3ViewMode = v3Filters.viewMode || "production";
      if (datasetId === "v3" && v3TrustedSeq && v3ViewMode !== "raw") {
        v3Counts = {
          landing_view: asNumber(v3TrustedSeq.landing),
          pet_name_submitted: asNumber(v3TrustedSeq.uploads),
          photo_upload_completed: asNumber(v3TrustedSeq.previews),
          order_review_viewed: asNumber(v3TrustedSeq.offers),
          initiate_checkout: asNumber(v3TrustedSeq.checkout_sessions),
          purchase: asNumber(v3Trusted?.purchases),
        };
      }
      const v3ExtendedCounts = mapV3CountsToExtendedSteps(v3RawCounts);
      const v3ExtendedSteps = datasetId === "v3" ? buildV3ExtendedFunnelSteps(v3ExtendedCounts) : undefined;
      const counts =
        datasetId === "v3" ? v3Counts : datasetId === "v2" ? v2Counts : v1CohortCounts || v1RawCounts;
      const previousCounts = datasetId === "v2" || datasetId === "v3" ? emptyStepCounts() : v1PreviousCounts;
      const steps = buildFunnelSteps(counts);
      const previousSteps = buildFunnelSteps(previousCounts);
      const rawSteps = datasetId === "v1" ? buildFunnelSteps(v1RawCounts) : previousSteps;

      const photoPathRows = ((cohortPayload?.photo_path_steps as RpcRow[]) || []);
      const photoPathByName = namedEventCounts(photoPathRows);
      const photoPathSteps = V1_PHOTO_PATH_STAGES.map((eventName, index) => {
        const sessions = photoPathByName[eventName] || 0;
        const previous =
          index === 0 ? null : photoPathByName[V1_PHOTO_PATH_STAGES[index - 1]] || 0;
        return {
          eventName,
          sessions,
          fromPreviousPct: previous == null ? null : sequentialConversionPct(sessions, previous),
        };
      });
      const firstEventAt =
        datasetId === "v3"
          ? v3Context?.latest_event_at
            ? String(v3Context.latest_event_at)
            : null
          : payload.first_event_at
            ? String(payload.first_event_at)
            : payload.first_party_tracking_started_at
              ? String(payload.first_party_tracking_started_at)
              : null;
      const firstPartyTrackingStartedAt =
        datasetId === "v3"
          ? firstEventAt
          : payload.first_party_tracking_started_at
            ? String(payload.first_party_tracking_started_at)
            : firstEventAt;
      const rangeMode = classifyRangeMode(range.from.toISOString(), range.to.toISOString(), firstPartyTrackingStartedAt);

      const backend = (payload.backend || {}) as RpcRow;
      const v3Backend = (v3Context?.backend || {}) as RpcRow;
      const meta = (
        datasetId === "v3" && !metaCampaignConfigured ? v3Meta || {} : payload.meta || {}
      ) as RpcRow;
      const ga4 = (payload.ga4 || {}) as RpcRow;
      const metaTotals = (meta.totals || {}) as RpcRow;
      const ga4Totals = (ga4.totals || {}) as RpcRow;

      const backendPurchases =
        datasetId === "v3" ? asNumber(v3Backend.purchases) : asNumber(backend.purchases);
      const backendRevenue =
        datasetId === "v3" ? asNumber(v3Backend.revenue_cents) : asNumber(backend.revenue_cents);
      const backendCheckouts =
        datasetId === "v3"
          ? v3TrustedSeq && v3ViewMode !== "raw"
            ? asNumber(v3TrustedSeq.checkout_sessions)
            : asNumber(v3Backend.checkouts)
          : asNumber(backend.checkouts);
      const freeDiscountOrders =
        datasetId === "v3" ? asNumber(v3Backend.free_orders) : asNumber(backend.free_orders);
      const liveName =
        datasetId === "v3"
          ? v3AllowlistLabel || undefined
          : ((payload.catalog as RpcRow[]) || [])
              .map((row) => ({
                campaignId: String(row.campaign_id || ""),
                name: String(row.display_name || row.campaign_name || ""),
              }))
              .find((row) => row.campaignId === datasetCampaignId(datasetId, v3AllowlistCampaignId))?.name;

      const hybridStages = buildHybridStages({
        mode: rangeMode,
        firstPartyCounts: counts,
        backendCheckouts,
        backendPurchases,
        meta: {
          landingPageViews: asNumber(metaTotals.landing_page_views),
          initiateCheckouts: asNumber(metaTotals.initiate_checkouts),
          purchases: asNumber(metaTotals.purchases),
          petNameSubmitted: asNullableNumber(metaTotals.pet_name_submitted),
          photoUploadCompleted: asNullableNumber(metaTotals.photo_upload_completed),
          orderReviewViewed: asNullableNumber(metaTotals.order_review_viewed),
        },
        ga4: {
          landingViews: asNumber(ga4Totals.landing_views),
          petNameSubmitted: asNullableNumber(ga4Totals.pet_name_submitted),
          photoUploadCompleted: asNullableNumber(ga4Totals.photo_upload_completed),
          orderReviewViewed: asNullableNumber(ga4Totals.order_review_viewed),
          beginCheckouts: asNumber(ga4Totals.begin_checkouts),
        },
      });

      const metaSpendCents = asNumber(meta.row_count) > 0 ? asNumber(metaTotals.spend_cents) : null;
      const hybridKpis = buildHybridKpis({
        stages: hybridStages,
        spendCents: metaSpendCents,
        impressions: asNumber(metaTotals.impressions),
        linkClicks: asNumber(metaTotals.link_clicks),
        revenueCents: backendRevenue,
        metaLpv: asNumber(metaTotals.landing_page_views),
        metaPurchaseValueCents: asNumber(meta.row_count) > 0 ? asNumber(metaTotals.purchase_value_cents) : null,
        metaAttributedPurchases: asNumber(meta.row_count) > 0 ? asNumber(metaTotals.purchases) : null,
        freeDiscountOrders,
      });

      const metaAdsRaw = ((meta.ads as RpcRow[]) || []) as RpcRow[];
      const metaCampaignsRaw = ((meta.campaigns as RpcRow[]) || []) as RpcRow[];
      const spendByCampaign = new Map<string, { spendCents: number; purchaseValueCents: number; purchases: number }>();
      const spendByAd = new Map<string, { spendCents: number; purchaseValueCents: number; purchases: number }>();
      for (const row of metaCampaignsRaw) {
        const id = String(row.campaign_id || "");
        if (!id) continue;
        spendByCampaign.set(id, {
          spendCents: asNumber(row.spend_cents),
          purchaseValueCents: asNumber(row.purchase_value_cents),
          purchases: asNumber(row.purchases),
        });
      }
      for (const row of metaAdsRaw) {
        const id = String(row.ad_id || "");
        if (!id) continue;
        spendByAd.set(id, {
          spendCents: asNumber(row.spend_cents),
          purchaseValueCents: asNumber(row.purchase_value_cents),
          purchases: asNumber(row.purchases),
        });
      }

      const firstPartyAds = ((payload.ads as RpcRow[]) || []).map((row) => mapBreakdown(row, "ad", spendByAd));
      const metaAds = mergeMetaAdRows(
        metaAdsRaw.map((row) => ({
          campaign_id: String(row.campaign_id || ""),
          campaign_name: String(row.campaign_name || ""),
          adset_id: String(row.adset_id || ""),
          adset_name: String(row.adset_name || ""),
          ad_id: String(row.ad_id || ""),
          ad_name: String(row.ad_name || ""),
          spend_cents: asNumber(row.spend_cents),
          impressions: asNumber(row.impressions),
          link_clicks: asNumber(row.link_clicks),
          landing_page_views: asNumber(row.landing_page_views),
          initiate_checkouts: asNumber(row.initiate_checkouts),
          purchases: asNumber(row.purchases),
          purchase_value_cents: asNumber(row.purchase_value_cents),
        })),
        firstPartyAds.map((row) => ({ ad_id: row.adId, ad: row.ad, upload: row.upload })),
      );

      // Prefer Meta campaign table when spend sync has rows; otherwise first-party attribution.
      const campaigns: AttributionBreakdownRow[] =
        metaCampaignsRaw.length > 0
          ? metaCampaignsRaw.map((row) => {
              const spendCents = asNumber(row.spend_cents);
              const purchase = asNumber(row.purchases);
              const revenueCents = asNumber(row.purchase_value_cents);
              const lpv = asNumber(row.landing_page_views);
              const impressions = asNumber(row.impressions);
              const linkClicks = asNumber(row.link_clicks);
              const cpcCents = spendCents > 0 && linkClicks > 0 ? Math.round(spendCents / linkClicks) : null;
              return {
                campaign: String(row.campaign_name || row.campaign_id || "Campaign"),
                adSet: String(row.adset_name || "—"),
                ad: String(row.ad_name || "—"),
                campaignId: String(row.campaign_id || ""),
                adsetId: String(row.adset_id || ""),
                adId: String(row.ad_id || ""),
                sourceGroup: "meta" as const,
                lpv,
                name: 0,
                upload: 0,
                review: 0,
                checkout: asNumber(row.initiate_checkouts),
                purchase,
                revenueCents,
                cvr: percent(purchase, lpv),
                spendCents,
                cpaCents: safeCpaCents(spendCents, purchase),
                roas: safeRoas(revenueCents, spendCents),
                spend: spendCents,
                cpa: safeCpaCents(spendCents, purchase),
                impressions,
                linkClicks,
                cpcCentsComputed: cpcCents,
                ctrPct: percent(linkClicks, impressions),
              };
            })
          : ((payload.campaigns as RpcRow[]) || []).map((row) => mapBreakdown(row, "campaign", spendByCampaign));

      const daily = buildDailyPerformance({
        metaDaily:
          datasetId === "v3" && !metaCampaignConfigured
            ? (((v3Meta?.daily as RpcRow[]) || []) as Array<{
                metric_date?: string;
                spend_cents?: number;
                landing_page_views?: number;
                initiate_checkouts?: number;
                purchases?: number;
                purchase_value_cents?: number;
              }>)
            : (((meta.daily as RpcRow[]) || []) as Array<{
                metric_date?: string;
                spend_cents?: number;
                landing_page_views?: number;
                initiate_checkouts?: number;
                purchases?: number;
                purchase_value_cents?: number;
              }>),
        backendDaily:
          datasetId === "v3"
            ? (((v3Context?.daily as RpcRow[]) || []) as Array<{
                metric_date?: string;
                purchases?: number;
                revenue_cents?: number;
              }>)
            : (((backend.daily as RpcRow[]) || []) as Array<{
                metric_date?: string;
                purchases?: number;
                revenue_cents?: number;
              }>),
        checkoutDaily:
          datasetId === "v3"
            ? (((v3Context?.checkout_daily as RpcRow[]) || []) as Array<{
                metric_date?: string;
                checkouts?: number;
              }>)
            : (((backend.checkout_daily as RpcRow[]) || []) as Array<{
                metric_date?: string;
                checkouts?: number;
              }>),
      });

      const paidKpiCounts = { ...counts, purchase: backendPurchases };
      const firstPartyKpis = buildKpis(
        paidKpiCounts,
        // Stripe charged amount is business truth, including $0 when all orders were comps.
        backendRevenue,
        Object.prototype.hasOwnProperty.call(backend, "previous_revenue_cents")
          ? asNumber(backend.previous_revenue_cents)
          : asNumber(payload.previous_revenue_cents),
      );
      firstPartyKpis.checkouts = backendCheckouts;

      const ads = firstPartyAds;
      const v3CampaignRows: AttributionBreakdownRow[] = datasetId === "v3"
        ? (((v3Context?.campaigns as RpcRow[]) || []).map((row) => ({
            campaign: String(row.campaign || "Unattributed"),
            adSet: "—",
            ad: "—",
            campaignId: row.campaign_id ? String(row.campaign_id) : null,
            adsetId: null,
            adId: null,
            sourceGroup: row.campaign_id && row.campaign_id !== "unattributed" ? ("meta" as const) : ("unattributed" as const),
            lpv: asNumber(row.lpv),
            name: asNumber(row.upload_count),
            upload: asNumber(row.upload_count),
            review: asNumber(row.review_count),
            checkout: asNumber(row.checkout_count),
            purchase: asNumber(row.purchase_count),
            revenueCents: asNumber(row.revenue_cents),
            cvr: percent(asNumber(row.purchase_count), asNumber(row.lpv)),
            spendCents: null,
            cpaCents: null,
            roas: null,
            spend: null,
            cpa: null,
          })))
        : campaigns;

      const v3Creatives = datasetId === "v3"
        ? (((v3Context?.creatives as RpcRow[]) || []).map((row) => ({
            creativeId: String(row.creative_id || "unattributed"),
            lpv: asNumber(row.lpv),
            checkoutViewed: asNumber(row.checkout_viewed_count),
            checkout: asNumber(row.checkout_count),
            purchase: asNumber(row.purchase_count),
            revenueCents: asNumber(row.revenue_cents),
          })))
        : undefined;

      const mapped: PetFunnelAnalyticsReport = {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        firstEventAt,
        firstPartyTrackingStartedAt,
        rangeMode,
        steps,
        previousSteps,
        hybridStages,
        hybridKpis,
        trackingHealth: {
          failedWrites: (() => {
            if (datasetId === "v3") {
              return asNullableNumber(v3Context?.failed_writes);
            }
            const health =
              payload.tracking_health && typeof payload.tracking_health === "object"
                ? (payload.tracking_health as RpcRow)
                : null;
            if (!health) return null;
            const key = datasetId === "v2" ? "v2_failed_write_count" : "v1_failed_write_count";
            return asNullableNumber(health[key] ?? health.v2_failed_write_count ?? health.v1_failed_write_count ?? health.failed_write_count);
          })(),
          latestFirstPartyAt: (() => {
            if (datasetId === "v3") {
              const at = v3Context?.latest_event_at;
              return at ? String(at) : firstEventAt;
            }
            const health =
              payload.tracking_health && typeof payload.tracking_health === "object"
                ? (payload.tracking_health as RpcRow)
                : null;
            if (!health) return firstEventAt;
            const key = datasetId === "v2" ? "latest_v2_event_at" : "latest_v1_event_at";
            const value =
              health[key] ??
              health.latest_v2_event_at ??
              health.latest_v1_event_at ??
              health.latest_first_party_event_at;
            return value ? String(value) : firstEventAt;
          })(),
        },
        daily,
        metaAds,
        sync: {
          metaConfigured: null,
          ga4Configured: null,
          metaLastSyncedAt: meta.last_synced_at ? String(meta.last_synced_at) : null,
          ga4LastSyncedAt: ga4.last_synced_at ? String(ga4.last_synced_at) : null,
          metaMissing: [],
          ga4Missing: [],
        },
        kpis: firstPartyKpis,
        campaigns:
          datasetId === "v3"
            ? metaCampaignsRaw.length > 0
              ? campaigns
              : v3CampaignRows
            : campaigns,
        ads: datasetId === "v3" ? [] : ads,
        species:
          datasetId === "v3"
            ? [
                {
                  species: "cat" as const,
                  lpv: counts.landing_view,
                  checkout: counts.initiate_checkout,
                  purchase: backendPurchases,
                  cvr: percent(backendPurchases, counts.landing_view),
                  revenueCents: backendRevenue,
                },
              ]
            : ((payload.species as RpcRow[]) || []).map(mapSpecies).filter((row): row is SpeciesBreakdownRow => Boolean(row)),
        devices:
          datasetId === "v3"
            ? (((v3Context?.devices as RpcRow[]) || []).map((row) => ({
                deviceType: String(row.device_type || "unknown"),
                lpv: asNumber(row.lpv),
                checkout: asNumber(row.checkout_count),
                purchase: asNumber(row.purchase_count),
              })))
            : ((payload.devices as RpcRow[]) || []).map((row) => ({
                deviceType: String(row.device_type || "unknown"),
                lpv: asNumber(row.lpv),
                checkout: asNumber(row.checkout_count),
                purchase: asNumber(row.purchase_count),
              })),
        recent:
          datasetId === "v3"
            ? (((v3Context?.recent as RpcRow[]) || []).map((row) => ({
                createdAt: String(row.created_at || ""),
                eventName: String(row.event_name || ""),
                species: row.species ? String(row.species) : "cat",
                sessionShort: String(row.session_short || ""),
                amountCents: row.amount_cents == null ? null : asNumber(row.amount_cents),
              })))
            : ((payload.recent as RpcRow[]) || []).map((row) => ({
                createdAt: String(row.created_at || ""),
                eventName: String(row.event_name || ""),
                species: row.species ? String(row.species) : null,
                sessionShort: String(row.session_short || ""),
                amountCents: row.amount_cents == null ? null : asNumber(row.amount_cents),
              })),
        warnings: funnelWarnings({
          steps,
          firstEventAt,
          rangeMode,
          metaConfigured: null,
          ads,
        }),
        biggestDrop: rangeMode === "first_party" ? biggestFunnelDrop(steps) : biggestHybridDrop(hybridStages),
        spendAvailable: metaSpendCents != null && metaSpendCents >= 0 && asNumber(meta.row_count) > 0,
        datasetId,
        datasetConfigured: configured,
        metaCampaignConfigured,
        campaignLabel: datasetSwitchLabel(datasetId, liveName),
        measurementReliableFrom:
          datasetId === "v3"
            ? v3Trusted?.measurement_reliable_from
              ? String(v3Trusted.measurement_reliable_from)
              : null
            : payload.measurement_reliable_from
              ? String(payload.measurement_reliable_from)
              : null,
        v3Trusted:
          datasetId === "v3" && v3Trusted
            ? {
                measurementReliableFrom: v3Trusted.measurement_reliable_from
                  ? String(v3Trusted.measurement_reliable_from)
                  : null,
                priceCohortFrom: v3Trusted.price_cohort_from ? String(v3Trusted.price_cohort_from) : null,
                priceCohortCents: asNumber(v3Trusted.price_cohort_cents) || 299,
                viewMode: v3ViewMode,
                includeInternalTests: v3IncludeInternalTests(v3ViewMode),
                trafficBreakdown: ((v3Trusted.traffic_breakdown as RpcRow[]) || []).map((row) => ({
                  traffic_class: String(row.traffic_class || "unattributed"),
                  landing_sessions: asNumber(row.landing_sessions),
                })),
                productionSequential: {
                  landing: asNumber(v3TrustedSeq?.landing),
                  uploads: asNumber(v3TrustedSeq?.uploads),
                  previews: asNumber(v3TrustedSeq?.previews),
                  offers: asNumber(v3TrustedSeq?.offers),
                  checkout_sessions: asNumber(v3TrustedSeq?.checkout_sessions),
                  checkout_clicks: asNumber(v3TrustedSeq?.checkout_clicks),
                },
                paidMetaLandings: asNumber(v3Trusted.paid_meta_landings),
                rawTotals: {
                  landing: asNumber((v3Trusted.raw_totals as RpcRow)?.landing),
                  checkout_clicks: asNumber((v3Trusted.raw_totals as RpcRow)?.checkout_clicks),
                  checkout_sessions: asNumber((v3Trusted.raw_totals as RpcRow)?.checkout_sessions),
                },
                purchases: asNumber(v3Trusted.purchases),
                revenueCents: asNumber(v3Trusted.revenue_cents),
              }
            : undefined,
        v3SessionDrilldown:
          datasetId === "v3"
            ? v3Drilldown.map((row) => ({
                session_short: String(row.session_short || ""),
                landing_at: String(row.landing_at || ""),
                traffic_class: row.traffic_class ? String(row.traffic_class) : null,
                is_test: Boolean(row.is_test),
                stripe_checkout_created: Boolean(row.stripe_checkout_created),
                checkout_button_click: Boolean(row.checkout_button_click),
                paid_purchase: Boolean(row.paid_purchase),
                events: Array.isArray(row.events)
                  ? (row.events as RpcRow[]).map((ev) => ({
                      event_name: String(ev.event_name || ""),
                      created_at: String(ev.created_at || ""),
                    }))
                  : [],
              }))
            : undefined,
        rawSteps: datasetId === "v1" ? rawSteps : undefined,
        photoPathSteps: datasetId === "v1" && photoPathSteps.some((s) => s.sessions > 0) ? photoPathSteps : undefined,
        v3ExtendedSteps,
        v3Creatives,
      };
      setReport(mapped);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Failed to load funnel analytics");
    } finally {
      setLoading(false);
    }
  }, [preset, custom?.from, custom?.to, datasetId, v3Filters]);

  // Attach latest sync status onto the report without re-fetching RPC.
  React.useEffect(() => {
    setReport((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sync: {
          metaConfigured: syncStatus.metaConfigured,
          ga4Configured: syncStatus.ga4Configured,
          metaLastSyncedAt: syncStatus.metaLastSyncedAt || prev.sync.metaLastSyncedAt,
          ga4LastSyncedAt: syncStatus.ga4LastSyncedAt || prev.sync.ga4LastSyncedAt,
          metaMissing: syncStatus.metaMissing,
          ga4Missing: syncStatus.ga4Missing,
        },
        warnings: funnelWarnings({
          steps: prev.steps,
          firstEventAt: prev.firstEventAt,
          rangeMode: prev.rangeMode,
          metaConfigured: syncStatus.metaConfigured,
          ads: prev.ads,
        }),
      };
    });
  }, [syncStatus]);

  const runSync = React.useCallback(
    async (mode: "historical" | "today" | "yesterday" | "today_yesterday") => {
      setSyncing(true);
      setSyncMessage("");
      try {
        const { data, error: invokeError } = await supabase.functions.invoke<SyncActionResult>("pet-analytics-sync", {
          body: { action: "sync", mode },
        });
        if (invokeError) throw new Error(invokeError.message);
        if (data?.error) throw new Error(data.error);
        const results = data?.results || [];
        const parts = results.map((r) => `${r.source}:${r.status}`);
        setSyncMessage(parts.length ? `Sync complete (${parts.join(", ")})` : "Sync complete");
        await loadSyncStatus();
        await refresh();
      } catch (err) {
        setSyncMessage(err instanceof Error ? err.message : "Sync failed");
      } finally {
        setSyncing(false);
      }
    },
    [loadSyncStatus, refresh],
  );

  React.useEffect(() => {
    void loadSyncStatus();
  }, [loadSyncStatus]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, error, report, refresh, syncing, syncMessage, runSync, syncStatus };
}
