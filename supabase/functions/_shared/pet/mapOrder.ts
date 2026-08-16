import { PET_CURRENCY, PET_PRICE_CENTS, PET_SCENE_COUNT, PET_SKU } from "./constants.ts";
import { deliveryAllowed, mapOrderStatusForCustomer, mapSceneStatusForCustomer } from "./guards.ts";
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

export function toCustomerOrder(order: PetOrderRow, scenes: PetSceneRow[], publicToken: string) {
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
    amountCents: PET_PRICE_CENTS,
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
    createdAt: order.created_at,
    paidAt: order.paid_at,
    completedAt: order.completed_at,
    purchaseEventId: `pet_purchase_${order.id}`,
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
    errorMessage: scene.last_error,
    startedAt: scene.started_at,
    completedAt: scene.completed_at,
  };
}

export function toProgress(order: PetOrderRow, scenes: PetSceneRow[], publicToken: string) {
  const mapped = scenes.map((scene) =>
    toCustomerScene(
      scene,
      order.status,
      deliveryAllowed({
        orderStatus: order.status,
        qcStatus: order.qc_status,
        completedAt: order.completed_at,
      }),
    ),
  );
  const readyCount = mapped.filter((scene) => scene.status === "ready").length;
  const failedCount = mapped.filter((scene) => scene.status === "failed").length;
  const overallPercent = mapped.length
    ? Math.round(mapped.reduce((sum, scene) => sum + scene.progressPercent, 0) / mapped.length)
    : 0;
  return {
    orderId: order.id,
    publicToken,
    orderStatus: mapOrderStatusForCustomer(order.status),
    overallPercent,
    readyCount,
    failedCount,
    totalCount: PET_SCENE_COUNT,
    scenes: mapped,
    humanQualityControl: ["awaiting_qc", "complete", "partial_failure", "quality_control"].includes(
      mapOrderStatusForCustomer(order.status),
    ),
  };
}
