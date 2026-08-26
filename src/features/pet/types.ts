/**
 * Domain types for the isolated "My Pet's Secret Life" funnel.
 * These contracts are the source of truth for a future Supabase + Stripe wiring pass.
 */

export const PET_PRODUCT_SKU = "pet-secret-life-12" as const;
export const PET_PRODUCT_NAME = "My Pet’s Secret Life" as const;
export const PET_PRODUCT_PROMISE = "One photo. 12 secret lives. 2 cinematic clips. Same pet every time." as const;
export const PET_PRICE_CENTS = 2700 as const;
export const PET_PRICE_DISPLAY = "$27" as const;
export const PET_CURRENCY = "usd" as const;
export const PET_SCENE_COUNT = 12 as const;
export const PET_VIDEO_CLIP_COUNT = 2 as const;
export const PET_VIDEO_DURATION_SECONDS = 5 as const;
export const PET_VIDEO_RESOLUTION = "720p" as const;
export const PET_PHOTO_MAX_BYTES = 15 * 1024 * 1024;
export const PET_DRAFT_STORAGE_KEY = "tdg.petFunnel.draft.v1" as const;
export const PET_DEFAULT_PERSONALITY = "cute" as const;
export const PET_DEFAULT_DELIVERY_ESTIMATE = "Usually ready in a few minutes after payment" as const;

export const PET_PHOTO_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type PetPhotoContentType = (typeof PET_PHOTO_CONTENT_TYPES)[number];

export const PET_SPECIES = ["dog", "cat", "other"] as const;
export type PetSpecies = (typeof PET_SPECIES)[number];

export const PET_PERSONALITIES = [
  "funny",
  "royal",
  "cute",
  "badass",
  "luxury",
  "adventure",
] as const;
export type PetPersonality = (typeof PET_PERSONALITIES)[number];

export const PET_SUBTYPES = ["rabbit", "bird", "small_pet", "reptile", "horse", "other"] as const;
export type PetSubtype = (typeof PET_SUBTYPES)[number];

export const PET_SCENE_IDS = [
  "royal-portrait",
  "luxury-ceo",
  "astronaut",
  "formula-racer",
  "spa-bathtub",
  "newspaper",
  "cinema-boss",
  "renaissance",
  "beach-vacation",
  "head-chef",
  "original-superhero",
  "christmas-portrait",
] as const;
export type PetSceneId = (typeof PET_SCENE_IDS)[number];

export type PetSceneStatus =
  | "queued"
  | "generating"
  | "quality_control"
  | "ready"
  | "failed";

export type PetOrderStatus =
  | "draft"
  | "awaiting_upload"
  | "awaiting_payment"
  | "paid"
  | "generating"
  | "processing"
  | "awaiting_qc"
  | "quality_control"
  | "selecting_video_scenes"
  | "generating_videos"
  | "awaiting_video_qc"
  | "complete"
  | "partial_failure"
  | "failed"
  | "refunded"
  | "canceled";

export type PetOrderPhase =
  | "generating_portraits"
  | "portrait_qc"
  | "selecting_video_scenes"
  | "generating_clips"
  | "video_qc"
  | "complete"
  | "partial_failure"
  | "failed";

export type PetVideoClipStatus =
  | "queued"
  | "generating"
  | "quality_control"
  | "ready"
  | "failed";

export type PetResultFormatKind = "high_res" | "wallpaper" | "social" | "poster";

export type PetSceneDefinition = {
  id: PetSceneId;
  number: number;
  title: string;
  tagline: string;
  promptHint: string;
  art: {
    from: string;
    to: string;
    accent: string;
  };
};

export type PetPersonalityOption = {
  id: PetPersonality;
  label: string;
  description: string;
};

export type PetSpeciesOption = {
  id: PetSpecies;
  label: string;
  hint: string;
};

export type PetPhotoMeta = {
  fileName: string;
  contentType: PetPhotoContentType;
  byteSize: number;
  width: number | null;
  height: number | null;
};

export type PetFunnelDraft = {
  petName: string;
  species: PetSpecies | null;
  subtype: PetSubtype | null;
  subtypeDetail: string | null;
  personality: PetPersonality | null;
  email: string;
  photo: PetPhotoMeta | null;
  /** Small, resized data URL for local restore. Never the original file. */
  photoPreviewDataUrl: string | null;
  updatedAt: string;
};

export type PetPersistedDraft = {
  version: 1;
  draft: PetFunnelDraft;
};

