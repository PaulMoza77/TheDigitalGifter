import {
  CHRISTMAS_STARTER_PRICE_CENTS,
  type ChristmasPackKey,
  type ChristmasSceneKey,
} from "./config";

export const CHRISTMAS_V2_STEPS = [
  "landing",
  "offer",
  "checkout",
  "generating",
  "results",
  "upsell",
] as const;

export type ChristmasV2Step = (typeof CHRISTMAS_V2_STEPS)[number];

export const CHRISTMAS_V2_EVENTS = [
  "christmas_v2_view",
  "christmas_v2_upload_started",
  "christmas_v2_upload_completed",
  "christmas_v2_upload_failed",
  "christmas_v2_offer_viewed",
  "christmas_v2_checkout_started",
  "christmas_v2_checkout_rendered",
  "christmas_v2_payment_submitted",
  "christmas_v2_checkout_failed",
  "christmas_v2_checkout_canceled",
  "christmas_v2_purchase",
  "christmas_v2_generation_started",
  "christmas_v2_generation_completed",
  "christmas_v2_generation_failed",
  "christmas_v2_results_viewed",
  "christmas_v2_upsell_viewed",
  "christmas_v2_magic_pack_checkout",
  "christmas_v2_magic_pack_purchase",
  "christmas_v2_ultimate_pack_checkout",
  "christmas_v2_ultimate_pack_purchase",
  "christmas_v2_video_generated",
] as const;

export type ChristmasV2EventName = (typeof CHRISTMAS_V2_EVENTS)[number];

export type ChristmasPhotoMeta = {
  fileName: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
};

export type ChristmasV2Draft = {
  step: ChristmasV2Step;
  photo: ChristmasPhotoMeta | null;
  uploadId: string | null;
  photoPreviewDataUrl: string | null;
  email: string;
  customerName: string;
  orderId: string | null;
  publicToken: string | null;
  packKey: ChristmasPackKey;
  selectedScenes: ChristmasSceneKey[];
  surpriseMe: boolean;
  videoSourceSceneKeys: ChristmasSceneKey[];
  lastError: string | null;
  updatedAt: string;
};

export function emptyChristmasDraft(): ChristmasV2Draft {
  return {
    step: "landing",
    photo: null,
    uploadId: null,
    photoPreviewDataUrl: null,
    email: "",
    customerName: "",
    orderId: null,
    publicToken: null,
    packKey: "starter",
    selectedScenes: [],
    surpriseMe: true,
    videoSourceSceneKeys: [],
    lastError: null,
    updatedAt: new Date().toISOString(),
  };
}

export const CHRISTMAS_CHECKOUT_FAILED_COPY =
  "We couldn’t open the secure payment form. Please try again. You haven’t been charged.";

export const CHRISTMAS_PROVIDER_UNAVAILABLE_COPY =
  "We’re temporarily unable to create new Christmas portraits. Please try again shortly — you haven’t been charged.";

export { CHRISTMAS_STARTER_PRICE_CENTS };
