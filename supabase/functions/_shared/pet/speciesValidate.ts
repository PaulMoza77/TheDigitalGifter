/**
 * Vision-based pet species check before preview generation.
 * Records only outcome + confidence — never biometrics or customer PII.
 */

export type SpeciesLabel = "dog" | "cat" | "other" | "unclear";

export type SpeciesValidation =
  | {
      ok: true;
      action: "proceed";
      detected: SpeciesLabel;
      confidence: number;
      provider: "openai" | "skipped";
    }
  | {
      ok: false;
      action: "reject_wrong_species" | "ask_clearer";
      detected: SpeciesLabel;
      confidence: number;
      provider: "openai" | "skipped";
      errorCode: "wrong_species" | "unclear_species";
      error: string;
    };

const HIGH_CONFIDENCE = 0.72;

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
 * - Ambiguous / unclear → ask for a clearer image (do not treat as wrong species).
 * - Missing vision provider → proceed (never invent a species), with provider=skipped.
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

  const apiKey = String(Deno.env.get("OPENAI_API_KEY") || "").trim();
  const disabled =
    String(Deno.env.get("PET_SPECIES_VALIDATION") || "").toLowerCase() === "false";
  if (!apiKey || disabled) {
    return {
      ok: true,
      action: "proceed",
      detected: "unclear",
      confidence: 0,
      provider: "skipped",
    };
  }

  try {
    const result = await classifyWithOpenAi(apiKey, input.imageDataUrl);
    return decideSpeciesOutcome(input.expected, result.detected, result.confidence);
  } catch {
    // Fail open on classifier outages so previews stay available; identity path still runs.
    return {
      ok: true,
      action: "proceed",
      detected: "unclear",
      confidence: 0,
      provider: "skipped",
    };
  }
}

export function decideSpeciesOutcome(
  expected: "dog" | "cat",
  detected: SpeciesLabel,
  confidence: number,
): SpeciesValidation {
  const conf = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0;

  // High-confidence wrong species → hard stop before generation.
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
      provider: "openai",
      errorCode: "wrong_species",
      error: speciesRejectMessage(expected),
    };
  }

  // High-confidence "no clear single pet" → ask for a clearer image (not a species error).
  if (conf >= HIGH_CONFIDENCE && (detected === "unclear" || detected === "other")) {
    return {
      ok: false,
      action: "ask_clearer",
      detected,
      confidence: conf,
      provider: "openai",
      errorCode: "unclear_species",
      error: unclearSpeciesMessage(),
    };
  }

  // Matching species, or ambiguous/low-confidence: never auto-reject — proceed.
  return {
    ok: true,
    action: "proceed",
    detected,
    confidence: conf,
    provider: "openai",
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

  let parsed: { species?: string; confidence?: number } = {};
  try {
    parsed = JSON.parse(String(json.choices?.[0]?.message?.content || "{}")) as {
      species?: string;
      confidence?: number;
    };
  } catch {
    parsed = {};
  }

  const raw = String(parsed.species || "unclear").toLowerCase();
  const detected: SpeciesLabel =
    raw === "dog" || raw === "cat" || raw === "other" || raw === "unclear" ? raw : "unclear";
  const confidence = Number(parsed.confidence);
  return {
    detected,
    confidence: Number.isFinite(confidence) ? confidence : 0,
  };
}
