/**
 * Node twin of supabase/functions/_shared/christmas/costLedger.ts
 */
import {
  CHRISTMAS_SOUL_V2_IMAGE_MODEL,
  CHRISTMAS_KLING_3_PRO_VIDEO_MODEL,
  christmasImageModel,
  christmasVideoModel,
  christmasImageProvider,
  christmasVideoProvider,
} from "./constants";

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export function christmasFailedPredictionId(input: {
  kind: "image" | "video";
  orderId: string;
  assetId: string;
  attempt: number;
}): string {
  return `failed:christmas_v2:${input.kind}:${input.orderId}:${input.assetId}:${input.attempt}`;
}

export async function recordChristmasV2ImageCost(
  service: RpcClient,
  input: {
    predictionId: string;
    orderId: string;
    sceneId: string;
    sceneKey: string;
    attemptNumber: number;
    productSku: string;
    providerStatus: string;
    modelName?: string | null;
    isMock?: boolean;
    isRetry?: boolean;
    costNotes?: string | null;
  },
): Promise<void> {
  const { error } = await service.rpc("christmas_v2_ai_cost_ledger_record_attempt", {
    p_provider: christmasImageProvider(),
    p_prediction_id: input.predictionId,
    p_order_id: input.orderId,
    p_scene_id: input.sceneId,
    p_video_id: null,
    p_scene_key: input.sceneKey,
    p_attempt_number: input.attemptNumber,
    p_product_sku: input.productSku,
    p_model_name: input.modelName || christmasImageModel() || CHRISTMAS_SOUL_V2_IMAGE_MODEL,
    p_media_type: "image",
    p_provider_status: input.providerStatus,
    p_is_mock: Boolean(input.isMock),
    p_is_retry: Boolean(input.isRetry),
    p_estimated_unit_cost_usd: null,
    p_cost_notes: input.costNotes ?? null,
  });
  if (error) {
    console.error("christmas_v2 image cost ledger failed", {
      orderId: input.orderId,
      message: error.message,
      prediction_id: input.predictionId,
    });
  }
}

export async function recordChristmasV2VideoCost(
  service: RpcClient,
  input: {
    predictionId: string;
    orderId: string;
    videoId: string;
    sceneKey: string;
    attemptNumber: number;
    productSku: string;
    providerStatus: string;
    modelName?: string | null;
    isMock?: boolean;
    isRetry?: boolean;
    costNotes?: string | null;
  },
): Promise<void> {
  const { error } = await service.rpc("christmas_v2_ai_cost_ledger_record_attempt", {
    p_provider: christmasVideoProvider(),
    p_prediction_id: input.predictionId,
    p_order_id: input.orderId,
    p_scene_id: null,
    p_video_id: input.videoId,
    p_scene_key: input.sceneKey,
    p_attempt_number: input.attemptNumber,
    p_product_sku: input.productSku,
    p_model_name: input.modelName || christmasVideoModel() || CHRISTMAS_KLING_3_PRO_VIDEO_MODEL,
    p_media_type: "video",
    p_provider_status: input.providerStatus,
    p_is_mock: Boolean(input.isMock),
    p_is_retry: Boolean(input.isRetry),
    p_estimated_unit_cost_usd: null,
    p_cost_notes: input.costNotes ?? null,
  });
  if (error) {
    console.error("christmas_v2 video cost ledger failed", {
      orderId: input.orderId,
      message: error.message,
      prediction_id: input.predictionId,
    });
  }
}
