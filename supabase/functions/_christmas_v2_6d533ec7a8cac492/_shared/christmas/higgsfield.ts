/** Christmas adapter over TDG's existing production Higgsfield client. */
import {
  higgsfieldJson,
  submitHiggsfieldImage,
  pollHiggsfieldImage,
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
) {
  const auth = authorization(env);
  const request = higgsfieldImageRequest({
    prompt,
    aspectRatio: "9:16",
    imageReferences: [sourceUrl, templateUrl],
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
    throw new HiggsfieldTerminalFailure("Higgsfield image generation failed");
  if (!result.done || !result.imageUrl)
    throw new Error("Higgsfield image did not complete successfully");
  return {
    predictionId: id,
    outputUrl: result.imageUrl,
    model: HIGGSFIELD_IMAGE_MODEL,
  };
}
export async function generateChristmasHiggsfieldVideo(
  env: Env,
  imageUrl: string,
  prompt: string,
  recovery: RequestRecovery = {},
) {
  const auth = authorization(env);
  const submitted = recovery.requestId
    ? { request_id: recovery.requestId }
    : await higgsfieldJson(
        auth,
        "POST",
        `/${CHRISTMAS_HIGGSFIELD_VIDEO_MODEL}`,
        { image_url: imageUrl, prompt, duration: 5, sound: "off" },
      );
  const id = String(submitted.request_id || "");
  if (!id) throw new Error("Higgsfield returned no video request identity");
  if (!recovery.requestId)
    await recovery.onSubmitted?.(id, CHRISTMAS_HIGGSFIELD_VIDEO_MODEL);
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
      const outputUrl =
        typeof current.video_url === "string"
          ? current.video_url
          : current.video && typeof current.video === "object"
            ? String((current.video as { url?: string }).url || "")
            : "";
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
