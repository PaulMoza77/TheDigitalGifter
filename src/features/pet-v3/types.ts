/**
 * Isolated My Pet’s Secret Life V3 cat funnel.
 * Reuses the V1 order pipeline at the fixed V3 $2.99 price.
 */

import type { PetSubtype } from "../pet/types";

export const PET_V3_ROUTE = "/pet/cat-v3" as const;
export const PET_V3_DRAFT_STORAGE_KEY = "tdg.petFunnelV3.draft.v1" as const;
export const PET_V3_SESSION_KEY = "tdg.petFunnelV3.session.v1" as const;
export const PET_V3_EVENT_PATH = "/api/pet-v3/funnel-event" as const;
export const PET_V3_PREVIEW_EDGE_PATH = "/functions/v1/pet-v2-preview" as const;

export const PET_V3_SPECIES = "cat" as const;
export const PET_V3_FUNNEL_VERSION = "v3" as const;
export const PET_V3_FUNNEL_VARIANT = "v3_cat_preview" as const;

/** V3 cat pack price — $2.99 from $27. */
export const PET_V3_PRICE_CENTS = 299 as const;
export const PET_V3_PRICE_DISPLAY = "$2.99" as const;
export const PET_V3_COMPARE_PRICE_DISPLAY = "$27" as const;

export const PET_V3_PREVIEW_SCENE = "royal-portrait" as const;
export const PET_V3_MAX_FREE_PREVIEWS_PER_SESSION = 2 as const;
export const PET_V3_MAX_FREE_PREVIEWS_PER_IP_PER_DAY = 5 as const;
export const PET_V3_PHOTO_MAX_BYTES = 15 * 1024 * 1024;
export const PET_V3_UPLOAD_MAX_EDGE = 2048;

export const PET_V3_STEPS = [
  "landing",
  "photo",
  "generating",
  "preview",
  "offer",
] as const;

export type PetV3Step = (typeof PET_V3_STEPS)[number];

export const PET_V3_EVENTS = [
  "v3_landing_view",
  "v3_upload_started",
  "v3_upload_completed",
  "v3_upload_failed",
  "v3_preview_generation_started",
  "v3_preview_generation_completed",
  "v3_preview_generation_failed",
  "v3_preview_viewed",
  "v3_preview_regenerated",
  "v3_offer_viewed",
  "v3_unlock_clicked",
  "v3_checkout_viewed",
  "v3_checkout_session_created",
  "v3_begin_checkout",
  "v3_purchase",
] as const;

export type PetV3EventName = (typeof PET_V3_EVENTS)[number];

export type PetV3PhotoMeta = {
  fileName: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
};

export type PetV3Draft = {
  species: typeof PET_V3_SPECIES;
  step: PetV3Step;
  photo: PetV3PhotoMeta | null;
  uploadId: string | null;
  previewAttemptId: string | null;
  photoPreviewDataUrl: string | null;
  generatedPreviewDataUrl: string | null;
  generationMode: "live" | "mock" | null;
  previewCount: number;
  lastError: string | null;
  email: string;
  petName: string;
  subtype: PetSubtype | null;
  subtypeDetail: string | null;
  updatedAt: string;
};

export type PetV3FailureCategory =
  | "endpoint_unreachable"
  | "provider_auth"
  | "provider_error"
  | "timeout"
  | "rate_limit"
  | "invalid_image"
  | "wrong_species"
  | "server_error";

export type PetV3PreviewResponse = {
  ok: boolean;
  mode: "live" | "mock";
  imageDataUrl?: string;
  error?: string;
  errorCode?:
    | "rate_limited"
    | "invalid_photo"
    | "heic_unsupported"
    | "generation_failed"
    | "live_disabled"
    | "payload_too_large"
    | "provider_auth"
    | "timeout"
    | "provider_error"
    | "invalid_image"
    | "wrong_species"
    | "unclear_species"
    | "invalid_funnel"
    | "server_error";
  failureCategory?: PetV3FailureCategory;
  remainingSession?: number;
  remainingIp?: number;
  estimatedSeconds?: number;
  preview_attempt_id?: string;
  reused?: boolean;
  speciesDetected?: string;
  speciesConfidence?: number;
};
