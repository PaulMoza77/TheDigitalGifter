import { getPublicSupabaseConfig } from "@/lib/env";
import { incrementSessionPreviewCount, remainingSessionPreviews, sessionAllowsAnotherPreview } from "./abuse";
import { PET_V3_FUNNEL_VERSION, PET_V3_PREVIEW_EDGE_PATH, PET_V3_PREVIEW_SCENE, PET_V3_SPECIES, type PetV3FailureCategory, type PetV3PreviewResponse } from "./types";
import { prepareV2UploadBlob } from "../pet-v2/photo";
import { getPetV3SessionId } from "./session";
import { previewErrorMessage } from "../pet-v2/previewErrors";
import { buildMockRoyalCatPreview, watermarkPreviewDataUrl } from "./watermark";

export async function requestV3Preview(input: {
  file: File;
  sourcePreviewUrl: string;
  regenerate?: boolean;
  idempotencyKey: string;
}): Promise<PetV3PreviewResponse> {
  if (!sessionAllowsAnotherPreview()) {
    return {
      ok: false,
      mode: "mock",
      error: "This browser session already used its free previews.",
      errorCode: "rate_limited",
      failureCategory: "rate_limit",
      remainingSession: 0,
    };
  }

  const blob = await prepareV2UploadBlob(input.file);
  const imageDataUrl = await blobToDataUrl(blob);

  let response: PetV3PreviewResponse;
  try {
    const { url, anon } = getPublicSupabaseConfig();
    const res = await fetch(`${url.replace(/\/$/, "")}${PET_V3_PREVIEW_EDGE_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({
        species: PET_V3_SPECIES,
        funnel_version: PET_V3_FUNNEL_VERSION,
        session_id: getPetV3SessionId(),
        regenerate: Boolean(input.regenerate),
        scene: PET_V3_PREVIEW_SCENE,
        imageDataUrl,
        idempotency_key: input.idempotencyKey,
        preview_attempt_id: input.idempotencyKey,
      }),
    });
    const text = await res.text();
    try {
      response = JSON.parse(text) as PetV3PreviewResponse;
    } catch {
      response = {
        ok: false,
        mode: "mock",
        errorCode: "generation_failed",
        failureCategory: "server_error",
        error: "We couldn't create the preview. Try again.",
      };
    }
    if (!response.failureCategory) {
      response.failureCategory = categoryFromHttp(res.status, response);
    }
  } catch {
    response = {
      ok: false,
      mode: "mock",
      errorCode: "generation_failed",
      failureCategory: "endpoint_unreachable",
      error: "We couldn't create the preview. Try again.",
    };
  }

  if (response.ok && response.imageDataUrl) {
    if (!response.reused) {
      incrementSessionPreviewCount();
    }
    const marked = await watermarkPreviewDataUrl(response.imageDataUrl);
    return {
      ...response,
      imageDataUrl: marked,
      remainingSession: remainingSessionPreviews(),
    };
  }

  if (response.errorCode === "live_disabled") {
    incrementSessionPreviewCount();
    const mock = await buildMockRoyalCatPreview(input.sourcePreviewUrl);
    return {
      ok: true,
      mode: "mock",
      imageDataUrl: mock,
      remainingSession: remainingSessionPreviews(),
      estimatedSeconds: 0,
    };
  }

  return {
    ...response,
    error: previewErrorMessage(response),
    remainingSession: remainingSessionPreviews(),
  };
}

function categoryFromHttp(status: number, response: PetV3PreviewResponse): PetV3FailureCategory | undefined {
  if (response.failureCategory) return response.failureCategory;
  if (status === 429 || response.errorCode === "rate_limited") return "rate_limit";
  if (response.errorCode === "invalid_photo" || response.errorCode === "heic_unsupported") {
    return "invalid_image";
  }
  if (status === 401 || status === 403) return "provider_auth";
  if (status >= 500) return "server_error";
  if (response.errorCode === "generation_failed") return "provider_error";
  return undefined;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read that photo."));
    reader.readAsDataURL(blob);
  });
}
