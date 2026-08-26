import { emptyStepCounts, type FunnelStepCounts } from "./funnelDashboard";

export const FUNNEL_DATASET_IDS = ["v1", "v2", "v3"] as const;
export type FunnelDatasetId = (typeof FUNNEL_DATASET_IDS)[number];

export type FunnelDatasetConfig = {
  id: FunnelDatasetId;
  /** Meta campaign_id. Empty string means Campaign is not configured yet. */
  campaignId: string;
  funnelVariant: "v1" | "v2_preview" | "v3_cat_preview";
  shortLabel: string;
  displayName: string;
  eventSource: "pet_funnel_events" | "pet_v2_funnel_events" | "pet_v3_funnel_events";
  kpiLabels: {
    landing: string;
    step2: string;
    step3: string;
    step4: string;
    checkout: string;
    purchase: string;
    landingHelper: string;
    step2Of: string;
    step3Of: string;
    step4Of: string;
    checkoutOf: string;
  };
  stageLabels: Partial<Record<keyof FunnelStepCounts, string>>;
};

/**
 * Single place to wire campaign IDs / names.
 * V1 is the live Dog campaign. Put Campaign 2's Meta campaign_id on `v2.campaignId` when it exists.
 */
export const FUNNEL_DATASETS: Record<FunnelDatasetId, FunnelDatasetConfig> = {
  v1: {
    id: "v1",
    campaignId: "120253346791240170",
    funnelVariant: "v1",
    shortLabel: "V1",
    displayName: "TDG - Dog campaign",
    eventSource: "pet_funnel_events",
    kpiLabels: {
      landing: "Landing sessions",
      step2: "Names Submitted",
      step3: "Photos Selected",
      step4: "Order Reviews",
      checkout: "Initiate Checkouts",
      purchase: "Purchases",
      landingHelper: "First-party landing_view",
      step2Of: "first-party landing",
      step3Of: "names",
      step4Of: "photos",
      checkoutOf: "reviews",
    },
    stageLabels: {},
  },
  v2: {
    id: "v2",
    campaignId: "120253465585030170",
    funnelVariant: "v2_preview",
    shortLabel: "V2",
    displayName: "Pet TDG Funnel V2 testing",
    eventSource: "pet_v2_funnel_events",
    kpiLabels: {
      landing: "Landing Sessions",
      step2: "Photo Uploads",
      step3: "Preview Viewed",
      step4: "Unlock Clicks",
      checkout: "Initiate Checkouts",
      purchase: "Purchases",
      landingHelper: "First-party landing",
      step2Of: "first-party landing",
      step3Of: "uploads",
      step4Of: "previews",
      checkoutOf: "unlocks",
    },
    stageLabels: {
      landing_view: "Landing Sessions",
      pet_name_submitted: "Photo Uploads",
      photo_upload_completed: "Preview Viewed",
      order_review_viewed: "Unlock Clicks",
      initiate_checkout: "Initiate Checkout",
      purchase: "Purchase",
    },
  },
  v3: {
    id: "v3",
    campaignId: "",
    funnelVariant: "v3_cat_preview",
    shortLabel: "V3",
    displayName: "Pet TDG Cat Funnel testing",
    eventSource: "pet_v3_funnel_events",
    kpiLabels: {
      landing: "Landing Sessions",
      step2: "Photo Uploads",
      step3: "Preview Viewed",
      step4: "Offer Viewed",
      checkout: "Initiate Checkouts",
      purchase: "Purchases",
      landingHelper: "First-party landing",
      step2Of: "first-party landing",
      step3Of: "uploads",
      step4Of: "previews",
      checkoutOf: "checkout viewed",
    },
    stageLabels: {
      landing_view: "Landing Sessions",
      pet_name_submitted: "Photo Uploads",
      photo_upload_completed: "Preview Viewed",
      order_review_viewed: "Offer Viewed",
      initiate_checkout: "Initiate Checkout",
      purchase: "Purchase",
    },
  },
};

/** RPC campaign filter when a dataset has no Meta campaign_id yet. Matches no real campaign. */
export const UNCONFIGURED_CAMPAIGN_ID = "__not_configured__";

export function isFunnelDatasetId(value: unknown): value is FunnelDatasetId {
  return value === "v1" || value === "v2" || value === "v3";
}

export function funnelDataset(id: FunnelDatasetId): FunnelDatasetConfig {
  return FUNNEL_DATASETS[id];
}

export function datasetCampaignId(id: FunnelDatasetId): string {
  return FUNNEL_DATASETS[id].campaignId.trim();
}

export function isDatasetConfigured(id: FunnelDatasetId): boolean {
  return datasetCampaignId(id).length > 0;
}

