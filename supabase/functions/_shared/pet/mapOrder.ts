import { deliveryAllowed, mapClipStatusForCustomer, mapOrderStatusForCustomer, mapSceneStatusForCustomer } from "./guards.ts";
import { isThrottleMessage } from "./replicateRateLimit.ts";
import { mapOrderPhase } from "./videoGuards.ts";
import { PET_CURRENCY, PET_SCENE_COUNT, PET_SKU, PET_VIDEO_CLIP_COUNT } from "./constants.ts";
import { sceneByKey } from "./scenes.ts";

export type PetOrderRow = {
  id: string;
  email: string;
  pet_name: string;
  species: string;
  personality: string;
  sku: string;
  amount_cents: number;
  currency: string;
  status: string;
  photo_file_name: string | null;
  photo_content_type: string | null;
  photo_byte_size: number | null;
  photo_width: number | null;
  photo_height: number | null;
  created_at: string;
  paid_at: string | null;
  completed_at: string | null;
  qc_status: string | null;
  promo_code?: string | null;
  charged_amount_cents?: number | null;
};

export type PetSceneRow = {
  scene_key: string;
  title: string;
  status: string;
  progress_percent: number;
  last_error: string | null;
  started_at: string | null;
  completed_at: string | null;
  result_path: string | null;
  result_content_type?: string | null;
  result_width?: number | null;
  result_height?: number | null;
  result_byte_size?: number | null;
};

export type PetClipRow = {
  id: string;
  slot: number;
  source_scene_id: string | null;
  status: string;
  provider_error: string | null;
  result_path: string | null;
  result_content_type?: string | null;
  result_width?: number | null;
  result_height?: number | null;
  requested_duration_seconds?: number | null;
  output_duration_seconds?: number | null;
};

export function toCustomerOrder(
  order: PetOrderRow,
  scenes: PetSceneRow[],
  publicToken: string,
  clips: PetClipRow[] = [],
) {
  const deliveryUnlocked = deliveryAllowed({
    orderStatus: order.status,
    qcStatus: order.qc_status,
    completedAt: order.completed_at,
  });
  return {
    id: order.id,
    publicToken,
    sku: PET_SKU,
    status: mapOrderStatusForCustomer(order.status),
    email: order.email,
    petName: order.pet_name,
    species: order.species,
    personality: order.personality,
    amountCents: Number(order.amount_cents),
    chargedAmountCents: Number(order.charged_amount_cents ?? order.amount_cents),
    promoCode: order.promo_code ?? null,
    currency: PET_CURRENCY,
    noSubscription: true as const,
    photo: order.photo_content_type
      ? {
          fileName: order.photo_file_name || "pet.jpg",
          contentType: order.photo_content_type,
          byteSize: order.photo_byte_size || 0,
          width: order.photo_width,
          height: order.photo_height,
        }
      : null,
    scenes: scenes.map((scene) => toCustomerScene(scene, order.status, deliveryUnlocked)),
    clips: clips.map((clip) => toCustomerClip(clip, deliveryUnlocked)),
    createdAt: order.created_at,
    paidAt: order.paid_at,
    completedAt: order.completed_at,
    purchaseEventId: `pet_purchase_${order.id}`,
    phase: mapOrderPhase(order.status),
  };
}

export function toCustomerScene(
  scene: PetSceneRow,
  orderStatus: string,
  deliveryUnlocked: boolean,
) {
  const definition = sceneByKey(scene.scene_key);
  const status = mapSceneStatusForCustomer({
    sceneStatus: scene.status,
    orderStatus,
    deliveryUnlocked,
  });
  return {
    sceneId: scene.scene_key,
    title: definition?.title || scene.title,
    status,
    progressPercent: scene.progress_percent ?? 0,
    errorMessage: isThrottleMessage(scene.last_error || "") ? null : scene.last_error,
    startedAt: scene.started_at,
    completedAt: scene.completed_at,
  };
}

export function toCustomerClip(clip: PetClipRow, deliveryUnlocked: boolean) {
  const status = mapClipStatusForCustomer({
    clipStatus: clip.status,
    deliveryUnlocked,
  });
  const ready = status === "ready" && deliveryUnlocked && Boolean(clip.result_path);
  return {
    id: clip.id,
    slot: clip.slot === 2 ? 2 : 1,
    sourceSceneId: clip.source_scene_id,
    title: `Cinematic clip ${clip.slot}`,
    status,
    progressPercent: clip.status === "ready" || clip.status === "succeeded" ? 100 : clip.status === "generating" ? 45 : 0,
    errorMessage: clip.provider_error,
    durationSeconds: Number(clip.output_duration_seconds || clip.requested_duration_seconds || 5),
    resolution: "720p",
    previewUrl: null as string | null,
    downloadUrl: ready ? null : null,
  };
}

export function toProgress(order: PetOrderRow, scenes: PetSceneRow[], publicToken: string, clips: PetClipRow[] = []) {
  const deliveryUnlocked = deliveryAllowed({
    orderStatus: order.status,
    qcStatus: order.qc_status,
    completedAt: order.completed_at,
  });
  const mapped = scenes.map((scene) => toCustomerScene(scene, order.status, deliveryUnlocked));
  const mappedClips = clips.map((clip) => toCustomerClip(clip, deliveryUnlocked));
  const readyCount = mapped.filter((scene) => scene.status === "ready").length;
  const failedCount = mapped.filter((scene) => scene.status === "failed").length;
  const videoReadyCount = mappedClips.filter((clip) => clip.status === "ready").length;
  const videoFailedCount = mappedClips.filter((clip) => clip.status === "failed").length;
  const overallPercent = mapped.length
    ? Math.round(
        (mapped.reduce((sum, scene) => sum + scene.progressPercent, 0) +
          mappedClips.reduce((sum, clip) => sum + clip.progressPercent, 0)) /
          (mapped.length + Math.max(mappedClips.length, PET_VIDEO_CLIP_COUNT)),
      )
    : 0;
  const customerStatus = mapOrderStatusForCustomer(order.status);
  return {
    orderId: order.id,
    publicToken,
    orderStatus: customerStatus,
    phase: mapOrderPhase(order.status),
    overallPercent,
    readyCount,
    failedCount,
    totalCount: PET_SCENE_COUNT,
    videoReadyCount,
    videoFailedCount,
    videoTotalCount: PET_VIDEO_CLIP_COUNT,
    scenes: mapped,
    clips: mappedClips,
    humanQualityControl: false,
  };
}
