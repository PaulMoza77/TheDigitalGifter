import { readFileSync } from "node:fs";
import type { ImageQcVerdict } from "./types";

function openaiKey(): string {
  return String(process.env.OPENAI_API_KEY || "").trim();
}

export function imageQcConfigured(): boolean {
  return openaiKey().length > 0;
}

async function openaiJson(body: Record<string, unknown>) {
  const key = openaiKey();
  if (!key) throw new Error("OPENAI_API_KEY missing");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(json?.error?.message || `openai_${res.status}`));
  return json;
}

export async function runImageQualityGate(input: {
  imagePath: string;
  imagePrompt: string;
}): Promise<{ verdict: ImageQcVerdict; reason: string }> {
  const bytes = readFileSync(input.imagePath);
  const b64 = bytes.toString("base64");
  const mime = input.imagePath.endsWith(".png") ? "image/png" : "image/jpeg";
  const response = await openaiJson({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a strict visual QC gate for TDG 9:16 photoreal Christmas short-form stills. Respond JSON { verdict: PASS|REGENERATE|REJECT, reason: string }. PASS only if subject clarity, composition, realism, geometry, lighting, and motion suitability are strong with no obvious AI artifacts or text/logos.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: `Prompt:\n${input.imagePrompt}\nEvaluate this generated still.` },
          { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
        ],
      },
    ],
  });
  const content = String(response?.choices?.[0]?.message?.content || "{}");
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    parsed = {};
  }
  const verdictRaw = String(parsed.verdict || "REGENERATE").toUpperCase();
  const verdict: ImageQcVerdict =
    verdictRaw === "PASS" || verdictRaw === "REJECT" || verdictRaw === "REGENERATE" ? (verdictRaw as ImageQcVerdict) : "REGENERATE";
  const reason = String(parsed.reason || verdictRaw).slice(0, 500);
  return { verdict, reason };
}

export async function generatePromptPack(input: {
  concept: string;
  hook: string;
  conceptDescription: string;
  conceptFamily: string;
  clipCount: number;
}): Promise<{ imagePrompts: string[]; motionPrompts: string[] }> {
  const response = await openaiJson({
    model: "gpt-4o-mini",
    temperature: 0.5,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Create paired image+motion prompts for a vertical Christmas short-form reel. Return JSON { clips: [{ scene_label, image_prompt, motion_prompt }] } with exactly the requested clip count. Image and motion must be designed together.",
      },
      {
        role: "user",
        content: JSON.stringify({
          concept_family: input.conceptFamily,
          concept: input.concept,
          hook: input.hook,
          description: input.conceptDescription,
          clip_count: input.clipCount,
        }),
      },
    ],
  });
  const content = String(response?.choices?.[0]?.message?.content || "{}");
  const parsed = JSON.parse(content) as { clips?: Array<Record<string, unknown>> };
  const clips = Array.isArray(parsed.clips) ? parsed.clips : [];
  const imagePrompts: string[] = [];
  const motionPrompts: string[] = [];
  for (let i = 0; i < input.clipCount; i += 1) {
    const row = clips[i] || {};
    imagePrompts.push(String(row.image_prompt || row.imagePrompt || `${input.concept} scene ${i + 1}`));
    motionPrompts.push(String(row.motion_prompt || row.motionPrompt || "Slow cinematic push-in with natural snowfall."));
  }
  return { imagePrompts, motionPrompts };
}
