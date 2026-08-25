/**
 * Pure hybrid funnel merge / spend math — browser-safe, no secrets.
 */

import {
  PET_FUNNEL_PRIMARY_STEPS,
  PET_FUNNEL_STEP_LABELS,
  buildFunnelSteps,
  emptyStepCounts,
  percent,
  ratio,
  type FunnelStepCounts,
  type FunnelStepRow,
} from "./funnelDashboard";
import { sequentialConversionPct } from "./funnelEventContract";

export type DataProvenance =
  | "first_party"
  | "backend_truth"
  | "meta"
  | "ga4"
  | "stripe_verified"
  | "historical"
  | "historical_unavailable";

export type HybridRangeMode = "first_party" | "historical" | "mixed";

export type HybridStageValue = {
  eventName: (typeof PET_FUNNEL_PRIMARY_STEPS)[number];
  label: string;
  value: number | null;
  source: DataProvenance;
  sourceLabel: string;
  fromPreviousPct: number | null;
  fromLandingPct: number | null;
};

export type HybridKpis = {
  spendCents: number | null;
  lpv: number | null;
  lpvSource: DataProvenance;
  cpcCents: number | null;
  ctrPct: number | null;
  names: number | null;
  namesSource: DataProvenance;
  uploads: number | null;
  uploadsSource: DataProvenance;
  reviews: number | null;
  reviewsSource: DataProvenance;
  checkouts: number | null;
  checkoutsSource: DataProvenance;
  purchases: number;
  purchasesSource: DataProvenance;
  revenueCents: number;
  revenueSource: DataProvenance;
  costPerCheckoutCents: number | null;
  cpaCents: number | null;
  roas: number | null;
  landingToPurchase: number | null;
  metaLpv: number | null;
  firstPartyLandings: number;
  metaAttributedPurchases: number | null;
  metaPurchaseValueCents: number | null;
  freeDiscountOrders: number;
};

export type MetaAdRow = {
  campaignId: string;
  campaignName: string;
  adsetId: string;
  adsetName: string;
  adId: string;
  adName: string;
  spendCents: number;
  impressions: number;
  linkClicks: number;
  lpv: number;
  cpcCents: number | null;
  ctrPct: number | null;
  firstPartyUploads: number | null;
  checkout: number;
  purchase: number;
  revenueCents: number;
  cpaCents: number | null;
  roas: number | null;
};

export type DailyPerfRow = {
  date: string;
  spendCents: number | null;
  lpv: number | null;
  checkout: number | null;
  purchases: number | null;
  revenueCents: number | null;
  roas: number | null;
};

export function safeRoas(purchaseValueCents: number, spendCents: number): number | null {
  if (!Number.isFinite(purchaseValueCents) || !Number.isFinite(spendCents) || spendCents <= 0) return null;
  return purchaseValueCents / spendCents;
}

export function safeCpaCents(spendCents: number, purchases: number): number | null {
  if (!Number.isFinite(spendCents) || !Number.isFinite(purchases) || purchases <= 0 || spendCents < 0) return null;
  return Math.round(spendCents / purchases);
}

export type PetOrderAnalyticsClass = "paid" | "free" | "test";
export type PetCheckoutAnalyticsClass = "customer" | "test" | "promo" | "internal";

const RESERVED_TEST_EMAIL_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "invalid",
  "localhost",
]);

export function classifyPetOrderForAnalytics(order: {
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  chargedAmountCents?: number | null;
  amountCents?: number | null;
  discountPercent?: number | null;
  stripePaymentStatus?: string | null;
}): PetOrderAnalyticsClass {
  const session = String(order.stripeCheckoutSessionId || "");
  const intent = String(order.stripePaymentIntentId || "");
  const status = String(order.stripePaymentStatus || "");
  const discount = Number(order.discountPercent) || 0;
  const charged = order.chargedAmountCents;
  const amount = Number(order.amountCents) || 0;
  if (session.startsWith("cs_test") || intent.startsWith("pi_test")) return "test";
  const recognized = charged == null ? amount : Number(charged) || 0;
  if (discount >= 100 || session.startsWith("promo:") || status === "no_payment_required" || status === "not_required" || recognized <= 0) {
    return "free";
  }
  return "paid";
}

