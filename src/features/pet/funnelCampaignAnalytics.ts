/**
 * Campaign-scoped pet funnel analytics.
 * Canonical identifier is Meta campaign_id. Funnel variant is never inferred from name, path, species, or date.
 */

import { firstPartyConversionPct, trackingCoverageSignal } from "./funnelEventContract";
import { percent, ratio } from "./funnelDashboard";
import { safeCpaCents, safeCpcCents, safeCtrPct, safeRoas } from "./funnelHybrid";

export const FUNNEL_VARIANTS = ["v1", "v2_preview"] as const;
export type FunnelVariant = (typeof FUNNEL_VARIANTS)[number];

export const CAMPAIGN_VIEW_MODES = ["all", "campaign", "compare", "unattributed"] as const;
export type CampaignViewMode = (typeof CAMPAIGN_VIEW_MODES)[number];

export type CampaignAnalyticsConfig = {
  campaignId: string;
  displayName: string;
  funnelVariant: FunnelVariant | null;
  utmCampaignAliases: string[];
  measurementReliableFrom: string | null;
};

export type FirstPartyEventRow = {
  funnelSessionId: string;
  eventName: string;
  createdAt: string;
  campaignId?: string | null;
  adsetId?: string | null;
  adId?: string | null;
  utmCampaign?: string | null;
  species?: string | null;
  deviceType?: string | null;
  amountCents?: number | null;
  orderId?: string | null;
  isTest?: boolean;
  pathname?: string | null;
  referrerHost?: string | null;
};

export const V1_FUNNEL_STAGES = [
  { eventName: "landing_view", label: "Landing Sessions" },
  { eventName: "pet_name_submitted", label: "Names Submitted" },
  { eventName: "photo_upload_completed", label: "Photo Selected" },
  { eventName: "order_review_viewed", label: "Order Review" },
  { eventName: "initiate_checkout", label: "Checkout" },
  { eventName: "purchase", label: "Purchase" },
] as const;

export const V2_FUNNEL_STAGES = [
  { eventName: "v2_landing_view", label: "Landing" },
  { eventName: "v2_upload_started", label: "Upload Started" },
  { eventName: "v2_upload_completed", label: "Upload Completed" },
  { eventName: "v2_preview_generation_started", label: "Preview Generation Started" },
  { eventName: "v2_preview_generation_completed", label: "Preview Generation Completed" },
  { eventName: "v2_preview_viewed", label: "Preview Viewed" },
  { eventName: "v2_offer_viewed", label: "Offer Viewed" },
  { eventName: "v2_unlock_clicked", label: "Unlock Clicked" },
  { eventName: "v2_begin_checkout", label: "Begin Checkout" },
  { eventName: "v2_purchase", label: "Purchase" },
] as const;

export const V1_EVENT_NAMES = new Set(V1_FUNNEL_STAGES.map((s) => s.eventName));
export const V2_EVENT_NAMES = new Set(V2_FUNNEL_STAGES.map((s) => s.eventName));

export function isFunnelVariant(value: unknown): value is FunnelVariant {
  return value === "v1" || value === "v2_preview";
}

export function isCampaignViewMode(value: unknown): value is CampaignViewMode {
  return CAMPAIGN_VIEW_MODES.includes(value as CampaignViewMode);
}

