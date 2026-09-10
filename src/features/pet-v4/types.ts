/**
 * Isolated Pet Funnel V4 · New Sales Campaign cohort.
 * Product UX reuses the V2 teaser funnel; analytics/session/events are fully separate.
 */

export const PET_V4_META_CAMPAIGN_ID = "120253729468900170" as const;
export const PET_V4_CAMPAIGN_NAME = "New Sales Campaign" as const;

/** First production day for "Since V4 launch" (UTC). */
export const PET_V4_LAUNCH_DATE = "2026-09-09" as const;

export const PET_V4_PATHS = ["/pet/dog-v4", "/pet/cat-v4", "/pet/other-v4"] as const;
export const PET_V4_DRAFT_STORAGE_KEY = "tdg.petFunnelV4.draft.v1" as const;
export const PET_V4_SESSION_KEY = "tdg.petFunnelV4.session.v1" as const;
export const PET_V4_VISITOR_KEY = "tdg.petFunnelV4.visitor.v1" as const;
export const PET_V4_EVENT_PATH = "/api/pet-v4/funnel-event" as const;

export const PET_V4_FUNNEL_VERSION = "v4" as const;
export const PET_V4_FUNNEL_VARIANT = "v4_sales" as const;
/** Stripe / order funnel_variant value. */
export const PET_V4_ORDER_VARIANT = "v4" as const;

/** Same offer economics as the live teaser sales funnel. */
export const PET_V4_PRICE_CENTS = 299 as const;
export const PET_V4_PRICE_DISPLAY = "$2.99" as const;

export type PetV4Species = "dog" | "cat" | "other";

/**
 * Canonical V4 event names (equivalents of pet_* instrumentation list).
 * Stored with funnel_version = v4.
 */
export const PET_V4_EVENTS = [
  "v4_landing_view",
  "v4_scroll_depth",
  "v4_first_interaction",
  "v4_upload_opened",
  "v4_upload_started",
  "v4_upload_completed",
  "v4_upload_failed",
  "v4_upload_abandoned",
  "v4_generation_started",
  "v4_generation_completed",
  "v4_generation_failed",
  "v4_generation_left",
  "v4_teaser_viewed",
  "v4_offer_viewed",
  "v4_cta_clicked",
  "v4_cta_exposed",
  "v4_checkout_clicked",
  "v4_checkout_session_created",
  "v4_checkout_opened",
  "v4_checkout_abandoned",
  "v4_purchase",
] as const;

export type PetV4EventName = (typeof PET_V4_EVENTS)[number];

export type PetV4CtaLocation =
  | "hero"
  | "upload"
  | "try_generate"
  | "teaser"
  | "offer"
  | "buy"
  | "checkout"
  | "other";

export type PetV4ScrollBucket = "lt25" | "p25" | "p50" | "p75" | "p90" | "main_cta" | "pricing";

/** True sequential funnel stages for the primary V4 dashboard. */
export const V4_SEQUENTIAL_STAGES = [
  "landing",
  "upload_started",
  "upload_completed",
  "generation_completed",
  "teaser_viewed",
  "offer_viewed",
  "checkout_clicked",
  "checkout_session_created",
  "purchase",
] as const;

export type V4SequentialStage = (typeof V4_SEQUENTIAL_STAGES)[number];

export const V4_SEQUENTIAL_LABELS: Record<V4SequentialStage, string> = {
  landing: "Landing",
  upload_started: "Photo upload started",
  upload_completed: "Photo upload completed",
  generation_completed: "Generation completed",
  teaser_viewed: "Teaser viewed",
  offer_viewed: "Offer viewed",
  checkout_clicked: "Checkout clicked",
  checkout_session_created: "Stripe checkout created",
  purchase: "Purchase",
};

/** Maps sequential stage → required prior event in the same session. */
export const V4_SEQUENTIAL_EVENT_BY_STAGE: Record<V4SequentialStage, PetV4EventName> = {
  landing: "v4_landing_view",
  upload_started: "v4_upload_started",
  upload_completed: "v4_upload_completed",
  generation_completed: "v4_generation_completed",
  teaser_viewed: "v4_teaser_viewed",
  offer_viewed: "v4_offer_viewed",
  checkout_clicked: "v4_checkout_clicked",
  checkout_session_created: "v4_checkout_session_created",
  purchase: "v4_purchase",
};
