/**
 * Unified TDG funnel registry for Admin Funnel Analytics.
 * Only lists funnels that exist as active product surfaces in this repo.
 * External delivery health must never be marked healthy without evidence.
 */

export const FUNNEL_HEALTH_STATES = ["healthy", "degraded", "unverified", "disabled"] as const;
export type FunnelHealthState = (typeof FUNNEL_HEALTH_STATES)[number];

export type FunnelRegistryEntry = {
  id: string;
  label: string;
  productKeys: string[];
  routes: string[];
  purchaseCapable: boolean;
  firstPartyEvents: boolean;
  ga4: FunnelHealthState;
  metaPixel: FunnelHealthState;
  metaCapi: FunnelHealthState;
  purchaseDedupe: FunnelHealthState;
  notes?: string;
};

/**
 * Minimum required registry + other genuinely active production funnels found in repo.
 * External channels default to unverified/disabled until evidence exists.
 */
export const TDG_FUNNEL_REGISTRY: FunnelRegistryEntry[] = [
  {
    id: "pet_v1",
    label: "Pet V1",
    productKeys: ["pet"],
    routes: ["/pet/dog", "/pet/cat", "/pet/other"],
    purchaseCapable: true,
    firstPartyEvents: true,
    ga4: "unverified",
    metaPixel: "unverified",
    metaCapi: "unverified",
    purchaseDedupe: "unverified",
  },
  {
    id: "pet_v2",
    label: "Pet V2",
    productKeys: ["pet_v2"],
    routes: ["/pet/dog-v2", "/pet/cat-v2", "/pet/other-v2"],
    purchaseCapable: true,
    firstPartyEvents: true,
    ga4: "unverified",
    metaPixel: "unverified",
    metaCapi: "unverified",
    purchaseDedupe: "unverified",
    notes: "Existing Pet Purchase Pixel+CAPI path — do not regress.",
  },
  {
    id: "pet_v3",
    label: "Pet V3",
    productKeys: ["pet_v3"],
    routes: ["/pet/cat-v3"],
    purchaseCapable: true,
    firstPartyEvents: true,
    ga4: "unverified",
    metaPixel: "unverified",
    metaCapi: "unverified",
    purchaseDedupe: "unverified",
  },
  {
    id: "christmas_portrait",
    label: "Christmas Portrait",
    productKeys: ["christmas_photo", "christmas_family", "christmas_couple", "christmas_pet"],
    routes: [
      "/christmas/photo-generator",
      "/christmas/family",
      "/christmas/couples",
      "/christmas/pets",
    ],
    purchaseCapable: true,
    firstPartyEvents: true,
    ga4: "unverified",
    metaPixel: "disabled",
    metaCapi: "disabled",
    purchaseDedupe: "disabled",
  },
  {
    id: "christmas_santa_video",
    label: "Christmas Santa Video",
    productKeys: ["christmas_santa_video"],
    routes: ["/christmas/santa-video"],
    purchaseCapable: true,
    firstPartyEvents: true,
    ga4: "unverified",
    metaPixel: "disabled",
    metaCapi: "disabled",
    purchaseDedupe: "disabled",
  },
  {
    id: "christmas_tree_gifts",
    label: "Christmas Tree / Gifts",
    productKeys: ["christmas_tree"],
    routes: ["/christmas/tree", "/christmas/tree/:shareId"],
    purchaseCapable: false,
    firstPartyEvents: true,
    ga4: "unverified",
    metaPixel: "disabled",
    metaCapi: "disabled",
    purchaseDedupe: "disabled",
    notes: "Decorative tree share experience — protect historical share links.",
  },
  {
    id: "christmas_wishlist",
    label: "Christmas Wishlist",
    productKeys: ["christmas_wishlist"],
    routes: ["/christmas/wishlist", "/wishlist/:shareId"],
    purchaseCapable: false,
    firstPartyEvents: true,
    ga4: "unverified",
    metaPixel: "disabled",
    metaCapi: "disabled",
    purchaseDedupe: "disabled",
  },
  {
    id: "christmas_gift_finder",
    label: "Christmas Gift Finder",
    productKeys: ["christmas_gift_finder"],
    routes: ["/christmas/gift-finder"],
    purchaseCapable: false,
    firstPartyEvents: true,
    ga4: "unverified",
    metaPixel: "disabled",
    metaCapi: "disabled",
    purchaseDedupe: "disabled",
  },
  {
    id: "christmas_cards",
    label: "Christmas Cards",
    productKeys: ["christmas_card"],
    routes: ["/christmas/cards"],
    purchaseCapable: false,
    firstPartyEvents: true,
    ga4: "unverified",
    metaPixel: "disabled",
    metaCapi: "disabled",
    purchaseDedupe: "disabled",
  },
  {
    id: "christmas_messages",
    label: "Christmas Messages",
    productKeys: ["christmas_messages"],
    routes: ["/christmas/messages"],
    purchaseCapable: false,
    firstPartyEvents: true,
    ga4: "unverified",
    metaPixel: "disabled",
    metaCapi: "disabled",
    purchaseDedupe: "disabled",
  },
  {
    id: "christmas_advent",
    label: "Christmas Advent",
    productKeys: ["christmas_advent"],
    routes: ["/christmas/advent"],
    purchaseCapable: false,
    firstPartyEvents: true,
    ga4: "unverified",
    metaPixel: "disabled",
    metaCapi: "disabled",
    purchaseDedupe: "disabled",
  },
  {
    id: "christmas_send_a_gift",
    label: "Send a Gift",
    productKeys: ["christmas_send_a_gift"],
    routes: ["/send-a-gift", "/gift/:shareId"],
    purchaseCapable: true,
    firstPartyEvents: true,
    ga4: "unverified",
    metaPixel: "unverified",
    metaCapi: "unverified",
    purchaseDedupe: "unverified",
    notes: "production_purchasable=false until founder pricing activation.",
  },
  {
    id: "christmas_v2_ai_photos",
    label: "Christmas V2 AI Photos (legacy)",
    productKeys: ["christmas_v2"],
    routes: ["/christmas-ai-photos"],
    purchaseCapable: true,
    firstPartyEvents: true,
    ga4: "unverified",
    metaPixel: "disabled",
    metaCapi: "disabled",
    purchaseDedupe: "disabled",
    notes: "Legacy V2 surface still routed in App.",
  },
];

export const REQUIRED_FUNNEL_IDS = [
  "pet_v1",
  "pet_v2",
  "pet_v3",
  "christmas_portrait",
  "christmas_santa_video",
  "christmas_tree_gifts",
  "christmas_wishlist",
  "christmas_gift_finder",
  "christmas_cards",
  "christmas_messages",
  "christmas_advent",
  "christmas_send_a_gift",
] as const;

export function findFunnel(id: string): FunnelRegistryEntry | undefined {
  return TDG_FUNNEL_REGISTRY.find((f) => f.id === id);
}

export function assertRequiredFunnelsPresent(): {
  ok: boolean;
  missing: string[];
} {
  const ids = new Set(TDG_FUNNEL_REGISTRY.map((f) => f.id));
  const missing = REQUIRED_FUNNEL_IDS.filter((id) => !ids.has(id));
  return { ok: missing.length === 0, missing: [...missing] };
}

export function isAllowedHealthState(value: string): value is FunnelHealthState {
  return (FUNNEL_HEALTH_STATES as readonly string[]).includes(value);
}