function norm(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function normLower(value: unknown): string | null {
  const text = norm(value);
  return text ? text.toLowerCase() : null;
}

/** Highest confidence: campaign_id. Fallback: unique configured utm_campaign. Never pathname/species/date/referrer. */
export function resolveCampaignIdFromAttribution(
  input: { campaignId?: string | null; utmCampaign?: string | null },
  configs: CampaignAnalyticsConfig[],
): string | null {
  const campaignId = norm(input.campaignId);
  if (campaignId) return campaignId;

  const utm = normLower(input.utmCampaign);
  if (!utm) return null;

  const matches = configs.filter((config) =>
    config.utmCampaignAliases.some((alias) => normLower(alias) === utm),
  );
  if (matches.length === 1) return matches[0].campaignId;
  return null;
}

export function firstTouchAttribution(
  events: FirstPartyEventRow[],
): { campaignId: string | null; utmCampaign: string | null; adsetId: string | null; adId: string | null } {
  const ordered = [...events].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const first = (pick: (row: FirstPartyEventRow) => string | null | undefined) => {
    for (const row of ordered) {
      const value = norm(pick(row));
      if (value) return value;
    }
    return null;
  };
  return {
    campaignId: first((row) => row.campaignId),
    utmCampaign: first((row) => row.utmCampaign),
    adsetId: first((row) => row.adsetId),
    adId: first((row) => row.adId),
  };
}

export function resolveSessionCampaignId(events: FirstPartyEventRow[], configs: CampaignAnalyticsConfig[]): string | null {
  const touch = firstTouchAttribution(events);
  return resolveCampaignIdFromAttribution(touch, configs);
}

export function eventsBySession(events: FirstPartyEventRow[]): Map<string, FirstPartyEventRow[]> {
  const map = new Map<string, FirstPartyEventRow[]>();
  for (const event of events) {
    if (event.isTest) continue;
    const list = map.get(event.funnelSessionId) || [];
    list.push(event);
    map.set(event.funnelSessionId, list);
  }
  return map;
}

export function attributedSessionIds(
  events: FirstPartyEventRow[],
  configs: CampaignAnalyticsConfig[],
  campaignId: string,
): Set<string> {
  const target = norm(campaignId);
  const ids = new Set<string>();
  if (!target) return ids;
  for (const [sessionId, sessionEvents] of eventsBySession(events)) {
    if (resolveSessionCampaignId(sessionEvents, configs) === target) ids.add(sessionId);
  }
  return ids;
}

export function unattributedSessionIds(events: FirstPartyEventRow[], configs: CampaignAnalyticsConfig[]): Set<string> {
  const ids = new Set<string>();
  for (const [sessionId, sessionEvents] of eventsBySession(events)) {
    if (resolveSessionCampaignId(sessionEvents, configs) == null) ids.add(sessionId);
  }
  return ids;
}

export function filterEventsForCampaign(
  events: FirstPartyEventRow[],
  configs: CampaignAnalyticsConfig[],
  campaignId: string,
  adsetId?: string | null,
): FirstPartyEventRow[] {
  const sessions = attributedSessionIds(events, configs, campaignId);
  const adset = norm(adsetId);
  return events.filter((event) => {
    if (event.isTest) return false;
    if (!sessions.has(event.funnelSessionId)) return false;
    if (!adset) return true;
    const session = eventsBySession(events).get(event.funnelSessionId) || [];
    return firstTouchAttribution(session).adsetId === adset;
  });
}

export function filterUnattributedEvents(
  events: FirstPartyEventRow[],
  configs: CampaignAnalyticsConfig[],
): FirstPartyEventRow[] {
  const sessions = unattributedSessionIds(events, configs);
  return events.filter((event) => !event.isTest && sessions.has(event.funnelSessionId));
}

export type FunnelStageValue = {
  eventName: string;
  label: string;
  sessions: number;
  fromPreviousPct: number | null;
  fromLandingPct: number | null;
};

export function uniqueSessionsForEvent(events: FirstPartyEventRow[], eventName: string): number {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.isTest) continue;
    if (event.eventName === eventName) ids.add(event.funnelSessionId);
  }
  return ids.size;
}

export function countsFromNamedRows(
  rows: Array<{ event_name?: string; eventName?: string; unique_sessions?: number; sessions?: number }>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const name = String(row.event_name || row.eventName || "");
    if (!name) continue;
    counts[name] = Number(row.sessions ?? row.unique_sessions ?? 0) || 0;
  }
  return counts;
}

