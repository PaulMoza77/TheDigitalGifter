import { PET_SCENES } from "./catalog";
import { PetApiError, type PetFunnelApi } from "./api";
import type {
  PetGenerationProgress,
  PetOrder,
  PetOrderResults,
  PetOrderStatus,
  PetResultAsset,
  PetSceneId,
  PetSceneProgress,
  PetSceneResult,
  PetSceneStatus,
} from "./types";
import { PET_PRICE_CENTS, PET_PRODUCT_SKU, PET_SCENE_COUNT } from "./types";

export type PreviewOrderPreset =
  | "processing"
  | "quality_control"
  | "complete"
  | "partial_failure"
  | "failed";

type PreviewStore = {
  order: PetOrder | null;
  preset: PreviewOrderPreset;
};

const store: PreviewStore = {
  order: null,
  preset: "processing",
};

export function setPreviewOrderPreset(preset: PreviewOrderPreset): void {
  store.preset = preset;
  if (store.order) {
    store.order = applyPreset(store.order, preset);
  }
}

export function getPreviewOrderPreset(): PreviewOrderPreset {
  return store.preset;
}

export function createPreviewPetApi(): PetFunnelApi {
  return {
    async createOrder(input) {
      const now = new Date().toISOString();
      const orderId = `preview-order-${Date.now()}`;
      const publicToken = `preview_${cryptoRandom()}`;
      store.order = {
        id: orderId,
        publicToken,
        sku: PET_PRODUCT_SKU,
        status: "awaiting_upload",
        email: input.email,
        petName: input.petName,
        species: input.species,
        personality: input.personality,
        amountCents: PET_PRICE_CENTS,
        currency: "usd",
        noSubscription: true,
        photo: input.photo,
        scenes: buildQueuedScenes(),
        createdAt: now,
        paidAt: null,
        completedAt: null,
      };
      return {
        orderId,
        publicToken,
        status: "awaiting_upload",
        amountCents: PET_PRICE_CENTS,
        currency: "usd",
        sku: PET_PRODUCT_SKU,
      };
    },

    async getSignedUploadUrl(input) {
      ensurePreviewOrder(input.publicToken);
      return {
        uploadUrl: "preview://local-upload",
        method: "PUT",
        headers: { "content-type": input.contentType },
        objectPath: `pet-orders/${input.orderId}/source.${extensionFromType(input.contentType)}`,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        skipNetworkUpload: true,
      };
    },

    async confirmUpload(input) {
      const order = ensurePreviewOrder(input.publicToken);
      order.status = "awaiting_payment";
      return {
        orderId: order.id,
        publicToken: order.publicToken,
        status: "awaiting_payment",
        photoStored: true,
      };
    },

    async createStripeCheckout(input) {
      const order = ensurePreviewOrder(input.publicToken);
      order.status = "paid";
      order.paidAt = new Date().toISOString();
      store.order = applyPreset(order, store.preset);
      return {
        sessionId: `preview_cs_${cryptoRandom()}`,
        checkoutUrl: `preview://checkout-success?token=${encodeURIComponent(order.publicToken)}`,
      };
    },

    async getOrderByPublicToken(input) {
      return clone(ensurePreviewOrder(input.publicToken));
    },

    async pollGenerationProgress(input) {
      const order = ensurePreviewOrder(input.publicToken);
      const readyCount = order.scenes.filter((scene) => scene.status === "ready").length;
      const failedCount = order.scenes.filter((scene) => scene.status === "failed").length;
      const overallPercent = Math.round(
        order.scenes.reduce((sum, scene) => sum + scene.progressPercent, 0) /
          PET_SCENE_COUNT
      );
      const progress: PetGenerationProgress = {
        orderId: order.id,
        publicToken: order.publicToken,
        orderStatus: order.status,
        overallPercent,
        readyCount,
        failedCount,
        totalCount: PET_SCENE_COUNT,
        scenes: order.scenes.map((scene) => ({ ...scene })),
        humanQualityControl: order.status === "quality_control" || order.status === "complete",
      };
      return progress;
    },

    async getOrderResults(input) {
      const order = ensurePreviewOrder(input.publicToken);
      return toResults(order);
    },
  };
}

export function createPreviewOrderFixture(
  preset: PreviewOrderPreset,
  overrides?: Partial<Pick<PetOrder, "petName" | "email" | "species" | "personality">>
): PetOrder {
  const now = new Date().toISOString();
  const base: PetOrder = {
    id: `preview-order-${preset}`,
    publicToken: `preview_${preset}`,
    sku: PET_PRODUCT_SKU,
    status: "processing",
    email: overrides?.email ?? "gift@example.com",
    petName: overrides?.petName ?? "Maple",
    species: overrides?.species ?? "dog",
    personality: overrides?.personality ?? "funny",
    amountCents: PET_PRICE_CENTS,
    currency: "usd",
    noSubscription: true,
    photo: {
      fileName: "maple.jpg",
      contentType: "image/jpeg",
      byteSize: 1_200_000,
      width: 1600,
      height: 1600,
    },
    scenes: buildQueuedScenes(),
    createdAt: now,
    paidAt: now,
    completedAt: null,
  };
  return applyPreset(base, preset);
}

export function createPreviewResults(order: PetOrder): PetOrderResults {
  return toResults(order);
}

