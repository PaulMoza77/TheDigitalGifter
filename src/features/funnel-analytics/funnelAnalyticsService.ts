/**
 * Admin funnel-registry reads. All Supabase access for this page lives here.
 * No mock / placeholder runtime rows — missing evidence stays unverified.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { v3MetaCampaignIdFromEnv } from "@/features/pet/funnelDatasetConfig";
import {
  combineHealth,
  resolveChannelHealth,
  resolveFirstPartyHealth,
  type ChannelDeliveryEvidence,
  type ChannelSyncStatus,
  type FunnelHealthState,
} from "./funnelHealth";
import { requiredFunnels, type FunnelRegistryEntry } from "./funnelRegistry";

export type FunnelChannelSnapshot = {
  health: FunnelHealthState;
  enabled: boolean;
  configured: boolean;
  deliveredRowCount: number;
  lastSuccessAt: string | null;
  lastStatus: ChannelSyncStatus;
  reason: string;
};

export type FunnelRegistryRow = {
  id: string;
  family: FunnelRegistryEntry["family"];
  displayName: string;
  shortLabel: string;
  routePath: string;
  enabled: boolean;
  notes: string;
  detailPath: string | null;
  ingestPath: string | null;
  health: FunnelHealthState;
  firstParty: FunnelChannelSnapshot;
  ga4: FunnelChannelSnapshot;
  meta: FunnelChannelSnapshot;
  firstPartyEventCount: number;
};

export type FunnelRegistryReport = {
  loadedAt: string;
  rows: FunnelRegistryRow[];
  summary: Record<FunnelHealthState, number>;
};

type SyncRunRow = {
  source: string;
  status: string;
  rows_upserted: number | null;
  finished_at: string | null;
  started_at: string | null;
};

type CountQuery = PromiseLike<{ count: number | null; error: { message: string } | null }>;

function asSyncStatus(value: unknown): ChannelSyncStatus {
  if (
    value === "success" ||
    value === "error" ||
    value === "running" ||
    value === "skipped_unconfigured"
  ) {
    return value;
  }
  return null;
}

async function exactCount(query: CountQuery): Promise<{ count: number; error: string | null }> {
  const { count, error } = await query;
  if (error) return { count: 0, error: error.message };
  return { count: Number(count) || 0, error: null };
}

function pickLatestRun(runs: SyncRunRow[], source: "meta" | "ga4"): SyncRunRow | null {
  return runs.find((row) => row.source === source) ?? null;
}

function pickLatestSuccess(runs: SyncRunRow[], source: "meta" | "ga4"): SyncRunRow | null {
  return (
    runs.find((row) => row.source === source && row.status === "success" && (Number(row.rows_upserted) || 0) > 0) ??
    null
  );
}

function firstPartyReason(entry: FunnelRegistryEntry, eventCount: number, failureCount: number, loadError: string | null) {
  if (!entry.enabled) return "Funnel is disabled.";
  if (!entry.channels.firstParty) return "First-party ingest is not wired.";
  if (loadError) return `First-party count failed: ${loadError}`;
  if (failureCount > 0) return `${failureCount} recent ingest failure(s) recorded.`;
  if (eventCount <= 0) return "No first-party events delivered yet.";
  return `${eventCount} first-party event(s) excluding test / founder traffic.`;
}

function channelReason(
  label: "GA4" | "Meta",
  evidence: ChannelDeliveryEvidence,
  health: FunnelHealthState,
  loadError: string | null,
) {
  if (loadError) return `${label} evidence query failed: ${loadError}`;
  if (!evidence.enabled) return `${label} is not wired for this funnel.`;
  if (!evidence.configured) return `${label} is not configured.`;
  if (health === "unverified") return `${label} has no delivered metric rows.`;
  if (health === "degraded") {
    if (evidence.lastStatus === "error") return `${label} last sync failed.`;
    return `${label} delivery is stale.`;
  }
  return `${label} has ${evidence.deliveredRowCount} delivered row(s).`;
}

function snapshot(
  evidence: ChannelDeliveryEvidence,
  label: "GA4" | "Meta",
  loadError: string | null,
  nowMs: number,
): FunnelChannelSnapshot {
  const health = resolveChannelHealth(evidence, nowMs);
  return {
    health,
    enabled: evidence.enabled,
    configured: evidence.configured,
    deliveredRowCount: evidence.deliveredRowCount,
    lastSuccessAt: evidence.lastSuccessAt,
    lastStatus: evidence.lastStatus,
    reason: channelReason(label, evidence, health, loadError),
  };
}

function emptySummary(): Record<FunnelHealthState, number> {
  return { healthy: 0, degraded: 0, unverified: 0, disabled: 0 };
}

export async function loadFunnelAnalyticsRegistry(
  client: SupabaseClient = supabase,
): Promise<FunnelRegistryReport> {
  const nowMs = Date.now();
  const entries = requiredFunnels();

  const christmasProductKeys = [
    ...new Set(entries.filter((entry) => entry.eventSource === "christmas_funnel_events" && entry.productKey).map((entry) => entry.productKey as string)),
  ];
  const metaCampaignIds = [
    ...new Set(
      entries
        .filter((entry) => entry.channels.meta)
        .map((entry) =>
          entry.id === "pet_v3" ? v3MetaCampaignIdFromEnv() || entry.metaCampaignId : entry.metaCampaignId,
        )
        .filter((id) => id.trim().length > 0),
    ),
  ];

  const [
    v1Events,
    v2Events,
    v3Events,
    xmasV2Events,
    petFailures,
    ga4Rows,
    syncRuns,
    ...scopedCounts
  ] = await Promise.all([
    exactCount(
      client.from("pet_funnel_events").select("id", { count: "exact", head: true }).eq("is_test", false),
    ),
    exactCount(
      client.from("pet_v2_funnel_events").select("id", { count: "exact", head: true }).eq("is_test", false),
    ),
    exactCount(
      client.from("pet_v3_funnel_events").select("id", { count: "exact", head: true }).eq("is_test", false),
    ),
    exactCount(client.from("christmas_v2_funnel_events").select("id", { count: "exact", head: true })),
    exactCount(
      client
        .from("pet_funnel_event_failures")
        .select("id", { count: "exact", head: true })
        .gte("created_at", new Date(nowMs - 72 * 60 * 60 * 1000).toISOString()),
    ),
    exactCount(client.from("pet_ga4_daily_metrics").select("id", { count: "exact", head: true })),
    client
      .from("pet_analytics_sync_runs")
      .select("source, status, rows_upserted, finished_at, started_at")
      .order("started_at", { ascending: false })
      .limit(20),
    ...christmasProductKeys.map((productKey) =>
      exactCount(
        client
          .from("christmas_funnel_events")
          .select("id", { count: "exact", head: true })
          .eq("is_test", false)
          .eq("product_key", productKey),
      ),
    ),
    ...metaCampaignIds.map((campaignId) =>
      exactCount(
        client
          .from("pet_meta_daily_metrics")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaignId),
      ),
    ),
  ]);

  const christmasCounts = new Map<string, number>();
  let christmasLoadError: string | null = null;
  christmasProductKeys.forEach((productKey, index) => {
    const result = scopedCounts[index];
    if (result.error) christmasLoadError = result.error;
    christmasCounts.set(productKey, result.count);
  });

  const metaByCampaign = new Map<string, number>();
  let metaLoadError: string | null = null;
  metaCampaignIds.forEach((campaignId, index) => {
    const result = scopedCounts[christmasProductKeys.length + index];
    if (result.error) metaLoadError = result.error;
    metaByCampaign.set(campaignId, result.count);
  });

  const ga4Count = ga4Rows.count;
  const ga4LoadError = ga4Rows.error;

  const runs: SyncRunRow[] = syncRuns.error ? [] : ((syncRuns.data || []) as SyncRunRow[]);
  const syncLoadError = syncRuns.error?.message ?? null;
  const ga4Run = pickLatestRun(runs, "ga4");
  const ga4Success = pickLatestSuccess(runs, "ga4");
  const metaRun = pickLatestRun(runs, "meta");
  const metaSuccess = pickLatestSuccess(runs, "meta");

  const petEventBySource: Record<string, { count: number; error: string | null }> = {
    pet_funnel_events: v1Events,
    pet_v2_funnel_events: v2Events,
    pet_v3_funnel_events: v3Events,
    christmas_v2_funnel_events: xmasV2Events,
  };

  const rows = entries.map((entry) => {
    let eventCount = 0;
    let eventError: string | null = null;
    if (entry.eventSource === "christmas_funnel_events") {
      eventCount = entry.productKey ? christmasCounts.get(entry.productKey) || 0 : 0;
      eventError = christmasLoadError;
    } else {
      const found = petEventBySource[entry.eventSource] || { count: 0, error: "Unknown event source" };
      eventCount = found.count;
      eventError = found.error;
    }

    const failureCount = entry.family === "pet" ? petFailures.count : 0;
    const firstPartyHealth = resolveFirstPartyHealth({
      enabled: entry.enabled && entry.channels.firstParty,
      ingestWired: Boolean(entry.ingestPath),
      eventCount,
      recentFailureCount: failureCount,
    });

    const ga4Evidence: ChannelDeliveryEvidence = {
      enabled: entry.enabled && entry.channels.ga4,
      configured: entry.channels.ga4,
      deliveredRowCount: entry.channels.ga4 ? ga4Count : 0,
      lastSuccessAt: ga4Success?.finished_at || ga4Success?.started_at || null,
      lastStatus: asSyncStatus(ga4Run?.status),
      lastRowsUpserted: Number(ga4Run?.rows_upserted) || 0,
    };

    const campaignId =
      entry.id === "pet_v3" ? v3MetaCampaignIdFromEnv() || entry.metaCampaignId : entry.metaCampaignId;
    const metaEvidence: ChannelDeliveryEvidence = {
      enabled: entry.enabled && entry.channels.meta,
      configured: entry.channels.meta && campaignId.trim().length > 0,
      deliveredRowCount: campaignId ? metaByCampaign.get(campaignId) || 0 : 0,
      lastSuccessAt: metaSuccess?.finished_at || metaSuccess?.started_at || null,
      lastStatus: asSyncStatus(metaRun?.status),
      lastRowsUpserted: Number(metaRun?.rows_upserted) || 0,
    };

    const firstParty: FunnelChannelSnapshot = {
      health: firstPartyHealth,
      enabled: entry.enabled && entry.channels.firstParty,
      configured: Boolean(entry.ingestPath),
      deliveredRowCount: eventCount,
      lastSuccessAt: null,
      lastStatus: null,
      reason: firstPartyReason(entry, eventCount, failureCount, eventError),
    };
    const ga4 = snapshot(ga4Evidence, "GA4", ga4LoadError || syncLoadError, nowMs);
    const meta = snapshot(metaEvidence, "Meta", metaLoadError || syncLoadError, nowMs);

    const health = entry.enabled
      ? combineHealth([firstParty.health, ga4.health, meta.health])
      : "disabled";

    return {
      id: entry.id,
      family: entry.family,
      displayName: entry.displayName,
      shortLabel: entry.shortLabel,
      routePath: entry.routePath,
      enabled: entry.enabled,
      notes: entry.notes,
      detailPath: entry.detailPath,
      ingestPath: entry.ingestPath,
      health,
      firstParty,
      ga4,
      meta,
      firstPartyEventCount: eventCount,
    };
  });

  const summary = emptySummary();
  for (const row of rows) {
    summary[row.health] += 1;
  }

  return {
    loadedAt: new Date(nowMs).toISOString(),
    rows,
    summary,
  };
}