export function buildFunnelFromCounts(
  variant: FunnelVariant,
  counts: Record<string, number>,
): FunnelStageValue[] {
  const stages = variant === "v1" ? V1_FUNNEL_STAGES : V2_FUNNEL_STAGES;
  const landing = counts[stages[0].eventName] || 0;
  return stages.map((stage, index) => {
    const sessions = counts[stage.eventName] || 0;
    const previousName = index === 0 ? null : stages[index - 1].eventName;
    const previous = previousName ? counts[previousName] || 0 : null;
    return {
      eventName: stage.eventName,
      label: stage.label,
      sessions,
      fromPreviousPct: previous == null ? null : firstPartyConversionPct(sessions, previous),
      fromLandingPct: firstPartyConversionPct(sessions, landing),
    };
  });
}

export function buildVariantFunnel(
  variant: FunnelVariant,
  events: FirstPartyEventRow[],
): FunnelStageValue[] {
  const stages = variant === "v1" ? V1_FUNNEL_STAGES : V2_FUNNEL_STAGES;
  const counts: Record<string, number> = {};
  for (const stage of stages) {
    counts[stage.eventName] = uniqueSessionsForEvent(events, stage.eventName);
  }
  return buildFunnelFromCounts(variant, counts);
}

export type V2Kpis = {
  uploadRate: number | null;
  previewGenerationSuccessRate: number | null;
  previewGenerationFailureRate: number | null;
  landingToPreviewViewed: number | null;
  previewViewedToUnlock: number | null;
  unlockToCheckout: number | null;
  checkoutToPurchase: number | null;
  medianPreviewGenerationMs: number | null;
  p90PreviewGenerationMs: number | null;
};

export function buildV2Kpis(
  events: FirstPartyEventRow[],
  latencyMs?: number[] | null,
): V2Kpis {
  const landing = uniqueSessionsForEvent(events, "v2_landing_view");
  const uploadCompleted = uniqueSessionsForEvent(events, "v2_upload_completed");
  const genStarted = uniqueSessionsForEvent(events, "v2_preview_generation_started");
  const genCompleted = uniqueSessionsForEvent(events, "v2_preview_generation_completed");
  const genFailed = uniqueSessionsForEvent(events, "v2_preview_generation_failed");
  const previewViewed = uniqueSessionsForEvent(events, "v2_preview_viewed");
  const unlock = uniqueSessionsForEvent(events, "v2_unlock_clicked");
  const checkout = uniqueSessionsForEvent(events, "v2_begin_checkout");
  const purchase = uniqueSessionsForEvent(events, "v2_purchase");
  const latencies = (latencyMs || []).filter((n) => Number.isFinite(n) && n >= 0).sort((a, b) => a - b);
  return {
    uploadRate: firstPartyConversionPct(uploadCompleted, landing),
    previewGenerationSuccessRate: firstPartyConversionPct(genCompleted, genStarted),
    previewGenerationFailureRate: firstPartyConversionPct(genFailed, genStarted),
    landingToPreviewViewed: firstPartyConversionPct(previewViewed, landing),
    previewViewedToUnlock: firstPartyConversionPct(unlock, previewViewed),
    unlockToCheckout: firstPartyConversionPct(checkout, unlock),
    checkoutToPurchase: firstPartyConversionPct(purchase, checkout),
    medianPreviewGenerationMs: percentile(latencies, 0.5),
    p90PreviewGenerationMs: percentile(latencies, 0.9),
  };
}

export function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length || !Number.isFinite(p) || p < 0 || p > 1) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx] ?? null;
}

export type CampaignCostMetrics = {
  costPerFpLandingCents: number | null;
  costPerFirstActionCents: number | null;
  costPerCheckoutCents: number | null;
  cpaCents: number | null;
  roas: number | null;
  attributionCoverageWarning: boolean;
};

export function buildCampaignCostMetrics(input: {
  spendCents: number | null;
  fpLanding: number;
  firstAction: number;
  checkout: number;
  purchase: number;
  revenueCents: number;
  metaLpv: number | null;
}): CampaignCostMetrics {
  const spend = input.spendCents;
  const coverage = trackingCoverageSignal(input.fpLanding, input.metaLpv);
  return {
    costPerFpLandingCents: spend == null || input.fpLanding <= 0 ? null : Math.round(spend / input.fpLanding),
    costPerFirstActionCents: spend == null || input.firstAction <= 0 ? null : Math.round(spend / input.firstAction),
    costPerCheckoutCents: spend == null || input.checkout <= 0 ? null : Math.round(spend / input.checkout),
    cpaCents: spend == null ? null : safeCpaCents(spend, input.purchase),
    roas: spend == null ? null : safeRoas(input.revenueCents, spend),
    attributionCoverageWarning: coverage.unhealthy || (coverage.ratio != null && coverage.ratio < 0.5),
  };
}

