import {
  PET_CURRENCY,
  PET_PRICE_CENTS,
  PET_PRODUCT_SKU,
  PET_SCENE_COUNT,
  PET_VIDEO_CLIP_COUNT,
} from "./types";

export const PET_VIDEO_MODEL_DEFAULT = "bytedance/seedance-1-pro-fast";
export const PET_VIDEO_DURATION_SECONDS_DEFAULT = 5;
export const PET_VIDEO_RESOLUTION_DEFAULT = "720p";
export const PET_VIDEO_MAX_ATTEMPTS_DEFAULT = 1;
export const SEEDANCE_PRICE_PER_SECOND_USD = 0.025;
export const PROJECTED_VIDEO_PACK_COST_USD = 0.25;
export const PROJECTED_IMAGE_PACK_COST_USD = 0.48;
export const PROJECTED_FULL_PACK_COST_USD = 0.73;

export const DEFAULT_VIDEO_MOTION_PROMPT =
  "Subtle cinematic motion of this exact pet portrait. Natural blinking, slight head movement, subtle breathing, gentle fur movement, and a slow cinematic camera push-in. Preserve the exact pet face, coat pattern, proportions, costume and background. No morphing, no extra limbs, no new animals, no scene change, no aggressive camera movement, no identity drift.";

export const CLIENT_OWNED_VIDEO_KEYS = [
  "model",
  "modelName",
  "duration",
  "durationSeconds",
  "resolution",
  "cost",
  "costUsd",
  "price",
  "amountCents",
  "storagePath",
  "predictionId",
  "status",
] as const;

export type VideoClipStatus = "queued" | "generating" | "succeeded" | "failed" | "ready";

export type VideoClipView = {
  id: string;
  petOrderId: string;
  sourceSceneId: string;
  slot: 1 | 2;
  status: VideoClipStatus;
  replicatePredictionId?: string | null;
  attemptNumber?: number;
  resultPath?: string | null;
  qcStatus?: "approved" | "rejected" | null;
};

export type SceneView = {
  id: string;
  orderId: string;
  status: string;
};

export const PAID_VIDEO_STATUSES = [
  "paid",
  "generating",
  "awaiting_qc",
  "selecting_video_scenes",
  "generating_videos",
  "awaiting_video_qc",
  "complete",
  "partial_failure",
] as const;

export function rejectUnsignedReplicateWebhook(input: {
  webhookId?: string | null;
  timestamp?: string | null;
  signature?: string | null;
}): { ok: true } | { ok: false; message: string } {
  if (!input.webhookId || !input.timestamp || !input.signature) {
    return { ok: false, message: "Invalid Replicate signature" };
  }
  return { ok: true };
}

export function rejectClientVideoTampering(
  body: Record<string, unknown>,
): { ok: true } | { ok: false; message: string } {
  const blocked = CLIENT_OWNED_VIDEO_KEYS.filter((key) => Object.prototype.hasOwnProperty.call(body, key));
  if (blocked.length) {
    return {
      ok: false,
      message: "Video model, duration, resolution, cost, price, storage path, prediction id, and status are server-owned.",
    };
  }
  return { ok: true };
}

export function isAdminAuthorized(input: { callerIsAdmin: boolean; mutation: boolean }): boolean {
  return input.callerIsAdmin === true;
}

export function seedanceInput(input: { prompt: string; imageUrl: string; duration: number; resolution: string }) {
  return {
    prompt: input.prompt,
    image: input.imageUrl,
    duration: input.duration,
    resolution: input.resolution,
    camera_fixed: false,
  };
}

export function defaultVideoPrompt(): string {
  return DEFAULT_VIDEO_MOTION_PROMPT;
}