export type PetSceneProgress = {
  sceneId: PetSceneId;
  title: string;
  status: PetSceneStatus;
  progressPercent: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type PetOrder = {
  id: string;
  publicToken: string;
  sku: typeof PET_PRODUCT_SKU;
  status: PetOrderStatus;
  email: string;
  petName: string;
  species: PetSpecies;
  personality: PetPersonality;
  amountCents: number;
  currency: typeof PET_CURRENCY;
  noSubscription: true;
  photo: PetPhotoMeta | null;
  scenes: PetSceneProgress[];
  clips?: PetVideoClipProgress[];
  createdAt: string;
  paidAt: string | null;
  completedAt: string | null;
  purchaseEventId?: string;
  phase?: PetOrderPhase;
  promoCode?: string | null;
  chargedAmountCents?: number;
};

export type PetVideoClipProgress = {
  id: string;
  slot: 1 | 2;
  sourceSceneId: string | null;
  title: string;
  status: PetVideoClipStatus;
  progressPercent: number;
  errorMessage: string | null;
  durationSeconds: number;
  resolution: string;
  previewUrl: string | null;
  downloadUrl: string | null;
};

export type PetResultAsset = {
  format: PetResultFormatKind;
  label: string;
  url: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  dpi: number | null;
  ready: boolean;
};

export type PetSceneResult = {
  sceneId: PetSceneId;
  title: string;
  status: PetSceneStatus;
  previewUrl: string | null;
  assets: PetResultAsset[];
};

export type PetVideoClipResult = {
  id: string;
  slot: 1 | 2;
  sourceSceneId: string | null;
  title: string;
  status: PetVideoClipStatus;
  previewUrl: string | null;
  downloadUrl: string | null;
  mimeType: string;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  ready: boolean;
};

export type PetOrderResults = {
  orderId: string;
  publicToken: string;
  petName: string;
  status: PetOrderStatus;
  scenes: PetSceneResult[];
  clips: PetVideoClipResult[];
  upsells?: PetOrderUpsellCatalog | null;
};

export type PetUpsellKey = "gift_pack" | "holiday_card" | "print_pack" | "retry_3_scenes";

export type PetUpsellOfferView = {
  key: PetUpsellKey;
  name: string;
  description: string;
  priceCents: number;
  currency: "usd";
  scope: "scene" | "order";
  cta: string;
  purchasedCta: string;
  priceDisplay: string;
  purchased: boolean;
  available: boolean;
  unavailableReason?: string | null;
  printMaxSizeLabel?: string | null;
  maxScenes?: number;
};

export type PetSceneUpsellView = {
  sceneKey: string;
  title: string;
  width: number | null;
  height: number | null;
  offers: PetUpsellOfferView[];
};

export type PetPurchasedUpsell = {
  id: string;
  upsellKey: PetUpsellKey;
  sceneKey: string | null;
  status: string;
  fulfillmentStatus: string | null;
  sceneKeys: string[];
  paidAt: string | null;
  fulfilledAt: string | null;
};

export type PetOrderUpsellCatalog = {
  sceneUpsells: PetSceneUpsellView[];
  orderUpsells: PetUpsellOfferView[];
  purchased: PetPurchasedUpsell[];
};

export type CreateUpsellCheckoutRequest = {
  publicToken: string;
  upsellKey: PetUpsellKey;
  sceneKey?: string;
  sceneKeys?: string[];
  successUrl: string;
  cancelUrl: string;
};

export type CreateUpsellCheckoutResponse = {
  upsellId: string;
  sessionId: string;
  checkoutUrl: string;
  status: "open";
  upsellKey: PetUpsellKey;
  amountCents: number;
  priceDisplay: string;
};

export type PetGenerationProgress = {
  orderId: string;
  publicToken: string;
  orderStatus: PetOrderStatus;
  phase: PetOrderPhase | "other";
  overallPercent: number;
  readyCount: number;
  failedCount: number;
  totalCount: typeof PET_SCENE_COUNT;
  videoReadyCount: number;
  videoFailedCount: number;
  videoTotalCount: typeof PET_VIDEO_CLIP_COUNT;
  scenes: PetSceneProgress[];
  clips: PetVideoClipProgress[];
  humanQualityControl: boolean;
};

export type CreatePetOrderRequest = {
  email: string;
  petName: string;
  species: PetSpecies;
  personality: PetPersonality;
  photo: PetPhotoMeta;
  sku: typeof PET_PRODUCT_SKU;
  subtype?: PetSubtype | null;
  subtypeDetail?: string | null;
  funnelVariant?: "v1" | "v2" | "v3";
};

export type CreatePetOrderResponse = {
  orderId: string;
  publicToken: string;
  status: Extract<PetOrderStatus, "awaiting_upload">;
  amountCents: number;
  currency: typeof PET_CURRENCY;
  sku: typeof PET_PRODUCT_SKU;
};

export type PublicPetOffer = {
  sku: typeof PET_PRODUCT_SKU;
  name: string;
  amountCents: number;
  currency: typeof PET_CURRENCY;
  imageCount: typeof PET_SCENE_COUNT;
  videoCount: typeof PET_VIDEO_CLIP_COUNT;
  subscription: false;
  active: true;
  priceDisplay: string;
  version?: number;
  deliveryEstimate?: string;
  compareAtCents?: number;
  compareAtDisplay?: string;
  saleExpiresAt?: string | null;
  saleActive?: boolean;
};

export type GetSignedUploadUrlRequest = {
  orderId: string;
  publicToken: string;
  contentType: PetPhotoContentType;
  fileName: string;
  byteSize: number;
};

export type SignedUploadUrlResponse = {
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  objectPath: string;
  expiresAt: string;
  /**
   * Preview-only flag. Production implementations must omit this
   * so the client performs a real signed PUT.
   */
  skipNetworkUpload?: boolean;
};

export type ConfirmUploadRequest = {
  orderId: string;
  publicToken: string;
  objectPath: string;
};

export type ConfirmUploadResponse = {
  orderId: string;
  publicToken: string;
  status: Extract<PetOrderStatus, "awaiting_payment">;
  photoStored: true;
};

export type UpdateOrderContactRequest = {
  orderId: string;
  publicToken: string;
  email: string;
  petName: string;
};

export type UpdateOrderContactResponse = {
  orderId: string;
  email: string;
  petName: string;
  updated: true;
};

export type RecordV3InitiateCheckoutRequest = {
  orderId: string;
  publicToken: string;
  eventId: string;
};

export type RecordV3InitiateCheckoutResponse = {
  eventId: string;
  sent: boolean;
  alreadySent: boolean;
};

export type CreateStripeCheckoutRequest = {
  orderId: string;
  publicToken: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail: string;
  promoCode?: string;
  uiMode?: "hosted" | "embedded" | "custom";
  funnelSessionId?: string;
  deviceType?: "mobile" | "tablet" | "desktop";
  attribution?: {
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
    utm_term?: string | null;
    campaign_id?: string | null;
    adset_id?: string | null;
    ad_id?: string | null;
  };
};

export type CreateStripeCheckoutResponse = {
  sessionId: string;
  checkoutUrl: string | null;
  clientSecret?: string | null;
  publishableKey?: string | null;
  expiresAt?: number | null;
  status?: "open" | "payment_processing" | "comped";
  reused?: boolean;
  promoCode?: string | null;
  chargedAmountCents?: number;
  amountCents?: number;
  eventId?: string;
  purchaseEventId?: string;
  checkoutDiag?: {
    sessionExists?: boolean;
    livemode?: boolean | null;
    customUi?: boolean;
    clientSecretValid?: boolean;
    publishableMode?: "live" | "test" | null;
    secretMode?: "live" | "test" | null;
    publishableAccountFp?: string | null;
    secretAccountFp?: string | null;
    keysPaired?: boolean;
    initFailureCode?: string | null;
  };
};

export type GetOrderByPublicTokenRequest = {
  publicToken: string;
};

export type PollGenerationProgressRequest = {
  publicToken: string;
};

export type GetOrderResultsRequest = {
  publicToken: string;
};

export type PetAccountPortrait = {
  sceneId: PetSceneId;
  title: string;
  previewUrl: string;
  downloadUrl: string;
  fileName: string;
  width: number | null;
  height: number | null;
};

export type PetAccountClip = {
  id: string;
  title: string;
  previewUrl: string | null;
  downloadUrl: string | null;
  fileName: string;
  ready: boolean;
};

export type PetAccountGallery = {
  orderId: string;
  publicToken: string | null;
  petName: string;
  species: PetSpecies;
  status: PetOrderStatus;
  createdAt: string;
  orderUrl: string;
  portraits: PetAccountPortrait[];
  clips: PetAccountClip[];
  upsells?: PetOrderUpsellCatalog | null;
};

export type ListMyPetGalleriesResponse = {
  galleries: PetAccountGallery[];
};

export type PetFunnelApiErrorCode =
  | "PET_API_NOT_CONNECTED"
  | "INVALID_REQUEST"
  | "UPLOAD_FAILED"
  | "ORDER_NOT_FOUND"
  | "PAYMENT_REQUIRED"
  | "GENERATION_FAILED"
  | "CHECKOUT_CONFLICT"
  | "AUTH_REQUIRED";

export type PetPageId = "landing" | "create" | "checkout" | "order";

export type PetFunnelNavigation = {
  goToLanding: (species?: PetSpecies) => void;
  goToCreate: (species?: PetSpecies) => void;
  goToCheckout: () => void;
  goToOrder: (publicToken?: string) => void;
};

export type PetOrderPageState =
  | "processing"
  | "quality_control"
  | "complete"
  | "partial_failure"
  | "failed"
  | "not_found";
