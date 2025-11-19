// Wrapper around Replicate's veo-3 model with retry/backoff and standardized results
import { createPrediction, pollPrediction } from "./replicate";

export type VeoInput = {
  prompt: string;
  duration?: number; // 4|6|8
  resolution?: string; // "720p"|"1080p"
  aspect_ratio?: string; // "16:9"|"9:16" etc.
  generate_audio?: boolean;
  image?: string | null;
  negative_prompt?: string | null;
  seed?: number | null;
};

export type VeoResultSuccess = { success: true; url: string; runId?: string };
export type VeoResultFail = {
  success: false;
  error: string;
  recoverable: boolean;
};

const DEFAULT_MAX_ATTEMPTS = 6;

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function isTransientError(err: any) {
  const msg = String(err?.message || err || "").toLowerCase();
  if (msg.includes("rate limit") || msg.includes("too many requests"))
    return true;
  if (msg.includes("timeout") || msg.includes("timed out")) return true;
  if (msg.includes("econnreset") || msg.includes("network")) return true;
  if (msg.match(/5\d{2}/)) return true;
  // E005 (sensitive content) is NOT transient - retrying won't help
  if (msg.includes("e005") || msg.includes("sensitive")) return false;
  return false;
}

function isContentModerationError(err: any): boolean {
  const msg = String(err?.message || err || "").toLowerCase();
  return (
    msg.includes("e005") ||
    msg.includes("sensitive") ||
    msg.includes("content policy") ||
    msg.includes("flagged")
  );
}

export async function runVeo3(
  input: VeoInput
): Promise<VeoResultSuccess | VeoResultFail> {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken)
    return {
      success: false,
      error: "Missing Replicate API token",
      recoverable: false,
    };

  let attempt = 0;
  let backoff = 1000;

  while (attempt < DEFAULT_MAX_ATTEMPTS) {
    attempt++;
    try {
      // Build the input object according to Veo-3 schema
      const payloadInput: any = {};
      payloadInput.prompt = input.prompt;
      if (typeof input.duration !== "undefined")
        payloadInput.duration = input.duration;
      if (input.resolution) payloadInput.resolution = input.resolution;
      if (input.aspect_ratio) payloadInput.aspect_ratio = input.aspect_ratio;
      if (typeof input.generate_audio !== "undefined")
        payloadInput.generate_audio = input.generate_audio;
      if (input.image) payloadInput.image = input.image;
      if (input.negative_prompt)
        payloadInput.negative_prompt = input.negative_prompt;
      if (typeof input.seed === "number") payloadInput.seed = input.seed;

      // Create prediction (shared helper handles version lookup and POST)
      const prediction = await createPrediction(
        apiToken,
        "google/veo-3",
        payloadInput
      );

      // Poll for completion (shared helper encapsulates polling + error sanitization)
      const completed = await pollPrediction(apiToken, prediction.id);

      if (completed.status === "succeeded") {
        const out = (completed as any).output;
        if (!out) throw new Error("No output in prediction result");
        let url: string | undefined;
        if (typeof out === "string") url = out;
        else if (Array.isArray(out) && out.length > 0) url = out[0];
        else if ((completed as any).urls?.get)
          url = (completed as any).urls.get;
        if (!url) throw new Error("Prediction succeeded but no URL found");
        return { success: true, url, runId: prediction.id };
      }

      if (completed.status === "failed" || completed.status === "canceled") {
        const err =
          (completed as any).error || `Prediction ${completed.status}`;

        // Check for content moderation errors (E005)
        if (isContentModerationError(err)) {
          return {
            success: false,
            error:
              "Content was flagged as sensitive by Replicate's moderation system. Please try with different prompts or images. Avoid detailed descriptions of faces, bodies, or people in prompts.",
            recoverable: false,
          };
        }

        const transient = isTransientError(err);
        return { success: false, error: String(err), recoverable: transient };
      }

      // Unexpected status: treat as transient and allow retry
      return {
        success: false,
        error: `Unexpected prediction status: ${(completed as any).status}`,
        recoverable: true,
      };
    } catch (err: any) {
      const msg = String(err?.message || err || "");

      // Check for content moderation errors (E005) - don't retry these
      if (isContentModerationError(err)) {
        return {
          success: false,
          error:
            "Content was flagged as sensitive by Replicate's moderation system. Please try with different prompts or images. Avoid detailed descriptions of faces, bodies, or people in prompts.",
          recoverable: false,
        };
      }

      const transient = isTransientError(err) || err?.name === "AbortError";
      if (!transient) return { success: false, error: msg, recoverable: false };
      if (attempt >= DEFAULT_MAX_ATTEMPTS)
        return { success: false, error: msg, recoverable: true };
      await sleep(backoff);
      backoff *= 2;
      continue;
    }
  }

  return {
    success: false,
    error: "Exceeded retry attempts",
    recoverable: true,
  };
}
