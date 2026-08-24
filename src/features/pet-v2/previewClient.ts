import { incrementSessionPreviewCount, remainingSessionPreviews, sessionAllowsAnotherPreview } from "./abuse";
import { PET_V2_PREVIEW_PATH, type PetV2PreviewResponse, type PetV2Species } from "./types";
import { prepareV2UploadBlob } from "./photo";
import { getPetV2SessionId } from "./session";
import { buildMockRoyalPreview, watermarkPreviewDataUrl } from "./watermark";

export async function requestV2Preview(input: {
  file: File;
  species: PetV2Species;
  sourcePreviewUrl: string;
  regenerate?: boolean;
}): Promise<PetV2PreviewResponse> {
  if (!sessionAllowsAnotherPreview()) {
    return {
      ok: false,
      mode: "mock",
      error: "This browser session already used its free previews.",
      errorCode: "rate_limited",
      remainingSession: 0,
    };
  }

  const blob = await prepareV2UploadBlob(input.file);
  const imageDataUrl = await blobToDataUrl(blob);

  let response: PetV2PreviewResponse;
  try {
    const res = await fetch(PET_V2_PREVIEW_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        species: input.species,
        session_id: getPetV2SessionId(),
        regenerate: Boolean(input.regenerate),
        scene: "royal-portrait",
        imageDataUrl,
      }),
      credentials: "same-origin",
    });
    response = (await res.json()) as PetV2PreviewResponse;
  } catch {
    response = { ok: false, mode: "mock", errorCode: "generation_failed", error: "Could not reach the preview service." };
  }

  if (response.ok && response.imageDataUrl) {
    incrementSessionPreviewCount();
    const marked = await watermarkPreviewDataUrl(response.imageDataUrl);
    return {
      ...response,
      imageDataUrl: marked,
      remainingSession: remainingSessionPreviews(),
    };
  }

  if (response.errorCode === "live_disabled") {
    incrementSessionPreviewCount();
    const mock = await buildMockRoyalPreview(input.sourcePreviewUrl);
    return {
      ok: true,
      mode: "mock",
      imageDataUrl: mock,
      remainingSession: remainingSessionPreviews(),
      estimatedSeconds: 0,
    };
  }

  return { ...response, remainingSession: remainingSessionPreviews() };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read that photo."));
    reader.readAsDataURL(blob);
  });
}
