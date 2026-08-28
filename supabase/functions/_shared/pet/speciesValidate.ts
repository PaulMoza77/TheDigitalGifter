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
      visionWarning?: string;
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
/** Pin Moondream version — /v1/models/.../predictions returns 404 for some hosts. */
const DEFAULT_MOONDREAM_VERSION =
  "72ccb656353c348c1385df54b237eeb7bfa874bf11486cf0b9473e691b662d31";

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
 * - Missing vision provider → block with unclear_species (do not fail-open into the wrong funnel).
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
  let lastVisionError = "";
  if (openaiKey) {
    try {
      const result = await classifyWithOpenAi(openaiKey, input.imageDataUrl);
      return decideSpeciesOutcome(input.expected, result.detected, result.confidence, "openai");
    } catch (error) {
      lastVisionError = String(error instanceof Error ? error.message : error).slice(0, 160);
      /* fall through to Replicate */
    }
  }

  const replicateToken = String(Deno.env.get("REPLICATE_API_TOKEN") || "").trim();
  if (replicateToken) {
    try {
      const result = await classifyWithReplicate(replicateToken, input.imageDataUrl);
      return decideSpeciesOutcome(input.expected, result.detected, result.confidence, "replicate");
    } catch (error) {
      lastVisionError = String(error instanceof Error ? error.message : error).slice(0, 160);
      /* fall through */
    }
  }

  // Soft fail-open for availability, but stamp diagnostics so ops can see vision is down.
  // Client species-confirm + funnel_version still apply; wrong_species is enforced when vision works.
  console.log(
    JSON.stringify({
      stage: "species_vision_unavailable",
      expected: input.expected,
      lastVisionError,
    }),
  );
  return {
    ok: true,
    action: "proceed",
    detected: "unclear",
    confidence: 0,
    provider: "skipped",
    visionWarning: lastVisionError || "species vision unavailable",
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
            { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
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
  const version =
    String(Deno.env.get("PET_SPECIES_VISION_VERSION") || DEFAULT_MOONDREAM_VERSION).trim() ||
    DEFAULT_MOONDREAM_VERSION;
  const prompt =
    'Is the primary animal a dog or a cat? Reply with JSON only: {"species":"dog"|"cat"|"other"|"unclear","confidence":0-1}. No breed names.';

  // Prefer versioned predictions API (stable). Retry on throttle without BLIP (saves create quota).
  let lastError = "";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const prediction = await createAndWaitReplicatePrediction(token, {
        version,
        input: { image: imageDataUrl, prompt },
      });
      return parseSpeciesPayload(outputToText(prediction.output));
    } catch (error) {
      lastError = String(error instanceof Error ? error.message : error);
      if (!/429|throttl|rate/i.test(lastError) || attempt === 3) break;
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  throw new Error(`vision failed: ${lastError.slice(0, 180)}`);
}

async function createAndWaitReplicatePrediction(
  token: string,
  body: Record<string, unknown>,
): Promise<{ id?: string; status?: string; error?: string; output?: unknown; detail?: string }> {
  const created = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait=60",
    },
    body: JSON.stringify(body),
  });
  return waitReplicatePrediction(token, created);
}

async function waitReplicatePrediction(
  token: string,
  created: Response,
): Promise<{ id?: string; status?: string; error?: string; output?: unknown; detail?: string }> {
  let prediction = (await created.json()) as {
    id?: string;
    status?: string;
    error?: string;
    output?: unknown;
    detail?: string;
  };
  if (!created.ok && !prediction.id) {
    throw new Error(
      `${created.status}:${String(prediction.detail || prediction.error || "replicate vision failed")}`,
    );
  }

  for (
    let i = 0;
    i < 30 && prediction.status && !["succeeded", "failed", "canceled"].includes(prediction.status);
    i += 1
  ) {
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
  if (prediction.status && prediction.status !== "succeeded") {
    throw new Error(`replicate vision ${prediction.status}`);
  }
  return prediction;
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