export function canSelectVideoSources(input: {
  callerIsAdmin: boolean;
  paidAt: string | null;
  orderStatus: string;
  scenes: SceneView[];
  selectedSceneIds: string[];
  orderId: string;
}): { ok: true } | { ok: false; code: string; message: string } {
  if (!input.callerIsAdmin) {
    return { ok: false, code: "FORBIDDEN", message: "Admin authentication is required." };
  }
  if (!input.paidAt && !PAID_VIDEO_STATUSES.includes(input.orderStatus as (typeof PAID_VIDEO_STATUSES)[number])) {
    return { ok: false, code: "PAYMENT_REQUIRED", message: "Unpaid order cannot generate clips." };
  }
  const unique = [...new Set(input.selectedSceneIds.filter(Boolean))];
  if (unique.length !== PET_VIDEO_CLIP_COUNT) {
    return { ok: false, code: "INVALID_REQUEST", message: "Select exactly two source portraits." };
  }
  const selected = unique.map((id) => input.scenes.find((scene) => scene.id === id));
  if (selected.some((scene) => !scene)) {
    return { ok: false, code: "INVALID_REQUEST", message: "Selected scenes must belong to the same order." };
  }
  if (selected.some((scene) => scene && scene.orderId !== input.orderId)) {
    return { ok: false, code: "INVALID_REQUEST", message: "Selected scenes must belong to the same order." };
  }
  if (selected.some((scene) => scene && !["succeeded", "ready"].includes(scene.status))) {
    return { ok: false, code: "INVALID_REQUEST", message: "Source portraits must have succeeded." };
  }
  return { ok: true };
}

export function successfulImageCount(scenes: Array<{ status: string }>): number {
  return scenes.filter((scene) => ["succeeded", "ready"].includes(scene.status)).length;
}

export function canGenerateVideoClips(input: {
  callerIsAdmin: boolean;
  paidAt: string | null;
  orderStatus: string;
  scenes: SceneView[];
  selectedSceneIds: string[];
  orderId: string;
  existingClips: VideoClipView[];
  videoGenerationEnabled: boolean;
  videoGenerationMock?: boolean;
}): { ok: true } | { ok: false; code: string; message: string; status?: "held" } {
  const auth = canSelectVideoSources(input);
  if (!auth.ok) return auth;
  if (successfulImageCount(input.scenes) < PET_SCENE_COUNT) {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: "All 12 portraits must succeed before generating clips.",
    };
  }
  if (input.scenes.length < PET_SCENE_COUNT) {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: "All 12 portraits must succeed before generating clips.",
    };
  }
  const active = input.existingClips.filter((clip) =>
    ["generating", "succeeded", "ready"].includes(clip.status) ||
    (clip.status === "queued" && Boolean(clip.replicatePredictionId)),
  );
  if (active.length > 0) {
    return { ok: false, code: "INVALID_REQUEST", message: "Video clips were already generated for this order." };
  }
  if (!input.videoGenerationEnabled && !input.videoGenerationMock) {
    return {
      ok: false,
      code: "GENERATION_HELD",
      message: "Video generation is disabled.",
      status: "held",
    };
  }
  return { ok: true };
}

export function canRetryVideoClip(input: {
  callerIsAdmin: boolean;
  paidAt: string | null;
  clip: VideoClipView | null;
  orderId: string;
}): { ok: true } | { ok: false; code: string; message: string } {
  if (!input.callerIsAdmin) {
    return { ok: false, code: "FORBIDDEN", message: "Admin authentication is required." };
  }
  if (!input.paidAt) {
    return { ok: false, code: "PAYMENT_REQUIRED", message: "Unpaid order cannot generate clips." };
  }
  if (!input.clip || input.clip.petOrderId !== input.orderId) {
    return { ok: false, code: "INVALID_REQUEST", message: "Clip not found on this order." };
  }
  if (input.clip.status !== "failed") {
    return { ok: false, code: "INVALID_REQUEST", message: "Retry only the failed clip." };
  }
  return { ok: true };
}

export function canApproveVideoClip(input: {
  callerIsAdmin: boolean;
  clip: VideoClipView | null;
  orderId: string;
}): { ok: true } | { ok: false; code: string; message: string } {
  if (!input.callerIsAdmin) {
    return { ok: false, code: "FORBIDDEN", message: "Admin authentication is required." };
  }
  if (!input.clip || input.clip.petOrderId !== input.orderId) {
    return { ok: false, code: "INVALID_REQUEST", message: "Clip not found on this order." };
  }
  if (!["succeeded", "ready"].includes(input.clip.status)) {
    return { ok: false, code: "INVALID_REQUEST", message: "Only succeeded clips can be QC-approved." };
  }
  return { ok: true };
}