export function rpcCampaignIdForDataset(id: FunnelDatasetId): string {
  return datasetCampaignId(id) || UNCONFIGURED_CAMPAIGN_ID;
}

export function datasetSwitchLabel(id: FunnelDatasetId, liveName?: string | null): string {
  const dataset = FUNNEL_DATASETS[id];
  const name = (liveName || dataset.displayName).trim() || dataset.shortLabel;
  return `${dataset.shortLabel} - ${name}`;
}

export function namedEventCounts(
  rows: Array<{ event_name?: string; eventName?: string; sessions?: number; unique_sessions?: number; event_count?: number }>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const name = String(row.event_name || row.eventName || "").trim();
    if (!name) continue;
    counts[name] = Number(row.unique_sessions ?? row.sessions ?? row.event_count ?? 0) || 0;
  }
  return counts;
}

/** Map isolated V3 event counts into the original 6-card funnel shape. */
export function mapV3CountsToPrimarySteps(v3: Record<string, number>): FunnelStepCounts {
  const counts = emptyStepCounts();
  counts.landing_view = v3.v3_landing_view || 0;
  counts.pet_name_submitted = v3.v3_upload_completed || 0;
  counts.photo_upload_completed = v3.v3_preview_viewed || 0;
  counts.order_review_viewed = v3.v3_offer_viewed || 0;
  counts.initiate_checkout = v3.v3_begin_checkout || 0;
  counts.purchase = v3.v3_purchase || 0;
  return counts;
}

export const V3_FUNNEL_EXTENDED_STEPS = [
  "landing_view",
  "pet_name_submitted",
  "photo_upload_completed",
  "order_review_viewed",
  "checkout_viewed",
  "initiate_checkout",
  "purchase",
] as const;

export type V3FunnelExtendedStep = (typeof V3_FUNNEL_EXTENDED_STEPS)[number];

export type V3FunnelExtendedCounts = Record<V3FunnelExtendedStep, number>;

export const V3_FUNNEL_EXTENDED_LABELS: Record<V3FunnelExtendedStep, string> = {
  landing_view: "Landing Sessions",
  pet_name_submitted: "Photo Uploads",
  photo_upload_completed: "Preview Viewed",
  order_review_viewed: "Offer Viewed",
  checkout_viewed: "Checkout Viewed",
  initiate_checkout: "Initiate Checkout",
  purchase: "Purchase",
};

/** V3 dashboard includes checkout_viewed as its own stage between offer and begin checkout. */
export function mapV3CountsToExtendedSteps(v3: Record<string, number>): V3FunnelExtendedCounts {
  return {
    landing_view: v3.v3_landing_view || 0,
    pet_name_submitted: v3.v3_upload_completed || 0,
    photo_upload_completed: v3.v3_preview_viewed || 0,
    order_review_viewed: v3.v3_offer_viewed || 0,
    checkout_viewed: v3.v3_checkout_viewed || 0,
    initiate_checkout: v3.v3_begin_checkout || 0,
    purchase: v3.v3_purchase || 0,
  };
}

export function buildV3ExtendedFunnelSteps(counts: V3FunnelExtendedCounts) {
  const landing = counts.landing_view;
  return V3_FUNNEL_EXTENDED_STEPS.map((eventName, index) => {
    const sessions = counts[eventName];
    const previous = index === 0 ? null : counts[V3_FUNNEL_EXTENDED_STEPS[index - 1]];
    return {
      eventName,
      label: V3_FUNNEL_EXTENDED_LABELS[eventName],
      sessions,
      fromPreviousPct:
        previous == null || previous <= 0 ? (index === 0 ? 100 : null) : Math.round((sessions / previous) * 1000) / 10,
      fromLandingPct: landing <= 0 ? null : Math.round((sessions / landing) * 1000) / 10,
      dropFromPreviousPct:
        previous == null || previous <= 0
          ? null
          : Math.max(0, Math.round(((previous - sessions) / previous) * 1000) / 10),
    };
  });
}

/** Map isolated V2 event counts into the original 6-card funnel shape. */
export function mapV2CountsToPrimarySteps(v2: Record<string, number>): FunnelStepCounts {
  const counts = emptyStepCounts();
  counts.landing_view = v2.v2_landing_view || 0;
  counts.pet_name_submitted = v2.v2_upload_completed || 0;
  counts.photo_upload_completed = v2.v2_preview_viewed || 0;
  counts.order_review_viewed = v2.v2_unlock_clicked || 0;
  counts.initiate_checkout = v2.v2_begin_checkout || 0;
  counts.purchase = v2.v2_purchase || 0;
  return counts;
}