export function classifyPetCheckoutForAnalytics(input: {
  stripeSessionId?: string | null;
  emailNormalized?: string | null;
  isAdminEmail?: boolean;
  discountPercent?: number | null;
  stripePaymentStatus?: string | null;
}): PetCheckoutAnalyticsClass {
  const session = String(input.stripeSessionId || "");
  const email = String(input.emailNormalized || "").toLowerCase().trim();
  const domain = email.includes("@") ? email.split("@").pop() || "" : "";
  const status = String(input.stripePaymentStatus || "");
  const discount = Number(input.discountPercent) || 0;
  if (session.startsWith("cs_test")) return "test";
  if (RESERVED_TEST_EMAIL_DOMAINS.has(domain)) return "test";
  if (session.startsWith("promo:") || discount >= 100 || status === "no_payment_required" || status === "not_required") {
    return "promo";
  }
  if (input.isAdminEmail) return "internal";
  if (session.startsWith("cs_live")) return "customer";
  return "test";
}

export function safeCpcCents(spendCents: number, clicks: number): number | null {
  if (!Number.isFinite(spendCents) || !Number.isFinite(clicks) || clicks <= 0 || spendCents < 0) return null;
  return Math.round(spendCents / clicks);
}

export function safeCtrPct(clicks: number, impressions: number): number | null {
  return percent(clicks, impressions);
}

export function classifyRangeMode(fromIso: string, toIso: string, firstPartyStartedAt: string | null): HybridRangeMode {
  if (!firstPartyStartedAt) return "historical";
  const start = new Date(firstPartyStartedAt).getTime();
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(from) || !Number.isFinite(to)) return "historical";
  if (from >= start) return "first_party";
  if (to <= start) return "historical";
  return "mixed";
}

function sourceLabel(source: DataProvenance): string {
  switch (source) {
    case "first_party":
      return "First-party";
    case "backend_truth":
      return "Backend";
    case "meta":
      return "Meta";
    case "ga4":
      return "GA4";
    case "stripe_verified":
      return "Stripe verified";
    case "historical":
      return "Historical";
    case "historical_unavailable":
      return "Historical detail unavailable";
  }
}

export function buildHybridStages(input: {
  mode: HybridRangeMode;
  firstPartyCounts: FunnelStepCounts;
  backendCheckouts: number;
  backendPurchases: number;
  meta: {
    landingPageViews: number;
    initiateCheckouts: number;
    purchases: number;
    petNameSubmitted: number | null;
    photoUploadCompleted: number | null;
    orderReviewViewed: number | null;
  };
  ga4: {
    landingViews: number;
    petNameSubmitted: number | null;
    photoUploadCompleted: number | null;
    orderReviewViewed: number | null;
    beginCheckouts: number;
  };
}): HybridStageValue[] {
  const { mode, firstPartyCounts, backendCheckouts, backendPurchases, meta, ga4 } = input;

  const stage = (
    eventName: (typeof PET_FUNNEL_PRIMARY_STEPS)[number],
    value: number | null,
    source: DataProvenance,
  ): Omit<HybridStageValue, "fromPreviousPct" | "fromLandingPct"> => ({
    eventName,
    label: PET_FUNNEL_STEP_LABELS[eventName],
    value,
    source,
    sourceLabel: sourceLabel(source),
  });

  let stages: Array<Omit<HybridStageValue, "fromPreviousPct" | "fromLandingPct">>;

  void mode;
  void meta;
  void ga4;
  // First-party mid-funnel conversion never uses Meta LPV or GA4 as the landing denominator.
  stages = [
    stage("landing_view", firstPartyCounts.landing_view, "first_party"),
    stage("pet_name_submitted", firstPartyCounts.pet_name_submitted, "first_party"),
    stage("photo_upload_completed", firstPartyCounts.photo_upload_completed, "first_party"),
    stage("order_review_viewed", firstPartyCounts.order_review_viewed, "first_party"),
    stage("initiate_checkout", backendCheckouts, "backend_truth"),
    stage("purchase", backendPurchases, "stripe_verified"),
  ];

  const landingValue = stages[0]?.value;
  return stages.map((s, index) => {
    const previous = index === 0 ? null : stages[index - 1]?.value;
    const fromPreviousPct =
      previous == null || s.value == null || previous == null
        ? null
        : sequentialConversionPct(s.value, previous);
    const fromLandingPct =
      landingValue == null || s.value == null ? null : percent(s.value, landingValue);
    return { ...s, fromPreviousPct, fromLandingPct };
  });
}