export function canIssueSignedVideoUrl(input: {
  orderStatus: string;
  clipStatus: string;
  qcStatus?: string | null;
  requesterOrderId: string;
  clipOrderId: string;
}): boolean {
  if (input.requesterOrderId !== input.clipOrderId) return false;
  if (input.orderStatus !== "complete") return false;
  return input.clipStatus === "ready" && (input.qcStatus == null || input.qcStatus === "approved");
}

export function customerCannotAccessOtherOrderVideos(
  requesterTokenOrderId: string,
  clipOrderId: string,
): boolean {
  return requesterTokenOrderId !== clipOrderId;
}

export function mapOrderPhase(status: string):
  | "generating_portraits"
  | "portrait_qc"
  | "selecting_video_scenes"
  | "generating_clips"
  | "video_qc"
  | "complete"
  | "partial_failure"
  | "failed"
  | "other" {
  if (status === "generating" || status === "processing" || status === "paid") return "generating_portraits";
  if (status === "awaiting_qc" || status === "quality_control") return "portrait_qc";
  if (status === "selecting_video_scenes") return "selecting_video_scenes";
  if (status === "generating_videos") return "generating_clips";
  if (status === "awaiting_video_qc") return "video_qc";
  if (status === "complete") return "complete";
  if (status === "partial_failure") return "partial_failure";
  if (status === "failed") return "failed";
  return "other";
}

export function canReleaseDelivery(input: {
  paidAt: string | null;
  orderStatus: string;
  scenes: Array<{ status: string; qcStatus?: string | null }>;
  clips?: Array<{ status: string; qcStatus?: string | null }>;
}): { ok: true } | { ok: false; message: string } {
  if (!input.paidAt) return { ok: false, message: "unpaid order cannot be released" };
  if (!["awaiting_qc", "selecting_video_scenes", "awaiting_video_qc"].includes(input.orderStatus)) {
    return { ok: false, message: "order is not awaiting QC" };
  }
  if (input.scenes.length !== PET_SCENE_COUNT) {
    return { ok: false, message: "expected 12 scenes" };
  }
  const imageBlocking = input.scenes.filter((scene) => scene.status !== "ready");
  if (imageBlocking.length > 0) {
    return { ok: false, message: "all 12 images must be QC-approved before release" };
  }
  const clips = input.clips ?? [];
  if (clips.length !== PET_VIDEO_CLIP_COUNT) {
    return { ok: false, message: "expected 2 video clips" };
  }
  const videoBlocking = clips.filter(
    (clip) => clip.status !== "ready" || (clip.qcStatus != null && clip.qcStatus !== "approved"),
  );
  if (videoBlocking.length > 0) {
    return { ok: false, message: "both video clips must be QC-approved before release" };
  }
  return { ok: true };
}

export function markCompleteCannotBypass(input: Parameters<typeof canReleaseDelivery>[0]): boolean {
  return !canReleaseDelivery(input).ok;
}

export function stripeCheckoutIsOneTimePayment(mode: string): boolean {
  return mode === "payment";
}

export function resolveServerOwnedOffer(offer: {
  amountCents?: unknown;
  currency?: unknown;
  sku?: unknown;
  subscription?: unknown;
  active?: unknown;
} | null): { ok: true; amountCents: number; currency: "usd"; sku: typeof PET_PRODUCT_SKU } | { ok: false; message: string } {
  if (!offer) return { ok: false, message: "Pet offer is unavailable." };
  const amount = Number(offer.amountCents);
  const currency = String(offer.currency || "").toLowerCase();
  const sku = String(offer.sku || "").trim();
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: "Pet offer price is invalid." };
  if (currency !== PET_CURRENCY) return { ok: false, message: "Pet offer currency is invalid." };
  if (sku !== PET_PRODUCT_SKU) return { ok: false, message: "Unknown SKU." };
  if (offer.subscription === true) return { ok: false, message: "Pet offer cannot be a subscription." };
  if (offer.active === false) return { ok: false, message: "Pet offer is inactive." };
  return { ok: true, amountCents: Math.round(amount), currency: PET_CURRENCY, sku: PET_PRODUCT_SKU };
}

export function snapshotOrderPrice(offer: { amountCents: number; currency: string; sku: string; version: number }) {
  return {
    sku: offer.sku,
    amountCents: offer.amountCents,
    currency: offer.currency,
    offerVersion: offer.version,
  };
}

