/**
 * Isolated My Pet’s Secret Life V2 funnel.
 * Keeps its own storage, session IDs, and event names. Paid 12+2 generation
 * reuses the V1 order pipeline at the V2 $2.99 price.
 *
 * Conversion rebuild: local blurred teaser before pay; expensive AI only after Stripe webhook.
 */

import type { PetSubtype } from "../pet/types";

/** Public URLs match V1 with a `-v2` suffix: `/pet/dog-v2`. */
export const PET_V2_ROUTE_PREFIX = "/pet" as const;
export const PET_V2_PATHS = ["/pet/dog-v2", "/pet/cat-v2", "/pet/other-v2"] as const;
export const PET_V2_DRAFT_STORAGE_KEY = "tdg.petFunnelV2.draft.v1" as const;
export const PET_V2_SESSION_KEY = "tdg.petFunnelV2.session.v1" as const;
export const PET_V2_EVENT_PATH = "/api/pet-v2/funnel-event" as const;
/** Legacy Vercel path — kept for rewrites/tests. Live traffic uses the edge function. */
export const PET_V2_PREVIEW_PATH = "/api/pet-v2/preview" as const;
export const PET_V2_PREVIEW_EDGE_PATH = "/functions/v1/pet-v2-preview" as const;
export const PET_V2_PROVIDER_STATUS_PATH = "/functions/v1/pet-provider-status" as const;

/** V2 charges $2.99 from $27. Live V1 /pet/dog checkout is a separate $17 sale. */
export const PET_V2_PRICE_CENTS = 299 as const;
export const PET_V2_PRICE_DISPLAY = "$2.99" as const;
export const PET_V2_COMPARE_PRICE_CENTS = 2700 as const;
export const PET_V2_COMPARE_PRICE_DISPLAY = "$27" as const;
/** @deprecated Use PET_V2_PRICE_* — kept for older imports/tests. */
export const PET_V2_TEST_PRICE_CENTS = PET_V2_PRICE_CENTS;
export const PET_V2_TEST_PRICE_DISPLAY = PET_V2_PRICE_DISPLAY;
export const PET_V2_PRODUCTION_PRICE_CENTS = PET_V2_COMPARE_PRICE_CENTS;
export const PET_V2_PRODUCTION_PRICE_DISPLAY = PET_V2_COMPARE_PRICE_DISPLAY;

export const PET_V2_PREVIEW_SCENE = "formula-racer" as const;
export const PET_V2_MAX_FREE_PREVIEWS_PER_SESSION = 2 as const; // legacy; teaser has no Replicate cost
export const PET_V2_MAX_FREE_PREVIEWS_PER_IP_PER_DAY = 5 as const;
export const PET_V2_PHOTO_MAX_BYTES = 15 * 1024 * 1024;
/** Keep enough edge detail for fluffy manes / coat texture before Kontext. */
export const PET_V2_UPLOAD_MAX_EDGE = 2048;

export const PET_V2_STEPS = [
  "landing",
  "photo",
  "teaser",
  "offer",
  /** @deprecated Legacy AI-preview steps — kept for draft restore mapping. */
  "generating",
  "preview",
] as const;

export type PetV2Step = (typeof PET_V2_STEPS)[number];
export type PetV2Species = "dog" | "cat" | "other";

/**
 * Canonical V2 event names for the conversion rebuild.
 * Legacy `v2_preview_*` / `v2_unlock_clicked` remain allowed for historical ingest compatibility
 * but are no longer emitted by the teaser funnel.
 */
export const PET_V2_EVENTS = [
  "v2_landing_view",
  "v2_upload_started",
  "v2_upload_completed",
  "v2_upload_failed",
  "v2_species_confirmed",
  "v2_teaser_generation_started",
  "v2_teaser_generation_completed",
  "v2_teaser_generation_failed",
  "v2_teaser_viewed",
  "v2_offer_viewed",
  "v2_checkout_session_requested",
  "v2_checkout_session_created",
  "v2_checkout_failed",
  "v2_begin_checkout",
  "v2_checkout_canceled",
  "v2_purchase",
  "v2_paid_generation_started",
  "v2_paid_generation_completed",
  "v2_paid_generation_failed",
  "v2_collection_viewed",
  "v2_provider_unavailable",
  // Legacy (historical reporting only — do not silently redefine)
  "v2_preview_generation_started",
  "v2_preview_generation_completed",
  "v2_preview_generation_failed",
  "v2_preview_viewed",
  "v2_preview_regenerated",
  "v2_unlock_clicked",
] as const;

export type PetV2EventName = (typeof PET_V2_EVENTS)[number];

export type PetV2PhotoMeta = {
  fileName: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
};

export type PetV2Draft = {
  species: PetV2Species;
  step: PetV2Step;
  photo: PetV2PhotoMeta | null;
  /** Stable per uploaded file; used in teaser/order association. */
  uploadId: string | null;
  /** Current logical teaser attempt; reused across retries/remounts. */
  previewAttemptId: string | null;
  photoPreviewDataUrl: string | null;
  /** Heavily blurred personalized teaser (never a clear AI artwork). */
  generatedPreviewDataUrl: string | null;
  generationMode: "teaser" | "live" | "mock" | null;
  previewCount: number;
  lastError: string | null;
  email: string;
  petName: string;
  subtype: PetSubtype | null;
  subtypeDetail: string | null;
  /** Server order identity after upload-before-pay bootstrap. */
  orderId: string | null;
  publicToken: string | null;
  updatedAt: string;
};

export type PetV2FailureCategory =
  | "endpoint_unreachable"
  | "provider_auth"
  | "provider_error"
  | "provider_unavailable"
  | "timeout"
  | "rate_limit"
  | "invalid_image"
  | "wrong_species"
  | "teaser_error"
  | "checkout_error"
  | "server_error";

export type PetV2PreviewResponse = {
  ok: boolean;
  mode: "live" | "mock" | "teaser";
  imageDataUrl?: string;
  error?: string;
  errorCode?:
    | "rate_limited"
    | "rate_limit"
    | "invalid_photo"
    | "heic_unsupported"
    | "generation_failed"
    | "live_disabled"
    | "payload_too_large"
    | "provider_auth"
    | "timeout"
    | "provider_error"
    | "provider_unavailable"
    | "invalid_image"
    | "wrong_species"
    | "unclear_species"
    | "invalid_funnel"
    | "server_error"
    | "teaser_error";
  failureCategory?: PetV2FailureCategory;
  remainingSession?: number;
  remainingIp?: number;
  estimatedSeconds?: number;
  preview_attempt_id?: string;
  reused?: boolean;
  retryable?: boolean;
  provider?: "replicate" | "openai" | "local";
  providerStatus?: string;
  providerDetail?: string;
  latencyMs?: number;
  identityBuild?: string;
  speciesDetected?: string;
  speciesConfidence?: number;
};

export const V2_PROVIDER_UNAVAILABLE_COPY =
  "We’re temporarily unable to create new transformations. Please try again shortly — you haven’t been charged.";

export const V2_CHECKOUT_FAILED_COPY =
  "We couldn’t open the secure payment form. Please try again. You haven’t been charged.";

export const V2_TEASER_HEADLINE = "Your dog’s secret life is ready to be revealed.";
export const V2_TEASER_SUPPORT =
  "Unlock the complete personalized 12+2 image collection for $2.99.";
export const V2_TEASER_CTA = "Reveal My Dog’s Secret Life — $2.99";
