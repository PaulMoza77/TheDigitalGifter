import { FUNNEL_DATASETS } from "@/features/pet/funnelDatasetConfig";
import { CHRISTMAS_V2_EVENT_PATH, CHRISTMAS_V2_ROUTE } from "@/features/christmas-v2/config";
import { CHRISTMAS_CATALOG_SEED } from "@/features/christmas/catalog";
import { CHRISTMAS_FUNNEL_EVENT_PATH } from "@/features/christmas/funnelEventContract";

export const FUNNEL_FAMILIES = ["pet", "christmas"] as const;
export type FunnelFamily = (typeof FUNNEL_FAMILIES)[number];

export type FunnelEventSource =
  | "pet_funnel_events"
  | "pet_v2_funnel_events"
  | "pet_v3_funnel_events"
  | "christmas_v2_funnel_events"
  | "christmas_funnel_events";

export type FunnelRegistryEntry = {
  id: string;
  family: FunnelFamily;
  displayName: string;
  shortLabel: string;
  routePath: string;
  /** False = coming soon / not a live funnel. Overall health is disabled. */
  enabled: boolean;
  eventSource: FunnelEventSource;
  productKey: string | null;
  datasetId: "v1" | "v2" | "v3" | null;
  metaCampaignId: string;
  channels: {
    firstParty: boolean;
    ga4: boolean;
    meta: boolean;
  };
  ingestPath: string | null;
  detailPath: string | null;
  notes: string;
};

/**
 * Required pet + Christmas funnels on main.
 * Send-a-gift is a later primary addition on the send-a-gift branch — do not require it here.
 */
export const REQUIRED_FUNNEL_IDS = [
  "pet_v1",
  "pet_v2",
  "pet_v3",
  "christmas_v2",
  "christmas_photo",
  "christmas_family",
  "christmas_couple",
  "christmas_kids",
  "christmas_pet",
  "christmas_santa_video",
  "christmas_card",
  "christmas_tree",
  "christmas_advent",
  "christmas_wishlist",
  "christmas_gift_finder",
  "christmas_messages",
] as const;

export type RequiredFunnelId = (typeof REQUIRED_FUNNEL_IDS)[number];

function christmasProduct(productKey: string) {
  const product = CHRISTMAS_CATALOG_SEED.find((row) => row.productKey === productKey);
  if (!product) {
    throw new Error(`Christmas catalog missing product ${productKey}`);
  }
  return product;
}

function christmasEntry(
  productKey: string,
  extras: Pick<FunnelRegistryEntry, "enabled" | "notes"> &
    Partial<Pick<FunnelRegistryEntry, "shortLabel" | "routePath">>,
): FunnelRegistryEntry {
  const product = christmasProduct(productKey);
  return {
    id: productKey,
    family: "christmas",
    displayName: product.name,
    shortLabel: extras.shortLabel || product.slug,
    routePath: extras.routePath || product.routePath,
    enabled: extras.enabled,
    eventSource: "christmas_funnel_events",
    productKey,
    datasetId: null,
    metaCampaignId: "",
    channels: {
      firstParty: extras.enabled,
      // Christmas GA4/Meta grain is not synced on main (CHRISTMAS-006 is ingest only).
      ga4: false,
      meta: false,
    },
    ingestPath: extras.enabled ? CHRISTMAS_FUNNEL_EVENT_PATH : null,
    detailPath: null,
    notes: extras.notes,
  };
}

