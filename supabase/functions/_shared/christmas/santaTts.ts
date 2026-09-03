/**
 * OpenAI TTS with Replicate MiniMax fallback (EN/RO).
 * Synthetic character voices — not real-person clones.
 */

import { replicateOutputUrl } from "../pet/replicate.ts";

export type SantaTtsResult = {
  bytes: Uint8Array;
  contentType: "audio/mpeg";
  model: string;
  voice: string;
  provider: string;
  estimatedCostUsd: number;
  latencyMs: number;
};

export function santaTtsVoice(): string {
  return String(Deno.env.get("CHRISTMAS_SANTA_TTS_VOICE") || "onyx").trim() || "onyx";
}

export function santaTtsModel(): string {
  return String(Deno.env.get("CHRISTMAS_SANTA_TTS_MODEL") || "tts-1-hd").trim() || "tts-1-hd";
}

function replicateTtsModel(): string {
  return (
    String(Deno.env.get("CHRISTMAS_SANTA_REPLICATE_TTS_MODEL") || "").trim() ||
    "minimax/speech-02-hd"
  );
}

async function pollPrediction(token: string, id: string): Promise<Record<string, unknown>> {
  let current: Record<string, unknown> = { id, status: "starting" };
  let guard = 0;
  while (
    current?.status &&
    !["succeeded", "failed", "canceled"].includes(String(current.status)) &&
    guard < 60
  ) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    current = await poll.json();
    guard += 1;
  }
  return current;
}

async function synthesizeViaReplicate(script: string, language: "en" | "ro"): Promise<SantaTtsResult> {
  const token = String(Deno.env.get("REPLICATE_API_TOKEN") || "").trim();
  if (!token) throw new Error("REPLICATE_API_TOKEN is not configured");
  const model = replicateTtsModel();
  const voice =
    String(Deno.env.get("CHRISTMAS_SANTA_REPLICATE_TTS_VOICE") || "").trim() ||
    "English_Trustworthy_Man";
  const started = Date.now();
  const createRes = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        text: script.slice(0, 5000),
        voice_id: voice,
        emotion: "happy",
        english_normalization: true,
        language_boost: language === "ro" ? "Romanian" : "English",
        audio_format: "mp3",
      },
    }),
  });
  let prediction = await createRes.json();
  if (!createRes.ok) {
    throw new Error(String(prediction?.detail || prediction?.error || "replicate_tts_failed"));
  }
  prediction = await pollPrediction(token, String(prediction.id));
  if (String(prediction.status) !== "succeeded") {
    throw new Error(String(prediction.error || `tts_${prediction.status}`));
  }
  const outUrl = replicateOutputUrl(prediction.output);
  if (!outUrl) throw new Error("tts_missing_url");
  const dl = await fetch(outUrl);
  if (!dl.ok) throw new Error("tts_download_failed");
  const buf = new Uint8Array(await dl.arrayBuffer());
  if (buf.byteLength < 1000) throw new Error("tts_empty");
  return {
    bytes: buf,
    contentType: "audio/mpeg",
    model,
    voice,
    provider: "replicate",
    estimatedCostUsd: Math.max(0.02, (script.length / 1000) * 0.05),
    latencyMs: Date.now() - started,
  };
}

async function synthesizeViaOpenAi(script: string): Promise<SantaTtsResult> {
  const key = String(Deno.env.get("OPENAI_API_KEY") || "").trim();
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  const model = santaTtsModel();
  const voice = santaTtsVoice();
  const started = Date.now();
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      voice,
      input: script.slice(0, 4096),
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`openai_tts_failed:${err.slice(0, 180)}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength < 1000) throw new Error("tts_empty");
  const estimatedCostUsd = Math.max(0.01, (script.length / 1000) * 0.015);
  return {
    bytes: buf,
    contentType: "audio/mpeg",
    model,
    voice,
    provider: "openai",
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(4)),
    latencyMs: Date.now() - started,
  };
}

export async function synthesizeSantaSpeech(
  script: string,
  language: "en" | "ro" = "en",
): Promise<SantaTtsResult> {
  const prefer =
    String(Deno.env.get("CHRISTMAS_SANTA_TTS_PROVIDER") || "auto").trim().toLowerCase() || "auto";
  if (prefer === "replicate") return synthesizeViaReplicate(script, language);
  if (prefer === "openai") return synthesizeViaOpenAi(script);
  try {
    return await synthesizeViaOpenAi(script);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/credit|billing|quota|openai_tts_failed|not configured/i.test(message)) {
      return await synthesizeViaReplicate(script, language);
    }
    throw err;
  }
}

/** Tiny stub for mock mode only. */
export function mockSantaSpeech(): SantaTtsResult {
  return {
    bytes: new Uint8Array([
      0xff, 0xfb, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]),
    contentType: "audio/mpeg",
    model: "mock",
    voice: "mock",
    provider: "mock",
    estimatedCostUsd: 0,
    latencyMs: 1,
  };
}
