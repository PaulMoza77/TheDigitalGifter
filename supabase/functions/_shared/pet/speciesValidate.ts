/**
 * Vision-based pet species check before preview generation.
 * Records only outcome + confidence — never biometrics or customer PII.
 *
 * Provider order:
 * 1) OpenAI (if key present and billed)
 * 2) Replicate vision (same REPLICATE_API_TOKEN as preview generation)
 * 3) Skip (fail open) so identity generation still runs when classifiers are down
 */

export type SpeciesLabel = "dog" | "cat" | "other" | "unclear";
export type SpeciesProvider = "openai" | "replicate" | "skipped";

export type SpeciesValidation =
  | {
      ok: true;
      action: "proceed";
      detected: SpeciesLabel;
      confidence: number;
      provider: SpeciesProvider;
    }
  | {
      ok: false;
      action: "reject_wrong_species" | "ask_clearer";
      detected: SpeciesLabel;
      confidence: number;
      provider: SpeciesProvider;
      errorCode: "wrong_species" | "unclear_species";
      error: string;
    };

const HIGH_CONFIDENCE = 0.72;
const DEFAULT_REPLICATE_VISION_MODEL = "lucataco/moondream2";

export function speciesRejectMessage(expected: "dog" | "cat"): string {
  return expected === "cat"
    ? "This experience is designed for cats. Please upload a clear photo of your cat."
    : "This experience is designed for dogs. Please upload a clear photo of your dog.";
}

export function unclearSpeciesMessage(): string {
  return "We couldn’t clearly see a single pet in that photo. Please upload a clearer photo with one pet facing the camera.";
}

/**
 * Validate that the uploaded image matches the funnel’s expected species.
 * - High-confidence mismatch → reject before generation.
 * - High-confidence unclear/other → ask for a clearer image.
 * - Ambiguous / low-confidence → proceed (do not auto-reject).
 * - Missing vision provider → proceed with provider=skipped.
 */
export async function validatePetSpecies(input: {
  imageDataUrl: string;
  expected: "dog" | "cat" | "other";
}): Promise<SpeciesValidation> {
  if (input.expected === "other") {
    return {
      ok: true,
      action: "proceed",
      detected: "other",
      confidence: 0,
      provider: "skipped",
    };
  }

  const disabled =
    String(Deno.env.get("PET_SPECIES_VALIDATION") || "").toLowerCase() === "false";
  if (disabled) {
    return {
      ok: true,
      action: "proceed",
      detected: "unclear",
      confidence: 0,
      provider: "skipped",
    };
  }

  const openaiKey = String(Deno.env.get("OPENAI_API_KEY") || "").trim();
  if (openaiKey) {
    try {
      const result = await classifyWithOpenAi(openaiKey, input.imageDataUrl);
      return decideSpeciesOutcome(input.expected, result.detected, result.confidence, "openai");
    } catch {
      /* fall through to Replicate */
    }
  }

  const replicateToken = String(Deno.env.get("REPLICATE_API_TOKEN") || "").trim();
  if (replicateToken) {
    try {
      const result = await classifyWithReplicate(replicateToken, input.imageDataUrl);
      return decideSpeciesOutcome(input.expected, result.detected, result.confidence, "replicate");
    } catch {
      /* fall through to skip */
    }
  }

  return {
    ok: true,
    action: "proceed",
    detected: "unclear",
    confidence: 0,
    provider: "skipped",
  };
}

export function decideSpeciesOutcome(
  expected: "dog" | "cat",
  detected: SpeciesLabel,
  confidence: number,
  provider: SpeciesProvider = "openai",
): SpeciesValidation {
  const conf = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0;

  if (
    conf >= HIGH_CONFIDENCE &&
    (detected === "dog" || detected === "cat") &&
    detected !== expected
  ) {
    return {
      ok: false,
      action: "reject_wrong_species",
      detected,
      confidence: conf,
      provider,
      errorCode: "wrong_species",
      error: speciesRejectMessage(expected),
    };
  }

  if (conf >= HIGH_CONFIDENCE && (detected === "unclear" || detected === "other")) {
    return {
      ok: false,
      action: "ask_clearer",
      detected,
      confidence: conf,
      provider,
      errorCode: "unclear_species",
      error: unclearSpeciesMessage(),
    };
  }

  return {
    ok: true,
    action: "proceed",
    detected,
    confidence: conf,
    provider,
  };
}