export function orderRetainsSnapshottedPrice(
  order: { amountCents: number; offerVersion: number },
  updatedOffer: { amountCents: number; version: number },
): { amountCents: number; offerVersion: number } {
  void updatedOffer;
  return { amountCents: order.amountCents, offerVersion: order.offerVersion };
}

export function rejectClientPriceTampering(
  input: { amountCents?: unknown; currency?: unknown; sku?: unknown },
  serverAmountCents = PET_PRICE_CENTS,
): { ok: true } | { ok: false; code: "INVALID_REQUEST"; message: string } {
  if (input.sku != null && String(input.sku).trim() && String(input.sku).trim() !== PET_PRODUCT_SKU) {
    return { ok: false, code: "INVALID_REQUEST", message: "Unknown SKU." };
  }
  if (input.amountCents != null && input.amountCents !== "" && Number(input.amountCents) !== Number(serverAmountCents)) {
    return { ok: false, code: "INVALID_REQUEST", message: "Price is server-owned." };
  }
  if (
    input.currency != null &&
    String(input.currency).trim() &&
    String(input.currency).trim().toLowerCase() !== PET_CURRENCY
  ) {
    return { ok: false, code: "INVALID_REQUEST", message: "Currency is server-owned." };
  }
  return { ok: true };
}

export function publicOfferFields(offer: {
  sku: string;
  name: string;
  amountCents: number;
  currency: string;
  imageCount: number;
  videoCount: number;
  subscription: boolean;
  active: boolean;
  stripePriceId?: string;
  version?: number;
}) {
  return {
    sku: offer.sku,
    name: offer.name,
    amountCents: offer.amountCents,
    currency: offer.currency,
    imageCount: offer.imageCount,
    videoCount: offer.videoCount,
    subscription: false,
    active: offer.active,
  };
}

export function replicateVideoCallbackShouldApply(input: {
  alreadyProcessed: boolean;
  currentClipStatus: string;
}): { apply: boolean; reason: "duplicate_callback" | "already_succeeded" | "apply" } {
  if (input.alreadyProcessed) return { apply: false, reason: "duplicate_callback" };
  if (input.currentClipStatus === "succeeded" || input.currentClipStatus === "ready") {
    return { apply: false, reason: "already_succeeded" };
  }
  return { apply: true, reason: "apply" };
}

export function videoStoragePath(orderId: string, clipId: string, attempt: number): string {
  return `${orderId}/videos/${clipId}/attempt-${attempt}.mp4`;
}

export function formatOfferPrice(amountCents: number): string {
  const dollars = amountCents / 100;
  if (Number.isInteger(dollars)) return `$${dollars}`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(dollars);
}

export const PET_COMP_PROMO_CODE = "VTM99" as const;
export const PET_COMP_PROMO_PERCENT = 100 as const;

export function normalizePromoCode(code: unknown): string {
  return String(code || "").trim().toUpperCase();
}

export function resolveServerOwnedPromo(
  code: unknown,
  clientDiscountPercent?: unknown,
):
  | { ok: true; code: typeof PET_COMP_PROMO_CODE; discountPercent: typeof PET_COMP_PROMO_PERCENT; chargedAmountCents: 0 }
  | { ok: true; code: null; discountPercent: 0; chargedAmountCents: null }
  | { ok: false; message: string } {
  if (clientDiscountPercent != null && clientDiscountPercent !== "") {
    return { ok: false, message: "Discount percent is server-owned." };
  }
  const normalized = normalizePromoCode(code);
  if (!normalized) {
    return { ok: true, code: null, discountPercent: 0, chargedAmountCents: null };
  }
  if (normalized === PET_COMP_PROMO_CODE) {
    return {
      ok: true,
      code: PET_COMP_PROMO_CODE,
      discountPercent: PET_COMP_PROMO_PERCENT,
      chargedAmountCents: 0,
    };
  }
  return { ok: false, message: "Invalid promo code." };
}

export function chargedAmountForPromo(
  listAmountCents: number,
  discountPercent: number,
): number {
  if (discountPercent >= 100) return 0;
  if (discountPercent <= 0) return listAmountCents;
  return Math.max(0, Math.round(listAmountCents * (1 - discountPercent / 100)));
}