export function biggestHybridDrop(
  stages: HybridStageValue[],
): { from: string; to: string; dropPct: number } | null {
  let best: { from: string; to: string; dropPct: number; lost: number } | null = null;
  for (let i = 1; i < stages.length; i++) {
    const prev = stages[i - 1];
    const cur = stages[i];
    if (prev.value == null || cur.value == null || prev.value <= 0) continue;
    const dropPct = percent(Math.max(prev.value - cur.value, 0), prev.value);
    if (dropPct == null) continue;
    const lost = Math.max(prev.value - cur.value, 0);
    if (!best || lost > best.lost || (lost === best.lost && dropPct > best.dropPct)) {
      best = { from: prev.label, to: cur.label, dropPct, lost };
    }
  }
  return best ? { from: best.from, to: best.to, dropPct: best.dropPct } : null;
}

export function buildHybridKpis(input: {
  stages: HybridStageValue[];
  spendCents: number | null;
  impressions: number;
  linkClicks: number;
  revenueCents: number;
  metaLpv?: number | null;
  metaPurchaseValueCents: number | null;
  metaAttributedPurchases: number | null;
  freeDiscountOrders?: number;
}): HybridKpis {
  const byName = Object.fromEntries(input.stages.map((s) => [s.eventName, s])) as Record<
    (typeof PET_FUNNEL_PRIMARY_STEPS)[number],
    HybridStageValue
  >;
  const purchases = byName.purchase.value ?? 0;
  const spend = input.spendCents;
  const checkouts = byName.initiate_checkout.value;
  const firstPartyLandings = byName.landing_view.value ?? 0;
  const metaLpv = input.metaLpv ?? null;
  // Business ROAS uses Stripe revenue / Meta spend. Ad-table ROAS uses Meta purchase value.
  const businessRoas = spend == null ? null : safeRoas(input.revenueCents, spend);
  return {
    spendCents: spend,
    lpv: metaLpv,
    lpvSource: "meta",
    cpcCents: spend == null ? null : safeCpcCents(spend, input.linkClicks),
    ctrPct: safeCtrPct(input.linkClicks, input.impressions),
    names: byName.pet_name_submitted.value,
    namesSource: byName.pet_name_submitted.source,
    uploads: byName.photo_upload_completed.value,
    uploadsSource: byName.photo_upload_completed.source,
    reviews: byName.order_review_viewed.value,
    reviewsSource: byName.order_review_viewed.source,
    checkouts,
    checkoutsSource: byName.initiate_checkout.source,
    purchases,
    purchasesSource: byName.purchase.source,
    revenueCents: input.revenueCents,
    revenueSource: "stripe_verified",
    costPerCheckoutCents: spend == null || checkouts == null || checkouts <= 0 ? null : Math.round(spend / checkouts),
    cpaCents: spend == null ? null : safeCpaCents(spend, purchases),
    roas: businessRoas,
    landingToPurchase: percent(purchases, firstPartyLandings),
    metaLpv,
    firstPartyLandings,
    metaAttributedPurchases: input.metaAttributedPurchases,
    metaPurchaseValueCents: input.metaPurchaseValueCents,
    freeDiscountOrders: Math.max(0, Math.round(Number(input.freeDiscountOrders) || 0)),
  };
}