async function classifyWithOpenAi(
  apiKey: string,
  imageDataUrl: string,
): Promise<{ detected: SpeciesLabel; confidence: number }> {
  const model = String(Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini").trim() || "gpt-4o-mini";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 80,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Classify the primary animal in the photo. Return JSON {"species":"dog"|"cat"|"other"|"unclear","confidence":0-1}. Use unclear if no single pet is clearly visible. Do not identify breed, owner, or location.',
        },
        {
          role: "user",
          content: [
            { type: "text", text: "What species is the primary pet?" },
            { type: "image_url", image_url: { url: imageDataUrl, detail: "low" } },
          ],
        },
      ],
    }),
  });

  const json = (await res.json()) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (!res.ok) {
    throw new Error(String(json.error?.message || "species classification failed"));
  }

  return parseSpeciesPayload(String(json.choices?.[0]?.message?.content || ""));
}

async function classifyWithReplicate(
  token: string,
  imageDataUrl: string,
): Promise<{ detected: SpeciesLabel; confidence: number }> {
  const model =
    String(Deno.env.get("PET_SPECIES_VISION_MODEL") || DEFAULT_REPLICATE_VISION_MODEL).trim() ||
    DEFAULT_REPLICATE_VISION_MODEL;

  const created = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({
      input: {
        image: imageDataUrl,
        prompt:
          'Classify the primary animal. Reply with JSON only: {"species":"dog"|"cat"|"other"|"unclear","confidence":0-1}. No breed names.',
      },
    }),
  });

  let prediction = (await created.json()) as {
    id?: string;
    status?: string;
    error?: string;
    output?: unknown;
    detail?: string;
  };
  if (!created.ok && !prediction.id) {
    throw new Error(String(prediction.detail || prediction.error || "replicate vision failed"));
  }

  // Prefer: wait may still return a processing prediction — poll briefly.
  for (let i = 0; i < 20 && prediction.status && !["succeeded", "failed", "canceled"].includes(prediction.status); i += 1) {
    await new Promise((r) => setTimeout(r, 1000));
    if (!prediction.id) break;
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    prediction = (await poll.json()) as typeof prediction;
  }

  if (prediction.status === "failed" || prediction.status === "canceled") {
    throw new Error(String(prediction.error || "replicate vision failed"));
  }

  const text = outputToText(prediction.output);
  return parseSpeciesPayload(text);
}

function outputToText(output: unknown): string {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return output.map((x) => String(x)).join(" ");
  if (output && typeof output === "object") {
    const rec = output as Record<string, unknown>;
    if (typeof rec.text === "string") return rec.text;
    if (typeof rec.answer === "string") return rec.answer;
  }
  return String(output || "");
}

function parseSpeciesPayload(rawText: string): { detected: SpeciesLabel; confidence: number } {
  let parsed: { species?: string; confidence?: number } = {};
  const trimmed = String(rawText || "").trim();
  try {
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : trimmed) as {
      species?: string;
      confidence?: number;
    };
  } catch {
    const lower = trimmed.toLowerCase();
    if (/\bdog\b/.test(lower) && !/\bcat\b/.test(lower)) parsed = { species: "dog", confidence: 0.8 };
    else if (/\bcat\b/.test(lower) && !/\bdog\b/.test(lower)) parsed = { species: "cat", confidence: 0.8 };
    else if (/\bunclear\b|\bnone\b|\bperson\b/.test(lower)) parsed = { species: "unclear", confidence: 0.8 };
    else parsed = { species: "unclear", confidence: 0.4 };
  }

  const raw = String(parsed.species || "unclear").toLowerCase();
  const detected: SpeciesLabel =
    raw === "dog" || raw === "cat" || raw === "other" || raw === "unclear" ? raw : "unclear";
  const confidence = Number(parsed.confidence);
  return {
    detected,
    confidence: Number.isFinite(confidence) ? confidence : 0.75,
  };
}