export function firstActionForVariant(variant: FunnelVariant | null): { eventName: string; label: string } | null {
  if (variant === "v1") return { eventName: "pet_name_submitted", label: "Name Submitted" };
  if (variant === "v2_preview") return { eventName: "v2_upload_completed", label: "Upload Completed" };
  return null;
}

export function landingEventForVariant(variant: FunnelVariant | null): string | null {
  if (variant === "v1") return "landing_view";
  if (variant === "v2_preview") return "v2_landing_view";
  return null;
}

export function checkoutEventForVariant(variant: FunnelVariant | null): string | null {
  if (variant === "v1") return "initiate_checkout";
  if (variant === "v2_preview") return "v2_begin_checkout";
  return null;
}

export function purchaseEventForVariant(variant: FunnelVariant | null): string | null {
  if (variant === "v1") return "purchase";
  if (variant === "v2_preview") return "v2_purchase";
  return null;
}

export type CampaignScopedCounts = {
  campaignId: string;
  displayName: string;
  funnelVariant: FunnelVariant | null;
  spendCents: number | null;
  impressions: number;
  reach: number;
  linkClicks: number;
  metaLpv: number;
  metaInitiateCheckouts?: number;
  fpLanding: number;
  firstAction: number;
  firstActionLabel: string;
  firstActionEvent: string;
  orderReview?: number;
  previewViewed?: number;
  unlockClicked?: number;
  checkout: number;
  purchase: number;
  revenueCents: number;
  measurementReliableFrom: string | null;
};

export type CompareRow = {
  key: string;
  label: string;
  group: "acquisition" | "engagement" | "intent" | "commercial" | "normalized";
  values: Array<{ campaignId: string; display: string; raw: number | null }>;
  incompatible?: boolean;
};

