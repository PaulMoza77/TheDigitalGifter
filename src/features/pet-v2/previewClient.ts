import { getPublicSupabaseConfig } from "@/lib/env";
import { incrementSessionPreviewCount, remainingSessionPreviews, sessionAllowsAnotherPreview } from "./abuse";
import {
  PET_V2_PREVIEW_EDGE_PATH,
  PET_V2_PREVIEW_SCENE,
  type PetV2FailureCategory,
  type PetV2PreviewResponse,
  type PetV2Species,
} from "./types";
import { prepareV2UploadBlob } from "./photo";
import { getPetV2SessionId } from "./session";
import { previewErrorMessage } from "./previewErrors";
import { buildMockF1Preview, watermarkPreviewDataUrl } from "./watermark";

export async function requestV2Preview(input: {
  file: File;
  species: PetV2Species;
  sourcePreviewUrl: string;
  regenerate?: boolean;
  idempotencyKey: string;
}): Promise<PetV2PreviewResponse> {
  if (!sessionAllowsAnotherPreview()) {
    return {
      ok: false,
      mode: "mock",
      error: "This browser session already used its free previews (2 per 24 hours). Unlock the collection, or try again in about 1 hour.",
      errorCode: "rate_limited",
      failureCategory: "rate_limit",
      rateLimitKind: "session",
      retryAfterSeconds: 3600,
      remainingSession: 0,
    };
  }

  const blob = await prepareV2UploadBlob(input.file);
  const imageDataUrl = await blobToDataUrl(blob);

  let response: PetV2PreviewResponse;
  try {
    const { url, anon } = getPublicSupabaseConfig();
    const res = await fetch(`${url.replace(/\/$/, "")}${PET_V2_PREVIEW_EDGE_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({
        species: input.species,
        session_id: getPetV2SessionId(),
        regenerate: Boolean(input.regenerate),
        scene: PET_V2_PREVIEW_SCENE,
        imageDataUrl,
        idempotency_key: input.idempotencyKey,
        preview_attempt_id: input.idempotencyKey,
      }),
    });
    const text = await res.text();
    try {
      response = JSON.parse(text) as PetV2PreviewResponse;
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
    // Reused provider results must not burn another client-side free-preview slot.
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
    const mock = await buildMockF1Preview(input.sourcePreviewUrl);
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

function categoryFromHttp(status: number, response: PetV2PreviewResponse): PetV2FailureCategory | undefined {
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
