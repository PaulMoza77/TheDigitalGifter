import {
  AI_COST_PROVIDER_REPLICATE,
  createFailedPredictionId,
  mockPredictionId,
} from "./aiCost.ts";
import { PET_SKU } from "./constants.ts";

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ error: { message: string } | null }>;
};

export async function recordAiCostAttempt(
  service: RpcClient,
  input: {
    predictionId: string;
    orderId: string;
    sceneId?: string | null;
    sceneKey: string;
    attemptNumber: number;
    modelName: string;
    modelVersion?: string | null;
    isMock?: boolean;
    createFailed?: boolean;
    costNotes?: string | null;
  },
) {
  const { error } = await service.rpc("ai_cost_ledger_record_attempt", {
    p_provider: AI_COST_PROVIDER_REPLICATE,
    p_prediction_id: input.predictionId,
    p_pet_order_id: input.orderId,
    p_scene_id: input.sceneId ?? null,
    p_scene_key: input.sceneKey,
    p_attempt_number: input.attemptNumber,
    p_product_sku: PET_SKU,
    p_model_name: input.modelName,
    p_model_version: input.modelVersion ?? null,
    p_is_mock: Boolean(input.isMock),
    p_create_failed: Boolean(input.createFailed),
    p_cost_notes: input.costNotes ?? null,
  });
  if (error) {
    await service.rpc("pet_log_event", {
      p_order_id: input.orderId,
      p_action: "ai_cost_record_failed",
      p_actor_type: "system",
      p_scene_key: input.sceneKey,
      p_payload: { message: error.message, prediction_id: input.predictionId },
    });
  }
}

export async function finalizeAiCostPrediction(
  service: RpcClient,
  input: {
    predictionId: string;
    providerStatus: string;
    modelName?: string | null;
    modelVersion?: string | null;
    orderId?: string | null;
    sceneId?: string | null;
    sceneKey?: string | null;
  },
) {
  const { error } = await service.rpc("ai_cost_ledger_finalize_prediction", {
    p_provider: AI_COST_PROVIDER_REPLICATE,
    p_prediction_id: input.predictionId,
    p_provider_status: input.providerStatus,
    p_model_name: input.modelName ?? null,
    p_model_version: input.modelVersion ?? null,
    p_pet_order_id: input.orderId ?? null,
    p_scene_id: input.sceneId ?? null,
    p_scene_key: input.sceneKey ?? null,
  });
  if (error) {
    if (input.orderId) {
      await service.rpc("pet_log_event", {
        p_order_id: input.orderId,
        p_action: "ai_cost_finalize_failed",
        p_actor_type: "system",
        p_scene_key: input.sceneKey ?? null,
        p_payload: { message: error.message, prediction_id: input.predictionId },
      });
    }
    throw new Error(error.message);
  }
}

export { createFailedPredictionId, mockPredictionId };
