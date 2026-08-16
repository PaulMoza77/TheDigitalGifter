import {
  PET_ALLOWED_CONTENT_TYPES,
  PET_CURRENCY,
  PET_PHOTO_MAX_BYTES,
  PET_PRICE_CENTS,
  PET_SKU,
} from "./constants.ts";
import {
  canReleaseDelivery as canReleaseDeliveryWithVideos,
  rejectClientPriceTampering as rejectClientPriceAgainstOffer,
} from "./videoGuards.ts";

export const PAID_STATUSES = [
  "paid",
  "generating",
  "awaiting_qc",
  "selecting_video_scenes",
  "generating_videos",
  "awaiting_video_qc",
  "complete",
  "partial_failure",
] as const;

export type StripeFulfillDecision =
  | { fulfill: false; reason: "not_pet" }
  | { fulfill: false; reason: "invoice_ignored" }
  | { fulfill: false; reason: "unpaid" }
  | { fulfill: true; reason: "paid_session" };

export function serverOwnedAmount(): { amountCents: typeof PET_PRICE_CENTS; currency: typeof PET_CURRENCY; sku: typeof PET_SKU } {
  return { amountCents: PET_PRICE_CENTS, currency: PET_CURRENCY, sku: PET_SKU };
}

export function rejectClientPriceTampering(input: {
  amountCents?: unknown;
  currency?: unknown;
  sku?: unknown;
}, serverAmountCents = PET_PRICE_CENTS): { ok: true } | { ok: false; code: "INVALID_REQUEST"; message: string } {
  return rejectClientPriceAgainstOffer(input, serverAmountCents);
}

export function assertUploadAllowed(
  contentType: string,
  byteSize: number,
): { ok: true } | { ok: false; code: "INVALID_REQUEST"; message: string } {
  if (!PET_ALLOWED_CONTENT_TYPES.includes(contentType as (typeof PET_ALLOWED_CONTENT_TYPES)[number])) {
    return { ok: false, code: "INVALID_REQUEST", message: "Photo must be JPEG, PNG, or WebP." };
  }
  if (!Number.isFinite(byteSize) || byteSize <= 0 || byteSize > PET_PHOTO_MAX_BYTES) {
    return { ok: false, code: "INVALID_REQUEST", message: "Photo must be 15 MB or smaller." };
  }
  return { ok: true };
}

export function tokenEnumerationRejected(token: string): boolean {
  const value = String(token || "").trim();
  if (!value) return true;
  if (value.length < 32) return true;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function canStartGeneration(input: {
  paidAt: string | null;
  status: string;
}): { ok: true } | { ok: false; code: "PAYMENT_REQUIRED" | "INVALID_REQUEST"; message: string } {
  if (!input.paidAt && !PAID_STATUSES.includes(input.status as (typeof PAID_STATUSES)[number])) {
    return { ok: false, code: "PAYMENT_REQUIRED", message: "Unpaid orders cannot generate." };
  }
  if (input.status === "refunded") {
    return { ok: false, code: "INVALID_REQUEST", message: "Refunded orders cannot generate." };
  }
  return { ok: true };
}

export function stripeFulfillmentDecision(input: {
  eventType: string;
  productType?: string;
  sku?: string;
  mode?: string;
  paymentStatus?: string;
}): StripeFulfillDecision {
  const isPet = input.sku === PET_SKU || input.productType === "pet_secret_life";
  if (!isPet) return { fulfill: false, reason: "not_pet" };
  if (input.eventType === "invoice.paid") return { fulfill: false, reason: "invoice_ignored" };
  if (input.eventType === "checkout.session.async_payment_succeeded") {
    return { fulfill: true, reason: "paid_session" };
  }
  if (input.eventType === "checkout.session.completed") {
    const paid = input.paymentStatus === "paid" || input.paymentStatus === "no_payment_required";
    if (!paid) return { fulfill: false, reason: "unpaid" };
    if (input.mode && input.mode !== "payment") return { fulfill: false, reason: "unpaid" };
    return { fulfill: true, reason: "paid_session" };
  }
  return { fulfill: false, reason: "not_pet" };
}

export function replicateCallbackShouldApply(input: {
  alreadyProcessed: boolean;
  currentSceneStatus: string;
}): { apply: boolean; reason: "duplicate_callback" | "already_succeeded" | "apply" } {
  if (input.alreadyProcessed) return { apply: false, reason: "duplicate_callback" };
  if (input.currentSceneStatus === "succeeded" || input.currentSceneStatus === "ready") {
    return { apply: false, reason: "already_succeeded" };
  }
  return { apply: true, reason: "apply" };
}

export function retryTargets<T extends { status: string; sceneKey?: string; scene_key?: string }>(
  scenes: T[],
  selectedKey?: string,
): T[] {
  return scenes.filter((scene) => {
    const key = scene.sceneKey || scene.scene_key;
    if (scene.status !== "failed") return false;
    if (selectedKey && key !== selectedKey) return false;
    return true;
  });
}

export function deliveryAllowed(input: {
  orderStatus: string;
  qcStatus?: string | null;
  completedAt?: string | null;
}): boolean {
  return input.orderStatus === "complete" && Boolean(input.completedAt || input.qcStatus === "approved");
}

export function canReleaseDelivery(input: {
  paidAt: string | null;
  orderStatus: string;
  scenes: Array<{ status: string; qcStatus?: string | null }>;
  clips?: Array<{ status: string; qcStatus?: string | null }>;
}): { ok: true } | { ok: false; message: string } {
  return canReleaseDeliveryWithVideos(input);
}

export function metaPurchaseShouldEmit(input: {
  alreadySentAt: string | null;
  eventId: string;
  requestedEventId?: string;
}): boolean {
  if (input.alreadySentAt) return false;
  if (input.requestedEventId && input.requestedEventId !== input.eventId) return false;
  return true;
}

export function mapOrderStatusForCustomer(status: string): string {
  if (status === "generating") return "processing";
  if (status === "awaiting_qc") return "quality_control";
  return status;
}

export function mapSceneStatusForCustomer(input: {
  sceneStatus: string;
  orderStatus: string;
  deliveryUnlocked: boolean;
}): "queued" | "generating" | "quality_control" | "ready" | "failed" {
  if (input.sceneStatus === "failed") return "failed";
  if (input.sceneStatus === "queued") return "queued";
  if (input.sceneStatus === "generating") return "generating";
  if (input.sceneStatus === "ready" && input.deliveryUnlocked) return "ready";
  if (input.sceneStatus === "succeeded" || input.sceneStatus === "ready") return "quality_control";
  return "queued";
}

export function mapClipStatusForCustomer(input: {
  clipStatus: string;
  deliveryUnlocked: boolean;
}): "queued" | "generating" | "quality_control" | "ready" | "failed" {
  if (input.clipStatus === "failed") return "failed";
  if (input.clipStatus === "queued") return "queued";
  if (input.clipStatus === "generating") return "generating";
  if (input.clipStatus === "ready" && input.deliveryUnlocked) return "ready";
  if (input.clipStatus === "succeeded" || input.clipStatus === "ready") return "quality_control";
  return "queued";
}
