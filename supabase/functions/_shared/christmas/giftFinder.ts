/**
 * Server-owned Gift Finder recommendation engine.
 * Browser never supplies system prompts.
 */

import {
  CURATED_MODEL,
  curatedIdeas,
  filterSafeIdeas,
  parseIdeas,
  systemPrompt,
  userPayload,
  validateFinderInput,
  type FinderInput,
  type GiftIdea,
} from "./giftFinderCore.ts";

export {
  curatedIdeas,
  filterSafeIdeas,
  validateFinderInput,
  type FinderInput,
  type GiftIdea,
};

export type FinderGeneration = {
  ideas: GiftIdea[];
  provider: string;
  model: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  costState: "actual" | "estimated" | "unknown" | "none";
  usedFallback: boolean;
};

function curatedResult(value: FinderInput, model: string, latencyMs: number): FinderGeneration {
  return {
    ideas: curatedIdeas(value),
    provider: "curated",
    model,
    latencyMs,
    inputTokens: null,
    outputTokens: null,
    costUsd: 0,
    costState: "none",
    usedFallback: true,
  };
}

export async function generateGiftIdeas(input: FinderInput): Promise<FinderGeneration> {
  const validated = validateFinderInput(input);
  if (!validated.ok) throw new Error(validated.error);
  const value = validated.value;

  const key = String(Deno.env.get("OPENAI_API_KEY") || "").trim();
  const forceCurated =
    String(Deno.env.get("CHRISTMAS_GIFT_FINDER_MODE") || "").toLowerCase() === "curated";
  if (!key || forceCurated) {
    return curatedResult(value, CURATED_MODEL, 0);
  }

  const model = String(Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini").trim() || "gpt-4o-mini";
  const started = Date.now();
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt(value.locale) },
          { role: "user", content: userPayload(value) },
        ],
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      const msg = String(json?.error?.message || res.status);
      if (/credit|billing|quota|rate/i.test(msg)) {
        return curatedResult(value, `${CURATED_MODEL}_openai_fallback`, Date.now() - started);
      }
      throw new Error(msg || "openai_gift_finder_failed");
    }
    const content = String(json.choices?.[0]?.message?.content || "");
    let ideas = filterSafeIdeas(parseIdeas(content), value.ageRangeKey).slice(0, 8);
    let usedFallback = false;
    if (ideas.length < 3) {
      ideas = curatedIdeas(value);
      usedFallback = true;
    }
    const inTok = Number(json.usage?.prompt_tokens) || null;
    const outTok = Number(json.usage?.completion_tokens) || null;
    let costUsd: number | null = null;
    let costState: FinderGeneration["costState"] = "unknown";
    if (inTok != null && outTok != null) {
      costUsd = inTok * 0.00000015 + outTok * 0.0000006;
      costState = "estimated";
    }
    return {
      ideas,
      provider: usedFallback ? "curated" : "openai",
      model: usedFallback ? `${CURATED_MODEL}_openai_fallback` : model,
      latencyMs: Date.now() - started,
      inputTokens: usedFallback ? null : inTok,
      outputTokens: usedFallback ? null : outTok,
      costUsd: usedFallback ? 0 : costUsd,
      costState: usedFallback ? "none" : costState,
      usedFallback,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/credit|billing|quota|openai|fetch/i.test(message)) {
      return curatedResult(value, `${CURATED_MODEL}_openai_fallback`, Date.now() - started);
    }
    throw err;
  }
}
