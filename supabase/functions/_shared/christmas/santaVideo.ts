/**
 * Santa still + video through the production Higgsfield client.
 * Video uses the verified Kling image-to-video contract (duration 5, sound off).
 */

import {
  generateChristmasHiggsfieldImage,
  generateChristmasHiggsfieldVideo,
} from "./higgsfield.ts";

export type SantaVideoResult = {
  outputUrl: string;
  predictionId: string;
  model: string;
  estimatedCostUsd: number;
  latencyMs: number;
  mode: "higgsfield_video";
};

const SANTA_REFERENCE_URL =
  "https://www.thedigitalgifter.com/assets/christmas/santa/santa-static.png";

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

export function santaVideoModel(): string {
  return asString(Deno.env.get("CHRISTMAS_SANTA_VIDEO_MODEL")) ||
    "kling-video/v3.0/pro/image-to-video";
}

export function santaStillPrompt(templateKey: string): string {
  const base =
    "Photoreal portrait of a warm classic Santa Claus, friendly eyes, full white beard, red suit with white trim, soft Christmas living-room bokeh, looking at camera, natural skin texture, no text, no watermark, no extra people.";
  switch (templateKey) {
    case "santa_workshop":
      return `${base} Background hints of a cozy toy workshop.`;
    case "santa_fireplace":
      return `${base} Soft fireplace glow.`;
    case "north_pole":
      return `${base} Soft snowy North Pole ambience.`;
    case "funny_santa":
      return `${base} A gentle playful smile.`;
    case "magical_santa":
      return `${base} Soft magical fairy-light sparkle in bokeh.`;
    default:
      return base;
  }
}

async function withRetries<T>(label: string, run: () => Promise<T>): Promise<T> {
  let last: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await run();
    } catch (err) {
      last = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  }
  throw last || new Error(label);
}

export async function generateSantaStill(input: {
  prompt: string;
}): Promise<{ bytes: Uint8Array; predictionId: string; model: string; latencyMs: number; estimatedCostUsd: number }> {
  const started = Date.now();
  const generated = await withRetries("santa_still_failed", () =>
    generateChristmasHiggsfieldImage(
      Deno.env,
      input.prompt,
      SANTA_REFERENCE_URL,
      SANTA_REFERENCE_URL,
    ));
  const dl = await fetch(generated.outputUrl);
  if (!dl.ok) throw new Error("still_download_failed");
  return {
    bytes: new Uint8Array(await dl.arrayBuffer()),
    predictionId: generated.predictionId,
    model: generated.model,
    latencyMs: Date.now() - started,
    estimatedCostUsd: 0.04,
  };
}

export function santaVideoPrompt(script: string): string {
  const spoken = asString(script).replace(/\s+/g, " ").slice(0, 400);
  return [
    "Photoreal cinematic 5 second Christmas video of this exact Santa portrait.",
    "Santa looks at the camera with a warm smile, subtle natural head movement and breathing.",
    "Soft fireplace bokeh, gentle snowfall. Preserve the face, beard, suit, and background.",
    "No morphing, no extra people, no readable text, no watermark, no captions.",
    spoken ? `Greeting mood from this message: ${spoken}` : "",
  ].filter(Boolean).join(" ");
}

export async function generateSantaTalkingVideo(input: {
  imageUrl: string;
  imageBytes?: { bytes: Uint8Array; contentType: string };
  audioUrl?: string;
  orderId: string;
  prompt?: string;
  requestId?: string | null;
  onSubmitted?: (id: string, model: string) => Promise<void>;
}): Promise<SantaVideoResult> {
  const started = Date.now();
  const prompt = asString(input.prompt) || santaVideoPrompt("");
  const generated = await withRetries("santa_video_failed", () =>
    generateChristmasHiggsfieldVideo(
      Deno.env,
      input.imageUrl,
      prompt,
      {
        requestId: input.requestId || null,
        onSubmitted: input.onSubmitted,
      },
      input.imageBytes,
    ));
  return {
    outputUrl: generated.outputUrl,
    predictionId: generated.predictionId,
    model: generated.model,
    estimatedCostUsd: 0.28,
    latencyMs: Date.now() - started,
    mode: "higgsfield_video",
  };
}
