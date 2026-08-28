import { sequentialConversionPct } from "./funnelEventContract";

export const PET_FUNNEL_INTERNAL_EVENTS = [
  "landing_view",
  "pet_name_submitted",
  "photo_step_viewed",
  "photo_upload_completed",
  "order_review_viewed",
  "initiate_checkout",
  "purchase",
  "photo_upload_started",
  "pet_details_completed",
  "checkout_error",
] as const;

export type PetFunnelInternalEvent = (typeof PET_FUNNEL_INTERNAL_EVENTS)[number];

export const PET_FUNNEL_PRIMARY_STEPS = [
  "landing_view",
  "pet_name_submitted",
  "photo_upload_completed",
  "order_review_viewed",
  "initiate_checkout",
  "purchase",
] as const;

export const PET_FUNNEL_STEP_LABELS: Record<(typeof PET_FUNNEL_PRIMARY_STEPS)[number], string> = {
  landing_view: "First-party Landing Sessions",
  pet_name_submitted: "Pet Name Submitted",
  photo_upload_completed: "Photo Selected",
  order_review_viewed: "Order Review Viewed",
  initiate_checkout: "Initiate Checkout",
  purchase: "Purchase",
};

export type FunnelStepCounts = Record<(typeof PET_FUNNEL_PRIMARY_STEPS)[number], number>;

export type FunnelStepRow = {
  eventName: (typeof PET_FUNNEL_PRIMARY_STEPS)[number];
  label: string;
  sessions: number;
  fromPreviousPct: number | null;
  fromLandingPct: number | null;
  dropFromPreviousPct: number | null;
};

export type AttributionBreakdownRow = {
  campaign: string;
  adSet: string;
  ad: string;
  campaignId?: string | null;
  adsetId?: string | null;
  adId?: string | null;
  sourceGroup: "meta" | "other" | "unattributed";
  lpv: number;
  name: number;
  upload: number;
  review: number;
  checkout: number;
  purchase: number;
  revenueCents: number;
  cvr: number | null;
  spendCents: number | null;
  cpaCents: number | null;
  roas: number | null;
  impressions?: number | null;
  linkClicks?: number | null;
  cpcCentsComputed?: number | null;
  ctrPct?: number | null;
  /** @deprecated use spendCents */
  spend: number | null;
  /** @deprecated use cpaCents */
  cpa: number | null;
};

export type SpeciesBreakdownRow = {
  species: "dog" | "cat" | "other";
  lpv: number;
  checkout: number;
  purchase: number;
  cvr: number | null;
  revenueCents: number;
};

export type DeviceBreakdownRow = {
  deviceType: string;
  lpv: number;
  checkout: number;
  purchase: number;
};

export type FunnelRecentEvent = {
  createdAt: string;
  eventName: string;
  species: string | null;
  sessionShort: string;
  amountCents: number | null;
};

export type PetFunnelAnalyticsReport = {
  from: string;
  to: string;
  firstEventAt: string | null;
  firstPartyTrackingStartedAt: string | null;
  rangeMode: "first_party" | "historical" | "mixed";
  steps: FunnelStepRow[];
  previousSteps: FunnelStepRow[];
  hybridStages: import("./funnelHybrid").HybridStageValue[];
  hybridKpis: import("./funnelHybrid").HybridKpis;
  trackingHealth?: { failedWrites: number | null; latestFirstPartyAt: string | null };
  daily: import("./funnelHybrid").DailyPerfRow[];
  metaAds: import("./funnelHybrid").MetaAdRow[];
  sync: {
    metaConfigured: boolean | null;
    ga4Configured: boolean | null;
    metaLastSyncedAt: string | null;
    ga4LastSyncedAt: string | null;
    metaMissing: string[];
    ga4Missing: string[];
  };
  kpis: {
    landing: number;
    names: number;
    uploads: number;
    reviews: number;
    checkouts: number;
    purchases: number;
    revenueCents: number;
    previousRevenueCents: number;
    landingToPurchase: number | null;
    checkoutToPurchase: number | null;
    revenuePerLpvCents: number | null;
    revenuePerCheckoutCents: number | null;
    averageOrderValueCents: number | null;
  };
  campaigns: AttributionBreakdownRow[];
  ads: AttributionBreakdownRow[];
  species: SpeciesBreakdownRow[];
  devices: DeviceBreakdownRow[];
  recent: FunnelRecentEvent[];
  warnings: string[];
  biggestDrop: { from: string; to: string; dropPct: number } | null;
  spendAvailable: boolean;
  datasetId?: "v1" | "v2" | "v3";
  datasetConfigured?: boolean;
  metaCampaignConfigured?: boolean;
  campaignLabel?: string;
  measurementReliableFrom?: string | null;
  /** Independent distinct-session totals (not landing-cohort chained). */
  rawSteps?: FunnelStepRow[];
  /** Name → photo_step_viewed → started → completed diagnostic path. */
  photoPathSteps?: Array<{
    eventName: string;
    sessions: number;
    fromPreviousPct: number | null;
  }>;
  /** Cat V3 seven-step funnel including checkout_viewed. */
  v3ExtendedSteps?: Array<{
    eventName: string;
    label: string;
    sessions: number;
    fromPreviousPct: number | null;
    fromLandingPct: number | null;
    dropFromPreviousPct: number | null;
  }>;
  v3Creatives?: Array<{
    creativeId: string;
    lpv: number;
    checkoutViewed: number;
    checkout: number;
    purchase: number;
    revenueCents: number;
  }>;
  v3Trusted?: {
    measurementReliableFrom: string | null;
    priceCohortFrom: string | null;
    priceCohortCertifiedAt: string | null;
    priceDeployReferenceAt: string | null;
    priceCohortCents: number;
    viewMode: string;
    includeInternalTests: boolean;
    trafficBreakdown: Array<{ traffic_class: string; landing_sessions: number }>;
    productionSequential: {
      landing: number;
      uploads: number;
      previews: number;
      offers: number;
      checkout_sessions: number;
      checkout_clicks: number;
    };
    paidMetaLandings: number;
    rawTotals: { landing: number; checkout_clicks: number; checkout_sessions: number };
    purchases: number;
    revenueCents: number;
  };
  v3SessionDrilldown?: Array<{
    session_short: string;
    landing_at: string;
    traffic_class: string | null;
    is_test: boolean;
    stripe_checkout_created: boolean;
    checkout_button_click: boolean;
    paid_purchase: boolean;
    events: Array<{ event_name: string; created_at: string }>;
  }>;
};

