/** Christmas adapter over TDG's existing production Higgsfield client. */
import {
  higgsfieldJson,
  submitHiggsfieldImage,
  pollHiggsfieldImage,
  uploadBytesToHiggsfield,
} from "../higgsfieldClient.ts";
import {
  readHiggsfieldAuthorization,
  higgsfieldImageRequest,
  HIGGSFIELD_IMAGE_MODEL,
  isTerminalHiggsfieldStatus,
  isSuccessfulHiggsfieldStatus,
} from "../higgsfieldImage.ts";
export const CHRISTMAS_HIGGSFIELD_VIDEO_MODEL =
  "kling-video/v3.0/pro/image-to-video";
export class HiggsfieldTerminalFailure extends Error {}
type RequestRecovery = {
  requestId?: string | null;
  onSubmitted?: (id: string, model: string) => Promise<void>;
};
type Env = { get(name: string): string | undefined };
function authorization(env: Env) {
  const value = readHiggsfieldAuthorization(env);
  if (!value) throw new Error("TDG Higgsfield credentials are not configured");
  return value;
}
export async function generateChristmasHiggsfieldImage(
  env: Env,
  prompt: string,
  sourceUrl: string,
  templateUrl: string,
  recovery: RequestRecovery = {},
  sourceBytes?: { bytes: Uint8Array; contentType: string },
) {
  const auth = authorization(env);
  let imageUrl = sourceUrl;
  if (sourceBytes?.bytes?.byteLength) {
    imageUrl = await uploadBytesToHiggsfield(
      auth,
      sourceBytes.bytes,
      sourceBytes.contentType || "image/png",
    );
  }
  const request = higgsfieldImageRequest({
    prompt,
    aspectRatio: "9:16",
    imageReferences: [imageUrl, templateUrl],
  });
  const id =
    recovery.requestId ||
    (await submitHiggsfieldImage(auth, request.path, request.body));
  if (!recovery.requestId)
    await recovery.onSubmitted?.(id, HIGGSFIELD_IMAGE_MODEL);
  const result = await pollHiggsfieldImage(auth, id, fetch, {
    maxAttempts: 60,
    sleepMs: 2000,
  });
  if (result.failed)
    throw new HiggsfieldTerminalFailure(
      `Higgsfield image generation failed (${result.status || "failed"})`,
    );
  if (!result.done || !result.imageUrl)
    throw new Error("Higgsfield image did not complete successfully");
  return {
    predictionId: id,
    outputUrl: result.imageUrl,
    model: HIGGSFIELD_IMAGE_MODEL,
  };
}
function higgsfieldVideoUrl(current: Record<string, unknown>): string {
  const direct = [current.video_url, current.url, current.output_url];
  for (const value of direct) {
    if (typeof value === "string" && value.startsWith("https://")) return value;
  }
  for (const key of ["video", "output"]) {
    const nested = current[key];
    if (typeof nested === "string" && nested.startsWith("https://")) return nested;
    if (nested && typeof nested === "object" && typeof (nested as { url?: unknown }).url === "string") {
      const url = String((nested as { url: string }).url);
      if (url.startsWith("https://")) return url;
    }
  }
  for (const key of ["videos", "images"]) {
    const list = current[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (typeof item === "string" && item.startsWith("https://")) return item;
      if (item && typeof item === "object" && typeof (item as { url?: unknown }).url === "string") {
        const url = String((item as { url: string }).url);
        if (url.startsWith("https://")) return url;
      }
    }
  }
  return "";
}

export async function generateChristmasHiggsfieldVideo(
  env: Env,
  imageUrl: string,
  prompt: string,
  recovery: RequestRecovery = {},
  imageBytes?: { bytes: Uint8Array; contentType: string },
) {
  const auth = authorization(env);
  if (imageBytes?.bytes?.byteLength) {
    imageUrl = await uploadBytesToHiggsfield(
      auth,
      imageBytes.bytes,
      imageBytes.contentType || "image/jpeg",
    );
  }
  let id = String(recovery.requestId || "");
  if (!id) {
    let submitted: Record<string, unknown> | null = null;
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        submitted = await higgsfieldJson(
          auth,
          "POST",
          `/${CHRISTMAS_HIGGSFIELD_VIDEO_MODEL}`,
          { image_url: imageUrl, prompt, duration: 5, sound: "off" },
        );
        id = String(submitted.request_id || "");
        if (!id) throw new Error("Higgsfield returned no video request identity");
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        id = "";
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
      }
    }
    if (!id) throw lastError || new Error("Higgsfield returned no video request identity");
    await recovery.onSubmitted?.(id, CHRISTMAS_HIGGSFIELD_VIDEO_MODEL);
  }
  for (let attempt = 0; attempt < 90; attempt++) {
    const current = await higgsfieldJson(
      auth,
      "GET",
      `/requests/${encodeURIComponent(id)}/status`,
    );
    if (isTerminalHiggsfieldStatus(String(current.status || ""))) {
      if (!isSuccessfulHiggsfieldStatus(String(current.status)))
        throw new HiggsfieldTerminalFailure(
          "Higgsfield video generation failed",
        );
      const outputUrl = higgsfieldVideoUrl(current);
      if (!/^https:\/\//.test(outputUrl))
        throw new Error("Higgsfield returned no video output");
      return {
        predictionId: id,
        outputUrl,
        model: CHRISTMAS_HIGGSFIELD_VIDEO_MODEL,
      };
    }
    if (attempt < 89) await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error("Higgsfield video timed out");
}