function money(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function num(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return String(value);
}

function pct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

export function buildCompareRows(campaigns: CampaignScopedCounts[]): CompareRow[] {
  const values = (
    pick: (c: CampaignScopedCounts) => number | null,
    format: (n: number | null) => string,
  ) => campaigns.map((c) => ({ campaignId: c.campaignId, display: format(pick(c)), raw: pick(c) }));

  const rows: CompareRow[] = [
    { key: "spend", label: "Spend", group: "acquisition", values: values((c) => c.spendCents, money) },
    { key: "meta_lpv", label: "Meta LPV", group: "acquisition", values: values((c) => c.metaLpv, num) },
    { key: "fp_landing", label: "First-party landing sessions", group: "acquisition", values: values((c) => c.fpLanding, num) },
  ];

  rows.push({
    key: "first_action",
    label: "Landing → First action",
    group: "engagement",
    values: campaigns.map((c) => {
      const rate = firstPartyConversionPct(c.firstAction, c.fpLanding);
      return {
        campaignId: c.campaignId,
        display: `${c.firstAction} ${c.firstActionLabel} (${pct(rate)})`,
        raw: rate,
      };
    }),
  });

  for (const campaign of campaigns) {
    if (campaign.funnelVariant === "v1") {
      rows.push({
        key: `intent_v1_${campaign.campaignId}`,
        label: `${campaign.displayName}: Order Review`,
        group: "intent",
        values: campaigns.map((c) => ({
          campaignId: c.campaignId,
          display: c.campaignId === campaign.campaignId ? num(c.orderReview ?? 0) : "—",
          raw: c.campaignId === campaign.campaignId ? c.orderReview ?? 0 : null,
        })),
        incompatible: true,
      });
    }
    if (campaign.funnelVariant === "v2_preview") {
      rows.push({
        key: `intent_preview_${campaign.campaignId}`,
        label: `${campaign.displayName}: Preview Viewed`,
        group: "intent",
        values: campaigns.map((c) => ({
          campaignId: c.campaignId,
          display: c.campaignId === campaign.campaignId ? num(c.previewViewed ?? 0) : "—",
          raw: c.campaignId === campaign.campaignId ? c.previewViewed ?? 0 : null,
        })),
        incompatible: true,
      });
      rows.push({
        key: `intent_unlock_${campaign.campaignId}`,
        label: `${campaign.displayName}: Unlock Clicked`,
        group: "intent",
        values: campaigns.map((c) => ({
          campaignId: c.campaignId,
          display: c.campaignId === campaign.campaignId ? num(c.unlockClicked ?? 0) : "—",
          raw: c.campaignId === campaign.campaignId ? c.unlockClicked ?? 0 : null,
        })),
        incompatible: true,
      });
    }
  }

  rows.push(
    { key: "checkout", label: "Checkout", group: "commercial", values: values((c) => c.checkout, num) },
    { key: "purchase", label: "Purchase", group: "commercial", values: values((c) => c.purchase, num) },
    { key: "revenue", label: "Revenue", group: "commercial", values: values((c) => c.revenueCents, money) },
    {
      key: "cpa",
      label: "CPA",
      group: "commercial",
      values: values((c) => (c.spendCents == null ? null : safeCpaCents(c.spendCents, c.purchase)), money),
    },
    {
      key: "roas",
      label: "ROAS",
      group: "commercial",
      values: values((c) => (c.spendCents == null ? null : safeRoas(c.revenueCents, c.spendCents)), (n) =>
        n == null ? "—" : `${n.toFixed(2)}x`,
      ),
    },
    {
      key: "landing_checkout",
      label: "Landing → Checkout",
      group: "normalized",
      values: values((c) => firstPartyConversionPct(c.checkout, c.fpLanding), pct),
    },
    {
      key: "landing_purchase",
      label: "Landing → Purchase",
      group: "normalized",
      values: values((c) => firstPartyConversionPct(c.purchase, c.fpLanding), pct),
    },
  );

  return rows;
}

export function compareUsesSharedFirstActionRow(rows: CompareRow[]): boolean {
  return rows.some((row) => row.key === "name_and_upload_mixed");
}

export function measurementReliability(input: {
  rangeFromIso: string;
  rangeToIso: string;
  measurementReliableFrom: string | null;
}): { crosses: boolean; label: string | null } {
  const fromTs = input.measurementReliableFrom;
  if (!fromTs) return { crosses: false, label: null };
  const start = new Date(fromTs).getTime();
  const from = new Date(input.rangeFromIso).getTime();
  const to = new Date(input.rangeToIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(from) || !Number.isFinite(to)) {
    return { crosses: false, label: null };
  }
  if (from >= start) return { crosses: false, label: null };
  return {
    crosses: true,
    label: `First-party measurement is reliable only from ${new Date(fromTs).toISOString()}.`,
  };
}

export type CatalogCampaign = CampaignAnalyticsConfig & {
  metaName?: string | null;
};

export function displayCampaignName(config: CatalogCampaign): string {
  return norm(config.displayName) || norm(config.metaName) || config.campaignId;
}

export function buildSelectorOptions(catalog: CatalogCampaign[]): Array<{
  id: string;
  mode: CampaignViewMode;
  campaignId: string | null;
  label: string;
}> {
  return [
    { id: "all", mode: "all", campaignId: null, label: "All" },
    ...catalog.map((campaign) => ({
      id: campaign.campaignId,
      mode: "campaign" as const,
      campaignId: campaign.campaignId,
      label: displayCampaignName(campaign),
    })),
    { id: "compare", mode: "compare", campaignId: null, label: "Compare" },
    { id: "unattributed", mode: "unattributed", campaignId: null, label: "Unattributed" },
  ];
}

export function metaFilterUsesCampaignId(sql: string): boolean {
  return /m\.campaign_id\s*=\s*p_campaign_id/.test(sql) || /resolved_campaign_id\s*=\s*p_campaign_id/.test(sql);
}

export function filterMetaRowsByCampaignId<T extends { campaign_id?: string; campaignId?: string }>(
  rows: T[],
  campaignId: string,
): T[] {
  const target = norm(campaignId);
  if (!target) return [];
  return rows.filter((row) => norm(row.campaign_id || row.campaignId) === target);
}

export function unattributedShare(unattributedLandings: number, totalLandings: number): number | null {
  return percent(unattributedLandings, totalLandings);
}

export function stageConversionLabel(fromLabel: string, toLabel: string, pctValue: number | null): string {
  return `${fromLabel} → ${toLabel}: ${pctValue == null ? "—" : `${pctValue.toFixed(0)}%`}`;
}

export function funnelVariantNotice(variant: FunnelVariant | null): string | null {
  if (variant) return null;
  return "Funnel variant not configured";
}

export type CampaignSummaryRpc = {
  campaign_id?: string;
  display_name?: string;
  funnel_variant?: string | null;
  spend_cents?: number;
  impressions?: number;
  reach?: number;
  link_clicks?: number;
  meta_lpv?: number;
  v1_landing?: number;
  v1_name?: number;
  v1_upload?: number;
  v1_review?: number;
  v1_checkout?: number;
  v1_purchase?: number;
  v1_revenue_cents?: number;
  v2_landing?: number;
  v2_upload_completed?: number;
  v2_preview_viewed?: number;
  v2_unlock_clicked?: number;
  v2_checkout?: number;
  v2_purchase?: number;
  v2_revenue_cents?: number;
  stripe_purchases?: number;
  stripe_revenue_cents?: number;
  stripe_checkouts?: number;
  measurement_reliable_from?: string | null;
};

export function scopedCountsFromSummary(row: CampaignSummaryRpc): CampaignScopedCounts {
  const variant = isFunnelVariant(row.funnel_variant) ? row.funnel_variant : null;
  const first = firstActionForVariant(variant);
  const fpLanding = variant === "v2_preview" ? Number(row.v2_landing || 0) : variant === "v1" ? Number(row.v1_landing || 0) : 0;
  const firstAction =
    variant === "v2_preview" ? Number(row.v2_upload_completed || 0) : variant === "v1" ? Number(row.v1_name || 0) : 0;
  const checkout =
    variant === "v2_preview"
      ? Number(row.v2_checkout || 0)
      : variant === "v1"
        ? Number(row.stripe_checkouts || row.v1_checkout || 0)
        : 0;
  const purchase =
    variant === "v2_preview"
      ? Number(row.v2_purchase || 0)
      : variant === "v1"
        ? Number(row.stripe_purchases || row.v1_purchase || 0)
        : 0;
  const revenueCents =
    variant === "v2_preview"
      ? Number(row.v2_revenue_cents || 0)
      : variant === "v1"
        ? Number(row.stripe_revenue_cents || row.v1_revenue_cents || 0)
        : 0;
  return {
    campaignId: String(row.campaign_id || ""),
    displayName: String(row.display_name || row.campaign_id || "Campaign"),
    funnelVariant: variant,
    spendCents: row.spend_cents == null ? null : Number(row.spend_cents) || 0,
    impressions: Number(row.impressions || 0),
    reach: Number(row.reach || 0),
    linkClicks: Number(row.link_clicks || 0),
    metaLpv: Number(row.meta_lpv || 0),
    fpLanding,
    firstAction,
    firstActionLabel: first?.label || "First action",
    firstActionEvent: first?.eventName || "",
    orderReview: Number(row.v1_review || 0),
    previewViewed: Number(row.v2_preview_viewed || 0),
    unlockClicked: Number(row.v2_unlock_clicked || 0),
    checkout,
    purchase,
    revenueCents,
    measurementReliableFrom: row.measurement_reliable_from ? String(row.measurement_reliable_from) : null,
  };
}

export { firstPartyConversionPct, trackingCoverageSignal, percent, ratio, safeCpcCents, safeCtrPct, safeCpaCents, safeRoas };