function ensurePreviewOrder(publicToken: string): PetOrder {
  if (!store.order || store.order.publicToken !== publicToken) {
    if (publicToken.startsWith("preview_")) {
      store.order = createPreviewOrderFixture(store.preset);
      store.order.publicToken = publicToken;
      return store.order;
    }
    throw new PetApiError("ORDER_NOT_FOUND", "We could not find that pet order.", 404);
  }
  return store.order;
}

function applyPreset(order: PetOrder, preset: PreviewOrderPreset): PetOrder {
  const next: PetOrder = {
    ...order,
    scenes: order.scenes.map((scene) => ({ ...scene })),
  };

  if (preset === "processing") {
    next.status = "processing";
    next.completedAt = null;
    next.scenes = next.scenes.map((scene, index) => {
      if (index < 4) return readyScene(scene);
      if (index < 6) return generatingScene(scene, 62);
      if (index === 6) return qcScene(scene);
      return queuedScene(scene);
    });
  }

  if (preset === "quality_control") {
    next.status = "quality_control";
    next.completedAt = null;
    next.scenes = next.scenes.map((scene, index) =>
      index < 10 ? readyScene(scene) : qcScene(scene)
    );
  }

  if (preset === "complete") {
    next.status = "complete";
    next.completedAt = new Date().toISOString();
    next.scenes = next.scenes.map((scene) => readyScene(scene));
  }

  if (preset === "partial_failure") {
    next.status = "quality_control";
    next.completedAt = null;
    next.scenes = next.scenes.map((scene, index) => {
      if (index === 3) return failedScene(scene, "This scene needs a clearer source photo.");
      if (index < 8) return readyScene(scene);
      return generatingScene(scene, 40);
    });
  }

  if (preset === "failed") {
    next.status = "failed";
    next.completedAt = null;
    next.scenes = next.scenes.map((scene) =>
      failedScene(scene, "Generation paused. Your payment is safe — nothing else was charged.")
    );
  }

  return next;
}

function buildQueuedScenes(): PetSceneProgress[] {
  return PET_SCENES.map((scene) => queuedScene({
    sceneId: scene.id,
    title: scene.title,
    status: "queued",
    progressPercent: 0,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
  }));
}

function queuedScene(scene: PetSceneProgress): PetSceneProgress {
  return {
    ...scene,
    status: "queued",
    progressPercent: 0,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
  };
}

function generatingScene(scene: PetSceneProgress, percent: number): PetSceneProgress {
  return {
    ...scene,
    status: "generating",
    progressPercent: percent,
    errorMessage: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
}

function qcScene(scene: PetSceneProgress): PetSceneProgress {
  return {
    ...scene,
    status: "quality_control",
    progressPercent: 92,
    errorMessage: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
}

function readyScene(scene: PetSceneProgress): PetSceneProgress {
  return {
    ...scene,
    status: "ready",
    progressPercent: 100,
    errorMessage: null,
    startedAt: scene.startedAt ?? new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
}

function failedScene(scene: PetSceneProgress, message: string): PetSceneProgress {
  return {
    ...scene,
    status: "failed",
    progressPercent: 100,
    errorMessage: message,
    startedAt: scene.startedAt ?? new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
}

function toResults(order: PetOrder): PetOrderResults {
  return {
    orderId: order.id,
    publicToken: order.publicToken,
    petName: order.petName,
    status: order.status,
    scenes: order.scenes.map((scene) => toSceneResult(scene, order.status)),
  };
}

function toSceneResult(scene: PetSceneProgress, orderStatus: PetOrderStatus): PetSceneResult {
  const ready = scene.status === "ready";
  return {
    sceneId: scene.sceneId,
    title: scene.title,
    status: scene.status,
    previewUrl: ready ? `preview://result/${scene.sceneId}` : null,
    assets: buildAssets(scene.sceneId, ready && orderStatus !== "failed"),
  };
}

function buildAssets(sceneId: PetSceneId, ready: boolean): PetResultAsset[] {
  return [
    {
      format: "high_res",
      label: "High-resolution",
      url: ready ? `preview://download/${sceneId}/high-res.jpg` : null,
      mimeType: "image/jpeg",
      width: 2400,
      height: 3000,
      dpi: 300,
      ready,
    },
    {
      format: "wallpaper",
      label: "Phone wallpaper",
      url: ready ? `preview://download/${sceneId}/wallpaper.jpg` : null,
      mimeType: "image/jpeg",
      width: 1290,
      height: 2796,
      dpi: null,
      ready,
    },
    {
      format: "social",
      label: "Social format",
      url: ready ? `preview://download/${sceneId}/social.jpg` : null,
      mimeType: "image/jpeg",
      width: 1080,
      height: 1080,
      dpi: null,
      ready,
    },
    {
      format: "poster",
      label: "Printable poster",
      url: ready ? `preview://download/${sceneId}/poster.jpg` : null,
      mimeType: "image/jpeg",
      width: 3600,
      height: 4800,
      dpi: 300,
      ready,
    },
  ];
}

function extensionFromType(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

function cryptoRandom(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  }
  return Math.random().toString(36).slice(2, 12);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const PREVIEW_ORDER_PRESETS: Array<{
  id: PreviewOrderPreset;
  label: string;
}> = [
  { id: "processing", label: "Processing" },
  { id: "quality_control", label: "Human QC" },
  { id: "complete", label: "Complete" },
  { id: "partial_failure", label: "One scene failed" },
  { id: "failed", label: "Order failed" },
];

export type { PetSceneStatus };
