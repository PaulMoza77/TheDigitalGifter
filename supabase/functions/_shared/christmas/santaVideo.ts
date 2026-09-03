/**
 * Compose Santa still + TTS audio into one MP4.
 * Prefers talking-head models; falls back to Replicate Seedance is insufficient for speech length.
 * Primary V1 path: server compose endpoint (ffmpeg) when configured, else inline note.
 */

import { replicateOutputUrl } from "../pet/replicate.ts";

export type SantaVideoResult = {
  outputUrl: string;
  predictionId: string;
  model: string;
  estimatedCostUsd: number;
  latencyMs: number;
  mode: "lipsync" | "still_audio_mux";
};

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

export function santaVideoModel(): string {
  return asString(Deno.env.get("CHRISTMAS_SANTA_VIDEO_MODEL")) || "cjwbw/sadtalker";
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

async function pollPrediction(token: string, id: string): Promise<Record<string, unknown>> {
  let current: Record<string, unknown> = { id, status: "starting" };
  let guard = 0;
  while (
    current?.status &&
    !["succeeded", "failed", "canceled"].includes(String(current.status)) &&
    guard < 120
  ) {
    await new Promise((r) => setTimeout(r, 3000));
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    current = await poll.json();
    guard += 1;
  }
  return current;
}

export async function generateSantaStill(input: {
  prompt: string;
}): Promise<{ bytes: Uint8Array; predictionId: string; model: string; latencyMs: number; estimatedCostUsd: number }> {
  const token = asString(Deno.env.get("REPLICATE_API_TOKEN"));
  if (!token) throw new Error("REPLICATE_API_TOKEN is not configured");
  const model = asString(Deno.env.get("CHRISTMAS_SANTA_STILL_MODEL")) || "black-forest-labs/flux-schnell";
  const started = Date.now();
  const createRes = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        prompt: input.prompt,
        aspect_ratio: "1:1",
        output_format: "jpg",
      },
    }),
  });
  let prediction = await createRes.json();
  if (!createRes.ok) {
    throw new Error(asString(prediction?.detail || prediction?.error) || "santa_still_failed");
  }
  prediction = await pollPrediction(token, String(prediction.id));
  if (String(prediction.status) !== "succeeded") {
    throw new Error(asString(prediction.error) || `still_${prediction.status}`);
  }
  const url = replicateOutputUrl(prediction.output);
  if (!url) throw new Error("still_missing_url");
  const dl = await fetch(url);
  if (!dl.ok) throw new Error("still_download_failed");
  return {
    bytes: new Uint8Array(await dl.arrayBuffer()),
    predictionId: asString(prediction.id),
    model,
    latencyMs: Date.now() - started,
    estimatedCostUsd: 0.003,
  };
}

async function tryLipsync(input: {
  imageUrl: string;
  audioUrl: string;
}): Promise<SantaVideoResult | null> {
  const token = asString(Deno.env.get("REPLICATE_API_TOKEN"));
  if (!token) return null;
  const models = [
    asString(Deno.env.get("CHRISTMAS_SANTA_VIDEO_MODEL")),
    "cjwbw/sadtalker",
    "camenduru/sadtalker",
    "pixverse/lipsync",
  ].filter(Boolean);
  const started = Date.now();
  for (const model of models) {
    try {
      const bodyInput: Record<string, unknown> = {
        source_image: input.imageUrl,
        driven_audio: input.audioUrl,
        still: true,
        use_enhancer: false,
        preprocess: "crop",
        image: input.imageUrl,
        audio: input.audioUrl,
      };
      const createRes = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: bodyInput }),
      });
      let prediction = await createRes.json();
      if (!createRes.ok) continue;
      prediction = await pollPrediction(token, String(prediction.id));
      if (String(prediction.status) !== "succeeded") continue;
      const outputUrl = replicateOutputUrl(prediction.output);
      if (!outputUrl) continue;
      return {
        outputUrl,
        predictionId: asString(prediction.id),
        model,
        estimatedCostUsd: 0.12,
        latencyMs: Date.now() - started,
        mode: "lipsync",
      };
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * V1 coherent deliverable: still portrait + full personalized TTS in one MP4.
 * Invokes origin compose endpoint (ffmpeg) when CHRISTMAS_SANTA_COMPOSE_URL is set,
 * otherwise returns null so caller can fail clearly.
 */
export async function composeStillAudioViaOrigin(input: {
  imageUrl: string;
  audioUrl: string;
  orderId: string;
}): Promise<SantaVideoResult> {
  const site = (
    Deno.env.get("SITE_URL") ||
    Deno.env.get("PUBLIC_APP_URL") ||
    Deno.env.get("CHRISTMAS_PUBLIC_ORIGIN") ||
    "https://www.thedigitalgifter.com"
  ).replace(/\/$/, "");
  const composeUrl =
    asString(Deno.env.get("CHRISTMAS_SANTA_COMPOSE_URL")) ||
    `${site}/api/christmas-santa-compose`;
  const composeSecret = asString(Deno.env.get("CHRISTMAS_SANTA_COMPOSE_SECRET"));
  const serviceKey = asString(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const auth = composeSecret || serviceKey;
  if (!auth) {
    throw new Error("santa_compose_auth_missing");
  }
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(composeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth}`,
        ...(composeSecret
          ? {
            "X-TDG-Compose-Secret": composeSecret,
            "X-Christmas-Santa-Compose-Secret": composeSecret,
          }
          : {}),
      },
      body: JSON.stringify({
        image_url: input.imageUrl,
        audio_url: input.audioUrl,
        order_id: input.orderId,
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`santa_compose_fetch_failed:${message.slice(0, 160)}`);
  }
  let json: Record<string, unknown> = {};
  try {
    json = await res.json();
  } catch {
    throw new Error(`santa_compose_bad_json:http_${res.status}`);
  }
  if (!res.ok || !json?.output_url) {
    throw new Error(
      `santa_compose_failed:http_${res.status}:${asString(json.error || json).slice(0, 200)}`,
    );
  }
  return {
    outputUrl: String(json.output_url),
    predictionId: `compose_${input.orderId}`,
    model: "ffmpeg_still_audio_mux",
    estimatedCostUsd: 0,
    latencyMs: Date.now() - started,
    mode: "still_audio_mux",
  };
}

export async function generateSantaTalkingVideo(input: {
  imageUrl: string;
  audioUrl: string;
  orderId: string;
}): Promise<SantaVideoResult> {
  const lipsync = await tryLipsync(input);
  if (lipsync) return lipsync;
  return await composeStillAudioViaOrigin(input);
}
