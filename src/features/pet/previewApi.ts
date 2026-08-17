import { PET_SCENES } from "./catalog";
import { PetApiError, type PetFunnelApi } from "./api";
import type {
  PetGenerationProgress,
  PetOrder,
  PetOrderResults,
  PetOrderStatus,
  PetOrderUpsellCatalog,
  PetResultAsset,
  PetSceneId,
  PetSceneProgress,
  PetSceneResult,
  PetSceneStatus,
  PetUpsellKey,
} from "./types";
import { PET_PRICE_CENTS, PET_PRODUCT_SKU, PET_SCENE_COUNT } from "./types";
import { mapOrderPhase } from "./videoGuards";
import { formatUpsellPrice, printPackEligibility, sceneUpsellKeys, PET_UPSELL_OFFERS } from "./upsells";

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

const previewPurchasedUpsells = new Set<string>();

function previewUpsellKey(upsellKey: PetUpsellKey, sceneKey?: string) {
  return sceneKey ? `${upsellKey}:${sceneKey}` : upsellKey;
}

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
        clips: buildQueuedClips(),
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
        status: "open",
        eventId: `pet_ic_${order.id}`,
        purchaseEventId: `pet_purchase_${order.id}`,
        amountCents: order.amountCents,
        chargedAmountCents: order.chargedAmountCents ?? order.amountCents,
      };
    },

    async createUpsellCheckout(input) {
      ensurePreviewOrder(input.publicToken);
      const offer = PET_UPSELL_OFFERS[input.upsellKey];
      previewPurchasedUpsells.add(previewUpsellKey(input.upsellKey, input.sceneKey));
      return {
        upsellId: `preview-upsell-${cryptoRandom()}`,
        sessionId: `preview_cs_upsell_${cryptoRandom()}`,
        checkoutUrl: `preview://upsell-success?token=${encodeURIComponent(input.publicToken)}`,
        status: "open",
        upsellKey: input.upsellKey,
        amountCents: offer.priceCents,
        priceDisplay: formatUpsellPrice(offer.priceCents),
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
        phase: mapOrderPhase(order.status),
        overallPercent,
        readyCount,
        failedCount,
        totalCount: PET_SCENE_COUNT,
        videoReadyCount: (order.clips ?? []).filter((clip) => clip.status === "ready").length,
        videoFailedCount: (order.clips ?? []).filter((clip) => clip.status === "failed").length,
        videoTotalCount: 2,
        scenes: order.scenes.map((scene) => ({ ...scene })),
        clips: order.clips ?? [],
        humanQualityControl: order.status === "quality_control" || order.status === "complete",
      };
      return progress;
    },

    async getOrderResults(input) {
      const order = ensurePreviewOrder(input.publicToken);
      return toResults(order);
    },

    async listMyPetGalleries() {
      return { galleries: [] };
    },

    async getPublicOffer() {
      return {
        sku: PET_PRODUCT_SKU,
        name: "My Pet’s Secret Life",
        amountCents: PET_PRICE_CENTS,
        currency: "usd",
        imageCount: 12,
        videoCount: 2,
        subscription: false,
        active: true,
        priceDisplay: "$59",
      };
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
    clips: buildQueuedClips(),
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
    next.clips = buildQueuedClips();
  }

  if (preset === "complete") {
    next.status = "complete";
    next.completedAt = new Date().toISOString();
    next.clips = [
      {
        id: "preview-clip-1",
        slot: 1,
        sourceSceneId: next.scenes[0]?.sceneId ?? null,
        title: "Cinematic clip 1",
        status: "ready",
        progressPercent: 100,
        errorMessage: null,
        durationSeconds: 5,
        resolution: "720p",
        previewUrl: null,
        downloadUrl: null,
      },
      {
        id: "preview-clip-2",
        slot: 2,
        sourceSceneId: next.scenes[1]?.sceneId ?? null,
        title: "Cinematic clip 2",
        status: "ready",
        progressPercent: 100,
        errorMessage: null,
        durationSeconds: 5,
        resolution: "720p",
        previewUrl: null,
        downloadUrl: null,
      },
    ];
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

function buildQueuedClips(): PetOrder["clips"] {
  return [
    {
      id: "preview-clip-1",
      slot: 1,
      sourceSceneId: null,
      title: "Cinematic clip 1",
      status: "queued",
      progressPercent: 0,
      errorMessage: null,
      durationSeconds: 5,
      resolution: "720p",
      previewUrl: null,
      downloadUrl: null,
    },
    {
      id: "preview-clip-2",
      slot: 2,
      sourceSceneId: null,
      title: "Cinematic clip 2",
      status: "queued",
      progressPercent: 0,
      errorMessage: null,
      durationSeconds: 5,
      resolution: "720p",
      previewUrl: null,
      downloadUrl: null,
    },
  ];
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
  const previewWidth = 1024;
  const previewHeight = 1365;
  const print = printPackEligibility(previewWidth, previewHeight);
  const sceneOfferDefs = sceneUpsellKeys().map((key) => {
    const offer = PET_UPSELL_OFFERS[key];
    return {
      key,
      name: offer.name,
      description: offer.description,
      priceCents: offer.priceCents,
      currency: offer.currency,
      scope: offer.scope,
      cta: offer.cta,
      purchasedCta: offer.purchasedCta,
      priceDisplay: formatUpsellPrice(offer.priceCents),
    };
  });
  const upsells: PetOrderUpsellCatalog = {
    sceneUpsells: order.scenes
      .filter((scene) => scene.status === "ready")
      .map((scene) => ({
        sceneKey: scene.sceneId,
        title: scene.title,
        width: previewWidth,
        height: previewHeight,
        offers: sceneOfferDefs.map((offer) => ({
          ...offer,
          purchased: previewPurchasedUpsells.has(previewUpsellKey(offer.key, scene.sceneId)),
          available: offer.key === "print_pack" ? print.eligible : true,
          unavailableReason:
            offer.key === "print_pack" && !print.eligible ? print.reason : null,
          printMaxSizeLabel: offer.key === "print_pack" ? print.maxSizeLabel : null,
        })),
      })),
    orderUpsells: [
      {
        key: "retry_3_scenes",
        name: PET_UPSELL_OFFERS.retry_3_scenes.name,
        description: PET_UPSELL_OFFERS.retry_3_scenes.description,
        priceCents: PET_UPSELL_OFFERS.retry_3_scenes.priceCents,
        currency: "usd",
        scope: "order",
        cta: PET_UPSELL_OFFERS.retry_3_scenes.cta,
        purchasedCta: PET_UPSELL_OFFERS.retry_3_scenes.purchasedCta,
        priceDisplay: formatUpsellPrice(PET_UPSELL_OFFERS.retry_3_scenes.priceCents),
        purchased: previewPurchasedUpsells.has("retry_3_scenes"),
        available: !previewPurchasedUpsells.has("retry_3_scenes"),
        maxScenes: 3,
      },
    ],
    purchased: [],
  };

  return {
    orderId: order.id,
    publicToken: order.publicToken,
    petName: order.petName,
    status: order.status,
    scenes: order.scenes.map((scene) => toSceneResult(scene, order.status)),
    clips: (order.clips ?? []).map((clip) => ({
      id: clip.id,
      slot: clip.slot,
      sourceSceneId: clip.sourceSceneId,
      title: clip.title,
      status: clip.status,
      previewUrl: clip.status === "ready" ? clip.previewUrl : null,
      downloadUrl: null,
      mimeType: "video/mp4",
      durationSeconds: clip.durationSeconds,
      width: null,
      height: null,
      ready: false,
    })),
    upsells,
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
      label: "QC-approved portrait",
      url: ready ? `preview://download/${sceneId}/high-res.jpg` : null,
      mimeType: "image/jpeg",
      width: null,
      height: null,
      dpi: null,
      ready,
    },
    {
      format: "wallpaper",
      label: "Phone wallpaper (Coming later)",
      url: null,
      mimeType: "image/jpeg",
      width: null,
      height: null,
      dpi: null,
      ready: false,
    },
    {
      format: "social",
      label: "Social format (Coming later)",
      url: null,
      mimeType: "image/jpeg",
      width: null,
      height: null,
      dpi: null,
      ready: false,
    },
    {
      format: "poster",
      label: "Printable poster (Coming later)",
      url: null,
      mimeType: "image/jpeg",
      width: null,
      height: null,
      dpi: null,
      ready: false,
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