export const FUNNEL_REGISTRY: Record<RequiredFunnelId, FunnelRegistryEntry> = {
  pet_v1: {
    id: "pet_v1",
    family: "pet",
    displayName: FUNNEL_DATASETS.v1.displayName,
    shortLabel: FUNNEL_DATASETS.v1.shortLabel,
    routePath: "/pet",
    enabled: true,
    eventSource: FUNNEL_DATASETS.v1.eventSource,
    productKey: null,
    datasetId: "v1",
    metaCampaignId: FUNNEL_DATASETS.v1.campaignId,
    channels: { firstParty: true, ga4: true, meta: true },
    ingestPath: "/api/pet-funnel-event",
    detailPath: "/admin/pet-funnel-analytics",
    notes: "Dog V1 first-party + hybrid Meta/GA4. Founder geos (RO/IT) are is_test.",
  },
  pet_v2: {
    id: "pet_v2",
    family: "pet",
    displayName: FUNNEL_DATASETS.v2.displayName,
    shortLabel: FUNNEL_DATASETS.v2.shortLabel,
    routePath: "/pet/dog-v2",
    enabled: true,
    eventSource: FUNNEL_DATASETS.v2.eventSource,
    productKey: null,
    datasetId: "v2",
    metaCampaignId: FUNNEL_DATASETS.v2.campaignId,
    channels: { firstParty: true, ga4: true, meta: true },
    ingestPath: "/api/pet-v2-funnel-event",
    detailPath: "/admin/pet-funnel-analytics",
    notes: "Pet V2 preview funnel. Founder geos (RO/IT) are is_test.",
  },
  pet_v3: {
    id: "pet_v3",
    family: "pet",
    displayName: FUNNEL_DATASETS.v3.displayName,
    shortLabel: FUNNEL_DATASETS.v3.shortLabel,
    routePath: "/pet/cat-v3",
    enabled: true,
    eventSource: FUNNEL_DATASETS.v3.eventSource,
    productKey: null,
    datasetId: "v3",
    metaCampaignId: FUNNEL_DATASETS.v3.campaignId,
    channels: { firstParty: true, ga4: true, meta: true },
    ingestPath: "/api/pet-v3-funnel-event",
    detailPath: "/admin/pet-funnel-analytics",
    notes: "Cat V3 first-party is live even before Meta campaign wiring.",
  },
  christmas_v2: {
    id: "christmas_v2",
    family: "christmas",
    displayName: "Christmas AI Photos (V2 pack)",
    shortLabel: "Xmas V2",
    routePath: CHRISTMAS_V2_ROUTE,
    enabled: true,
    eventSource: "christmas_v2_funnel_events",
    productKey: null,
    datasetId: null,
    metaCampaignId: "",
    channels: { firstParty: true, ga4: false, meta: false },
    ingestPath: CHRISTMAS_V2_EVENT_PATH,
    detailPath: null,
    notes: "Legacy /christmas-ai-photos pack funnel. No Christmas Meta/GA4 sync on main.",
  },
  christmas_photo: christmasEntry("christmas_photo", {
    enabled: true,
    notes: "Portrait V1 ingest via /api/christmas/funnel-event (CHRISTMAS-006).",
  }),
  christmas_family: christmasEntry("christmas_family", {
    enabled: true,
    notes: "Family portrait vertical. Same Christmas ingest table.",
  }),
  christmas_couple: christmasEntry("christmas_couple", {
    enabled: true,
    notes: "Couples portrait vertical. Same Christmas ingest table.",
  }),
  christmas_kids: christmasEntry("christmas_kids", {
    enabled: false,
    notes: "Coming soon — privacy controls required. Funnel disabled until live.",
  }),
  christmas_pet: christmasEntry("christmas_pet", {
    enabled: true,
    notes: "Pet Christmas portraits (/christmas/pets, /dogs, /cats).",
  }),
  christmas_santa_video: christmasEntry("christmas_santa_video", {
    enabled: true,
    notes: "Santa Video V1 first-party events.",
  }),
  christmas_card: christmasEntry("christmas_card", {
    enabled: true,
    notes: "Christmas cards acquisition loop.",
  }),
  christmas_tree: christmasEntry("christmas_tree", {
    enabled: true,
    notes: "Shareable Christmas Tree.",
  }),
  christmas_advent: christmasEntry("christmas_advent", {
    enabled: true,
    notes: "Advent calendar. Starts December 1.",
  }),
  christmas_wishlist: christmasEntry("christmas_wishlist", {
    enabled: true,
    notes: "Wishlist share loop.",
  }),
  christmas_gift_finder: christmasEntry("christmas_gift_finder", {
    enabled: true,
    notes: "AI Gift Finder.",
  }),
  christmas_messages: christmasEntry("christmas_messages", {
    enabled: true,
    notes: "Free Christmas message generator.",
  }),
};

export function requiredFunnels(): FunnelRegistryEntry[] {
  return REQUIRED_FUNNEL_IDS.map((id) => {
    const entry = FUNNEL_REGISTRY[id];
    if (!entry) {
      throw new Error(`funnelRegistry missing required funnel ${id}`);
    }
    return entry;
  });
}

export function isRequiredFunnelId(value: unknown): value is RequiredFunnelId {
  return typeof value === "string" && (REQUIRED_FUNNEL_IDS as readonly string[]).includes(value);
}
