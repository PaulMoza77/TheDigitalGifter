import * as React from "react";
import { supabase } from "@/lib/supabase";
import {
  attributionFallbackLabel,
  biggestFunnelDrop,
  buildFunnelSteps,
  buildKpis,
  countsFromRows,
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
  buildCampaignCostMetrics,
  buildFunnelFromCounts,
  countsFromNamedRows,
  firstPartyConversionPct,
  isCampaignViewMode,
  isFunnelVariant,
  scopedCountsFromSummary,
  unattributedShare,
  type CampaignAnalyticsConfig,
  type CampaignViewMode,
  type FunnelVariant,
} from "@/features/pet/funnelCampaignAnalytics";

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

export type CampaignAnalyticsSelection = {
  mode: CampaignViewMode;
  campaignId?: string | null;
  adsetId?: string | null;
};

export function usePetFunnelAnalytics(
  preset: DatePreset,
  custom?: { from: string; to: string },
  selection?: CampaignAnalyticsSelection,
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
    const viewMode: CampaignViewMode = selection?.mode && isCampaignViewMode(selection.mode) ? selection.mode : "all";
    const selectedCampaignId = selection?.campaignId ? String(selection.campaignId) : null;
    const selectedAdsetId = selection?.adsetId ? String(selection.adsetId) : null;
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_pet_funnel_analytics", {
        p_from: range.from.toISOString(),
        p_to: range.to.toISOString(),
        p_prev_from: range.previousFrom.toISOString(),
        p_prev_to: range.previousTo.toISOString(),
        p_campaign_id: viewMode === "campaign" ? selectedCampaignId : null,
        p_view_mode: viewMode,
        p_adset_id: viewMode === "campaign" ? selectedAdsetId : null,
      });
      if (rpcError) throw new Error(rpcError.message);
      const payload = (data || {}) as RpcRow;
      const counts = countsFromRows((payload.steps as RpcRow[]) || []);
      const previousCounts = countsFromRows((payload.previous_steps as RpcRow[]) || []);
      const steps = buildFunnelSteps(counts);
      const previousSteps = buildFunnelSteps(previousCounts);
      const firstEventAt = payload.first_event_at
        ? String(payload.first_event_at)
        : payload.first_party_tracking_started_at
          ? String(payload.first_party_tracking_started_at)
          : null;
      const firstPartyTrackingStartedAt = payload.first_party_tracking_started_at
        ? String(payload.first_party_tracking_started_at)
        : firstEventAt;
      const rangeMode = classifyRangeMode(range.from.toISOString(), range.to.toISOString(), firstPartyTrackingStartedAt);

      const backend = (payload.backend || {}) as RpcRow;
      const meta = (payload.meta || {}) as RpcRow;
      const ga4 = (payload.ga4 || {}) as RpcRow;
      const metaTotals = (meta.totals || {}) as RpcRow;
      const ga4Totals = (ga4.totals || {}) as RpcRow;

      const backendPurchases = asNumber(backend.purchases);
      const backendRevenue = asNumber(backend.revenue_cents);
      const backendCheckouts = asNumber(backend.checkouts);
      const freeDiscountOrders = asNumber(backend.free_orders);

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
        metaDaily: ((meta.daily as RpcRow[]) || []) as Array<{
          metric_date?: string;
          spend_cents?: number;
          landing_page_views?: number;
          initiate_checkouts?: number;
          purchases?: number;
          purchase_value_cents?: number;
        }>,
        backendDaily: ((backend.daily as RpcRow[]) || []) as Array<{
          metric_date?: string;
          purchases?: number;
          revenue_cents?: number;
        }>,
        checkoutDaily: ((backend.checkout_daily as RpcRow[]) || []) as Array<{
          metric_date?: string;
          checkouts?: number;
        }>,
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
      const catalog: CampaignAnalyticsConfig[] = ((payload.catalog as RpcRow[]) || [])
        .map((row) => ({
          campaignId: String(row.campaign_id || ""),
          displayName: String(row.display_name || row.campaign_id || "Campaign"),
          funnelVariant: isFunnelVariant(row.funnel_variant) ? row.funnel_variant : null,
          utmCampaignAliases: Array.isArray(row.utm_campaign_aliases)
            ? (row.utm_campaign_aliases as unknown[]).map((value) => String(value || "")).filter(Boolean)
            : [],
          measurementReliableFrom: row.measurement_reliable_from ? String(row.measurement_reliable_from) : null,
        }))
        .filter((row) => row.campaignId);
      const campaignSummaries = ((payload.campaign_summaries as RpcRow[]) || []).map((row) => scopedCountsFromSummary(row));
      const selectedConfig =
        viewMode === "campaign" && selectedCampaignId
          ? catalog.find((row) => row.campaignId === selectedCampaignId) || null
          : null;
      const funnelVariant: FunnelVariant | null = selectedConfig?.funnelVariant ?? null;
      const v2Counts = countsFromNamedRows((payload.v2_steps as RpcRow[]) || []);
      const v2Stages = buildFunnelFromCounts("v2_preview", v2Counts);
      const variantStages =
        funnelVariant === "v2_preview"
          ? v2Stages
          : funnelVariant === "v1"
            ? buildFunnelFromCounts("v1", {
                landing_view: counts.landing_view,
                pet_name_submitted: counts.pet_name_submitted,
                photo_upload_completed: counts.photo_upload_completed,
                order_review_viewed: counts.order_review_viewed,
                initiate_checkout: counts.initiate_checkout,
                purchase: counts.purchase,
              })
            : [];
      const v2Latency = (payload.v2_latency || {}) as RpcRow;
      const v2Kpis =
        funnelVariant === "v2_preview" || viewMode === "unattributed"
          ? {
              uploadRate: firstPartyConversionPct(v2Counts.v2_upload_completed || 0, v2Counts.v2_landing_view || 0),
              previewGenerationSuccessRate: firstPartyConversionPct(
                v2Counts.v2_preview_generation_completed || 0,
                v2Counts.v2_preview_generation_started || 0,
              ),
              previewGenerationFailureRate: firstPartyConversionPct(
                v2Counts.v2_preview_generation_failed || 0,
                v2Counts.v2_preview_generation_started || 0,
              ),
              landingToPreviewViewed: firstPartyConversionPct(v2Counts.v2_preview_viewed || 0, v2Counts.v2_landing_view || 0),
              previewViewedToUnlock: firstPartyConversionPct(v2Counts.v2_unlock_clicked || 0, v2Counts.v2_preview_viewed || 0),
              unlockToCheckout: firstPartyConversionPct(v2Counts.v2_begin_checkout || 0, v2Counts.v2_unlock_clicked || 0),
              checkoutToPurchase: firstPartyConversionPct(v2Counts.v2_purchase || 0, v2Counts.v2_begin_checkout || 0),
              medianPreviewGenerationMs: asNullableNumber(v2Latency.median_ms),
              p90PreviewGenerationMs: asNullableNumber(v2Latency.p90_ms),
            }
          : null;
      const unattributedPayload = (payload.unattributed || {}) as RpcRow;
      const unattributedV1 = asNumber(unattributedPayload.v1_landings);
      const unattributedV2 = asNumber(unattributedPayload.v2_landings);
      const totalFpLandings =
        asNumber(unattributedPayload.v1_landings_total) + asNumber(unattributedPayload.v2_landings_total);
      const selectedSummary = selectedCampaignId
        ? campaignSummaries.find((row) => row.campaignId === selectedCampaignId)
        : null;
      const fpLandingForCosts =
        funnelVariant === "v2_preview"
          ? v2Counts.v2_landing_view || 0
          : funnelVariant === "v1"
            ? counts.landing_view
            : selectedSummary?.fpLanding || 0;
      const firstActionCount =
        funnelVariant === "v2_preview"
          ? v2Counts.v2_upload_completed || 0
          : funnelVariant === "v1"
            ? counts.pet_name_submitted
            : 0;
      const checkoutForCosts = funnelVariant === "v2_preview" ? v2Counts.v2_begin_checkout || 0 : backendCheckouts;
      const purchaseForCosts = funnelVariant === "v2_preview" ? v2Counts.v2_purchase || 0 : backendPurchases;
      const costMetrics =
        viewMode === "campaign"
          ? buildCampaignCostMetrics({
              spendCents: metaSpendCents,
              fpLanding: fpLandingForCosts,
              firstAction: firstActionCount,
              checkout: checkoutForCosts,
              purchase: purchaseForCosts,
              revenueCents: funnelVariant === "v2_preview" ? Number(selectedSummary?.revenueCents || 0) : backendRevenue,
              metaLpv: asNumber(metaTotals.landing_page_views),
            })
          : null;
      const fpAdsetById = new Map(((payload.fp_adsets as RpcRow[]) || []).map((row) => [String(row.adset_id || ""), row]));
      const v2FpAdsetById = new Map(((payload.v2_fp_adsets as RpcRow[]) || []).map((row) => [String(row.adset_id || ""), row]));
      const metaAdsets = (((meta.adsets as RpcRow[]) || []) as RpcRow[]).map((row) => {
        const id = String(row.adset_id || "");
        const v1fp = fpAdsetById.get(id);
        const v2fp = v2FpAdsetById.get(id);
        return {
          campaignId: String(row.campaign_id || ""),
          campaignName: String(row.campaign_name || row.campaign_id || "Campaign"),
          adsetId: id,
          adsetName: String(row.adset_name || id || "Ad set"),
          spendCents: asNumber(row.spend_cents),
          lpv: asNumber(row.landing_page_views),
          linkClicks: asNumber(row.link_clicks),
          impressions: asNumber(row.impressions),
          fpLanding: funnelVariant === "v2_preview" ? asNumber(v2fp?.v2_landing) : asNumber(v1fp?.v1_landing),
          firstAction: funnelVariant === "v2_preview" ? asNumber(v2fp?.v2_upload) : asNumber(v1fp?.v1_name),
          preview: funnelVariant === "v2_preview" ? asNumber(v2fp?.v2_preview) : undefined,
          checkout: funnelVariant === "v2_preview" ? asNumber(v2fp?.v2_checkout) : asNumber(v1fp?.v1_checkout),
          purchase: funnelVariant === "v2_preview" ? asNumber(v2fp?.v2_purchase) : asNumber(v1fp?.v1_purchase),
        };
      });

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
          failedWrites:
            payload.tracking_health && typeof payload.tracking_health === "object"
              ? asNullableNumber((payload.tracking_health as RpcRow).failed_write_count)
              : null,
          latestFirstPartyAt:
            payload.tracking_health && typeof payload.tracking_health === "object" && (payload.tracking_health as RpcRow).latest_first_party_event_at
              ? String((payload.tracking_health as RpcRow).latest_first_party_event_at)
              : firstEventAt,
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
        campaigns,
        ads,
        species: ((payload.species as RpcRow[]) || []).map(mapSpecies).filter((row): row is SpeciesBreakdownRow => Boolean(row)),
        devices: ((payload.devices as RpcRow[]) || []).map((row) => ({
          deviceType: String(row.device_type || "unknown"),
          lpv: asNumber(row.lpv),
          checkout: asNumber(row.checkout_count),
          purchase: asNumber(row.purchase_count),
        })),
        recent: ((payload.recent as RpcRow[]) || []).map((row) => ({
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
        viewMode,
        selectedCampaignId,
        selectedAdsetId,
        catalog,
        campaignSummaries,
        funnelVariant,
        variantStages,
        v2Stages,
        v2Kpis,
        unattributed: {
          v1Landings: unattributedV1,
          v2Landings: unattributedV2,
          totalFpLandings,
          pct: unattributedShare(unattributedV1 + unattributedV2, totalFpLandings),
        },
        measurementReliableFrom: payload.measurement_reliable_from
          ? String(payload.measurement_reliable_from)
          : selectedConfig?.measurementReliableFrom || null,
        dateFilterNote: payload.date_filter_note ? String(payload.date_filter_note) : null,
        timezone: payload.timezone ? String(payload.timezone) : "UTC",
        metaAdsets,
        costMetrics,
      };
      setReport(mapped);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Failed to load funnel analytics");
    } finally {
      setLoading(false);
    }
  }, [preset, custom?.from, custom?.to, selection?.mode, selection?.campaignId, selection?.adsetId]);

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

  const saveCampaignMapping = React.useCallback(
    async (input: {
      campaignId: string;
      funnelVariant: FunnelVariant | null;
      displayName?: string | null;
      utmCampaignAliases?: string[];
    }) => {
      const { error: rpcError } = await supabase.rpc("admin_upsert_pet_campaign_analytics_config", {
        p_campaign_id: input.campaignId,
        p_funnel_variant: input.funnelVariant,
        p_display_name: input.displayName ?? null,
        p_utm_campaign_aliases: input.utmCampaignAliases ?? [],
      });
      if (rpcError) throw new Error(rpcError.message);
      await refresh();
    },
    [refresh],
  );

  React.useEffect(() => {
    void loadSyncStatus();
  }, [loadSyncStatus]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, error, report, refresh, syncing, syncMessage, runSync, syncStatus, saveCampaignMapping };
}