export function emptyStepCounts(): FunnelStepCounts {
  return {
    landing_view: 0,
    pet_name_submitted: 0,
    photo_upload_completed: 0,
    order_review_viewed: 0,
    initiate_checkout: 0,
    purchase: 0,
  };
}

export function ratio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return numerator / denominator;
}

export function percent(numerator: number, denominator: number): number | null {
  const value = ratio(numerator, denominator);
  return value == null ? null : value * 100;
}

export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function formatPct(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatUsdFromCents(cents: number): string {
  const amount = (Number(cents) || 0) / 100;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function formatSignedPct(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = value.toFixed(0);
  return `${value > 0 ? "↑" : value < 0 ? "↓" : "→"} ${Math.abs(Number(rounded))}%`;
}

export function buildFunnelSteps(counts: FunnelStepCounts): FunnelStepRow[] {
  const landing = counts.landing_view;
  return PET_FUNNEL_PRIMARY_STEPS.map((eventName, index) => {
    const sessions = counts[eventName];
    const previous = index === 0 ? null : counts[PET_FUNNEL_PRIMARY_STEPS[index - 1]];
    const fromPreviousPct = previous == null ? null : sequentialConversionPct(sessions, previous);
    return {
      eventName,
      label: PET_FUNNEL_STEP_LABELS[eventName],
      sessions,
      fromPreviousPct,
      fromLandingPct: percent(sessions, landing),
      dropFromPreviousPct:
        previous == null || previous <= 0
          ? null
          : percent(Math.max(previous - Math.min(sessions, previous), 0), previous),
    };
  });
}

export const FUNNEL_CONVERSION_LABELS = [
  { label: "Landing → Name Submitted", fromIndex: 0, toIndex: 1 },
  { label: "Name → Photo Selected", fromIndex: 1, toIndex: 2 },
  { label: "Photo → Order Review", fromIndex: 2, toIndex: 3 },
  { label: "Order Review → Checkout", fromIndex: 3, toIndex: 4 },
  { label: "Checkout → Purchase", fromIndex: 4, toIndex: 5 },
] as const;

export function stepConversionRates(
  stages: Array<{ fromPreviousPct: number | null }>,
): Array<{ label: string; pct: number | null }> {
  return FUNNEL_CONVERSION_LABELS.map((item) => ({
    label: item.label,
    pct: stages[item.toIndex]?.fromPreviousPct ?? null,
  }));
}

export function ofPreviousLabel(
  to: number | null | undefined,
  from: number | null | undefined,
  ofLabel: string,
): string | null {
  if (to == null || from == null) return null;
  const rate = sequentialConversionPct(to, from);
  return rate == null ? null : `${formatPct(rate)} of ${ofLabel}`;
}

export function biggestFunnelDrop(steps: FunnelStepRow[]): { from: string; to: string; dropPct: number } | null {
  let best: { from: string; to: string; dropPct: number; lost: number } | null = null;
  for (let i = 1; i < steps.length; i++) {
    const drop = steps[i].dropFromPreviousPct;
    if (drop == null || !Number.isFinite(drop)) continue;
    const lost = Math.max(steps[i - 1].sessions - steps[i].sessions, 0);
    if (!best || lost > best.lost || (lost === best.lost && drop > best.dropPct)) {
      best = {
        from: steps[i - 1].label,
        to: steps[i].label,
        dropPct: drop,
        lost,
      };
    }
  }
  return best ? { from: best.from, to: best.to, dropPct: best.dropPct } : null;
}

export function isMetaSource(input: {
  utmSource?: string | null;
  campaignId?: string | null;
}): boolean {
  if (input.campaignId) return true;
  const source = String(input.utmSource || "").trim().toLowerCase();
  return ["facebook", "fb", "instagram", "ig", "an", "msg", "meta", "paid_social"].includes(source);
}

export function attributionFallbackLabel(input: {
  utmSource?: string | null;
  utmCampaign?: string | null;
  campaignId?: string | null;
}): { label: string; sourceGroup: "meta" | "other" | "unattributed" } {
  if (isMetaSource(input)) {
    return {
      label: input.utmCampaign || input.campaignId || "Meta campaign",
      sourceGroup: "meta",
    };
  }
  if (input.utmSource) {
    return {
      label: input.utmCampaign || input.utmSource,
      sourceGroup: "other",
    };
  }
  return { label: "Direct / Organic / Unknown", sourceGroup: "unattributed" };
}

export function funnelWarnings(input: {
  steps: FunnelStepRow[];
  firstEventAt: string | null;
  rangeMode?: "first_party" | "historical" | "mixed";
  metaConfigured?: boolean | null;
  ads?: Array<{ ad: string; lpv: number; upload: number; purchase: number }>;
}): string[] {
  const warnings: string[] = [];
  if (!input.firstEventAt) {
    warnings.push("First-party tracking has not recorded events yet — showing historical Meta/GA4/Stripe where available");
  } else if (input.rangeMode === "historical" || input.rangeMode === "mixed") {
    warnings.push("Range includes dates before first-party tracking — mid-funnel stages may be unavailable");
  }
  if (input.metaConfigured === false) {
    warnings.push("Meta historical sync not configured");
  }
  const landing = input.steps[0];
  const name = input.steps[1];
  const checkout = input.steps[4];
  const purchase = input.steps[5];
  if (landing && name && landing.sessions >= 10 && (name.fromPreviousPct ?? 100) <= 40) {
    warnings.push("High landing → name drop-off");
  }
  if (checkout && purchase && checkout.sessions >= 3 && purchase.sessions === 0) {
    warnings.push("Checkout started but no purchases");
  }
  const weakUpload = (input.ads || []).find((ad) => ad.lpv >= 20 && ad.upload / ad.lpv <= 0.2);
  if (weakUpload) {
    warnings.push("Low upload rate on attributed ads");
  }
  return warnings;
}

export function buildKpis(
  counts: FunnelStepCounts,
  revenueCents: number,
  previousRevenueCents: number,
): PetFunnelAnalyticsReport["kpis"] {
  return {
    landing: counts.landing_view,
    names: counts.pet_name_submitted,
    uploads: counts.photo_upload_completed,
    reviews: counts.order_review_viewed,
    checkouts: counts.initiate_checkout,
    purchases: counts.purchase,
    revenueCents,
    previousRevenueCents,
    landingToPurchase: percent(counts.purchase, counts.landing_view),
    checkoutToPurchase: percent(counts.purchase, counts.initiate_checkout),
    revenuePerLpvCents: ratio(revenueCents, counts.landing_view),
    revenuePerCheckoutCents: ratio(revenueCents, counts.initiate_checkout),
    averageOrderValueCents: ratio(revenueCents, counts.purchase),
  };
}

export type DatePreset = "today" | "yesterday" | "7d" | "14d" | "30d" | "custom";

function utcDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function rangeForPreset(
  preset: DatePreset,
  now = new Date(),
  custom?: { from: string; to: string },
): { from: Date; to: Date; previousFrom: Date; previousTo: Date } {
  const today = utcDayStart(now);
  const tomorrow = new Date(today.getTime() + 86400000);
  if (preset === "today") {
    return { from: today, to: tomorrow, previousFrom: new Date(today.getTime() - 86400000), previousTo: today };
  }
  if (preset === "yesterday") {
    const from = new Date(today.getTime() - 86400000);
    return { from, to: today, previousFrom: new Date(from.getTime() - 86400000), previousTo: from };
  }
  if (preset === "custom" && custom?.from && custom.to) {
    const from = utcDayStart(new Date(`${custom.from}T00:00:00.000Z`));
    const to = new Date(utcDayStart(new Date(`${custom.to}T00:00:00.000Z`)).getTime() + 86400000);
    const duration = Math.max(to.getTime() - from.getTime(), 86400000);
    return {
      from,
      to,
      previousFrom: new Date(from.getTime() - duration),
      previousTo: from,
    };
  }
  const days = preset === "14d" ? 14 : preset === "30d" ? 30 : 7;
  const from = new Date(tomorrow.getTime() - days * 86400000);
  return {
    from,
    to: tomorrow,
    previousFrom: new Date(from.getTime() - days * 86400000),
    previousTo: from,
  };
}

export function countsFromRows(
  rows: Array<{ event_name?: string; eventName?: string; sessions?: number; unique_sessions?: number }>,
): FunnelStepCounts {
  const counts = emptyStepCounts();
  for (const row of rows) {
    const name = (row.event_name || row.eventName) as keyof FunnelStepCounts;
    if (name in counts) {
      counts[name] = Number(row.sessions ?? row.unique_sessions ?? 0) || 0;
    }
  }
  return counts;
}
