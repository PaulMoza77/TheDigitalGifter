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
  mapV2CountsToPrimarySteps,
  mapV3CountsToPrimarySteps,
  namedEventCounts,
  rpcCampaignIdForDataset,
  type FunnelDatasetId,
} from "@/features/pet/funnelDatasetConfig";
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
    const configured = isDatasetConfigured(datasetId);
    const campaignId = rpcCampaignIdForDataset(datasetId);
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
      if (datasetId === "v3") {
        const { data: v3Data, error: v3Error } = await supabase.rpc("admin_pet_v3_funnel_step_counts", {
          p_from: range.from.toISOString(),
          p_to: range.to.toISOString(),
        });
        if (!v3Error && Array.isArray(v3Data)) {
          v3StepRows = v3Data as RpcRow[];
        } else if (!v3Error && v3Data && typeof v3Data === "object") {
          v3StepRows = (v3Data as RpcRow).steps as RpcRow[] || [];
        }
      }

      const v1RawCounts = countsFromRows((payload.steps as RpcRow[]) || []);
      const v1CohortCounts = cohortPayload
        ? countsFromRows((cohortPayload.cohort_steps as RpcRow[]) || [])
        : null;
      const v1PreviousCounts = countsFromRows((payload.previous_steps as RpcRow[]) || []);
      const v2Counts = mapV2CountsToPrimarySteps(namedEventCounts((payload.v2_steps as RpcRow[]) || []));
      const v3Counts = mapV3CountsToPrimarySteps(
        namedEventCounts(v3StepRows.length ? v3StepRows : ((payload.v3_steps as RpcRow[]) || [])),
      );
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
      const liveName = ((payload.catalog as RpcRow[]) || [])
        .map((row) => ({
          campaignId: String(row.campaign_id || ""),
          name: String(row.display_name || row.campaign_name || ""),
        }))
        .find((row) => row.campaignId === datasetCampaignId(datasetId))?.name;

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
            const health =
              payload.tracking_health && typeof payload.tracking_health === "object"
                ? (payload.tracking_health as RpcRow)
                : null;
            if (!health) return null;
            const key = datasetId === "v2" ? "v2_failed_write_count" : "v1_failed_write_count";
            return asNullableNumber(health[key] ?? health.v2_failed_write_count ?? health.v1_failed_write_count ?? health.failed_write_count);
          })(),
          latestFirstPartyAt: (() => {
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
        datasetId,
        datasetConfigured: configured,
        campaignLabel: datasetSwitchLabel(datasetId, liveName),
        measurementReliableFrom: payload.measurement_reliable_from
          ? String(payload.measurement_reliable_from)
          : null,
        rawSteps: datasetId === "v1" ? rawSteps : undefined,
        photoPathSteps: datasetId === "v1" && photoPathSteps.some((s) => s.sessions > 0) ? photoPathSteps : undefined,
      };
      setReport(mapped);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Failed to load funnel analytics");
    } finally {
      setLoading(false);
    }
  }, [preset, custom?.from, custom?.to, datasetId]);

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
