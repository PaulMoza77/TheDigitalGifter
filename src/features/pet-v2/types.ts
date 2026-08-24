/**
 * Isolated My Pet’s Secret Life V2 preview funnel.
 * Must never share storage, session IDs, event names, or checkout with V1.
 */

export const PET_V2_ROUTE_PREFIX = "/pet-v2" as const;
export const PET_V2_DRAFT_STORAGE_KEY = "tdg.petFunnelV2.draft.v1" as const;
export const PET_V2_SESSION_KEY = "tdg.petFunnelV2.session.v1" as const;
export const PET_V2_EVENT_PATH = "/api/pet-v2/funnel-event" as const;
export const PET_V2_PREVIEW_PATH = "/api/pet-v2/preview" as const;

/** Prototype offer copy only. Production V1 remains $27 / 2700 cents. */
export const PET_V2_TEST_PRICE_CENTS = 1900 as const;
export const PET_V2_TEST_PRICE_DISPLAY = "$19" as const;
export const PET_V2_PRODUCTION_PRICE_CENTS = 2700 as const;
export const PET_V2_PRODUCTION_PRICE_DISPLAY = "$27" as const;

export const PET_V2_PREVIEW_SCENE = "royal-portrait" as const;
export const PET_V2_MAX_FREE_PREVIEWS_PER_SESSION = 2 as const; // 1 + 1 regen
export const PET_V2_MAX_FREE_PREVIEWS_PER_IP_PER_DAY = 5 as const;
export const PET_V2_PHOTO_MAX_BYTES = 15 * 1024 * 1024;
export const PET_V2_UPLOAD_MAX_EDGE = 768;

export const PET_V2_STEPS = [
  "landing",
  "photo",
  "generating",
  "preview",
  "offer",
] as const;

export type PetV2Step = (typeof PET_V2_STEPS)[number];
export type PetV2Species = "dog" | "cat" | "other";

export const PET_V2_EVENTS = [
  "v2_landing_view",
  "v2_upload_started",
  "v2_upload_completed",
  "v2_upload_failed",
  "v2_preview_generation_started",
  "v2_preview_generation_completed",
  "v2_preview_generation_failed",
  "v2_preview_viewed",
  "v2_preview_regenerated",
  "v2_offer_viewed",
  "v2_unlock_clicked",
  "v2_begin_checkout",
  "v2_purchase",
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
  photoPreviewDataUrl: string | null;
  generatedPreviewDataUrl: string | null;
  generationMode: "live" | "mock" | null;
  previewCount: number;
  lastError: string | null;
  email: string;
  petName: string;
  updatedAt: string;
};

export type PetV2PreviewResponse = {
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
    | "payload_too_large";
  remainingSession?: number;
  remainingIp?: number;
  estimatedSeconds?: number;
};