export function mergeMetaAdRows(
  metaAds: Array<{
    campaign_id?: string;
    campaign_name?: string;
    adset_id?: string;
    adset_name?: string;
    ad_id?: string;
    ad_name?: string;
    spend_cents?: number;
    impressions?: number;
    link_clicks?: number;
    landing_page_views?: number;
    initiate_checkouts?: number;
    purchases?: number;
    purchase_value_cents?: number;
  }>,
  firstPartyAds: Array<{
    ad_id?: string | null;
    ad?: string;
    upload?: number;
    upload_count?: number;
  }>,
): MetaAdRow[] {
  const uploadByAdId = new Map<string, number>();
  for (const row of firstPartyAds) {
    const id = String(row.ad_id || "").trim();
    if (!id) continue;
    uploadByAdId.set(id, Number(row.upload ?? row.upload_count ?? 0) || 0);
  }

  return metaAds.map((row) => {
    const spendCents = Number(row.spend_cents) || 0;
    const impressions = Number(row.impressions) || 0;
    const linkClicks = Number(row.link_clicks) || 0;
    const purchase = Number(row.purchases) || 0;
    const revenueCents = Number(row.purchase_value_cents) || 0;
    const adId = String(row.ad_id || "");
    return {
      campaignId: String(row.campaign_id || ""),
      campaignName: String(row.campaign_name || row.campaign_id || "Campaign"),
      adsetId: String(row.adset_id || ""),
      adsetName: String(row.adset_name || row.adset_id || "—"),
      adId,
      adName: String(row.ad_name || row.ad_id || "Ad"),
      spendCents,
      impressions,
      linkClicks,
      lpv: Number(row.landing_page_views) || 0,
      cpcCents: safeCpcCents(spendCents, linkClicks),
      ctrPct: safeCtrPct(linkClicks, impressions),
      firstPartyUploads: uploadByAdId.has(adId) ? uploadByAdId.get(adId)! : null,
      checkout: Number(row.initiate_checkouts) || 0,
      purchase,
      revenueCents,
      cpaCents: safeCpaCents(spendCents, purchase),
      roas: safeRoas(revenueCents, spendCents),
    };
  });
}

export function buildDailyPerformance(input: {
  metaDaily: Array<{
    metric_date?: string;
    spend_cents?: number;
    landing_page_views?: number;
    initiate_checkouts?: number;
    purchases?: number;
    purchase_value_cents?: number;
  }>;
  backendDaily: Array<{ metric_date?: string; purchases?: number; revenue_cents?: number }>;
  checkoutDaily: Array<{ metric_date?: string; checkouts?: number }>;
}): DailyPerfRow[] {
  const dates = new Set<string>();
  for (const row of input.metaDaily) if (row.metric_date) dates.add(String(row.metric_date));
  for (const row of input.backendDaily) if (row.metric_date) dates.add(String(row.metric_date));
  for (const row of input.checkoutDaily) if (row.metric_date) dates.add(String(row.metric_date));

  const metaByDate = new Map(input.metaDaily.map((r) => [String(r.metric_date), r]));
  const backendByDate = new Map(input.backendDaily.map((r) => [String(r.metric_date), r]));
  const checkoutByDate = new Map(input.checkoutDaily.map((r) => [String(r.metric_date), r]));

  return [...dates]
    .sort()
    .map((date) => {
      const meta = metaByDate.get(date);
      const backend = backendByDate.get(date);
      const checkout = checkoutByDate.get(date);
      const spendCents = meta ? Number(meta.spend_cents) || 0 : null;
      const revenueCents = backend ? Number(backend.revenue_cents) || 0 : meta ? Number(meta.purchase_value_cents) || 0 : null;
      const purchases = backend ? Number(backend.purchases) || 0 : meta ? Number(meta.purchases) || 0 : null;
      return {
        date,
        spendCents,
        lpv: meta ? Number(meta.landing_page_views) || 0 : null,
        checkout: checkout ? Number(checkout.checkouts) || 0 : meta ? Number(meta.initiate_checkouts) || 0 : null,
        purchases,
        revenueCents,
        roas: spendCents == null || revenueCents == null ? null : safeRoas(revenueCents, spendCents),
      };
    });
}

export function firstPartyStepsFromCounts(counts: FunnelStepCounts): FunnelStepRow[] {
  return buildFunnelSteps(counts);
}

export function emptyHybridCounts(): FunnelStepCounts {
  return emptyStepCounts();
}

export function formatMetricOrDash(value: number | null | undefined, format: (n: number) => string = String): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return format(value);
}

export { ratio };
