import type { ObjectiveOption, ScoreDimensions } from "./types";

/**
 * Viral scoring is a documented weighted mean of dimension scores.
 * The model may propose 0–100 dimension scores; `overall` from the model is ignored.
 *
 * Dimensions:
 *   hook          opening strength in the first 1–3 seconds
 *   retention     reason to keep watching through the cut
 *   emotion       felt reaction (warmth, surprise, tension)
 *   humor         punchline / comedic timing
 *   visual        motion, faces, scene interest
 *   standalone    makes sense without the rest of the source
 *   shareability  "send this to someone" potential
 */
export const SCORE_WEIGHTS: Record<ObjectiveOption, ScoreDimensions> = {
  auto: { hook: 0.22, retention: 0.16, emotion: 0.12, humor: 0.08, visual: 0.14, standalone: 0.14, shareability: 0.14 },
  viral: { hook: 0.24, retention: 0.16, emotion: 0.1, humor: 0.1, visual: 0.14, standalone: 0.12, shareability: 0.14 },
  funny: { hook: 0.16, retention: 0.14, emotion: 0.08, humor: 0.28, visual: 0.12, standalone: 0.1, shareability: 0.12 },
  emotional: { hook: 0.16, retention: 0.14, emotion: 0.28, humor: 0.04, visual: 0.12, standalone: 0.12, shareability: 0.14 },
  educational: { hook: 0.16, retention: 0.18, emotion: 0.08, humor: 0.04, visual: 0.1, standalone: 0.24, shareability: 0.2 },
  storytelling: { hook: 0.16, retention: 0.18, emotion: 0.16, humor: 0.06, visual: 0.1, standalone: 0.22, shareability: 0.12 },
  inspirational: { hook: 0.16, retention: 0.14, emotion: 0.22, humor: 0.04, visual: 0.1, standalone: 0.14, shareability: 0.2 },
  christmas: { hook: 0.16, retention: 0.12, emotion: 0.18, humor: 0.08, visual: 0.2, standalone: 0.1, shareability: 0.16 },
};

export function clampScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function normalizeDimensions(raw: Partial<ScoreDimensions> | Record<string, unknown> | null | undefined): ScoreDimensions {
  const src = raw || {};
  return {
    hook: clampScore(src.hook ?? (src as { HOOK_SCORE?: number }).HOOK_SCORE),
    retention: clampScore(src.retention ?? (src as { RETENTION_SCORE?: number }).RETENTION_SCORE),
    emotion: clampScore(src.emotion ?? (src as { EMOTION_SCORE?: number }).EMOTION_SCORE),
    humor: clampScore(src.humor ?? (src as { HUMOR_SCORE?: number }).HUMOR_SCORE),
    visual: clampScore(src.visual ?? (src as { VISUAL_SCORE?: number }).VISUAL_SCORE),
    standalone: clampScore(src.standalone ?? (src as { STANDALONE_CONTEXT_SCORE?: number }).STANDALONE_CONTEXT_SCORE),
    shareability: clampScore(src.shareability ?? (src as { SHAREABILITY_SCORE?: number }).SHAREABILITY_SCORE),
  };
}

export function overallViralScore(scores: ScoreDimensions, objective: ObjectiveOption = "auto"): number {
  const weights = SCORE_WEIGHTS[objective] || SCORE_WEIGHTS.auto;
  const weighted =
    scores.hook * weights.hook +
    scores.retention * weights.retention +
    scores.emotion * weights.emotion +
    scores.humor * weights.humor +
    scores.visual * weights.visual +
    scores.standalone * weights.standalone +
    scores.shareability * weights.shareability;
  return clampScore(weighted);
}

export function extraSignalBonus(raw: Record<string, unknown> | null | undefined): number {
  const src = raw || {};
  const surprise = clampScore(src.surprise);
  const quotability = clampScore(src.quotability);
  const payoff = clampScore(src.payoff ?? src.story_payoff);
  const information = clampScore(src.information ?? src.information_density);
  const objectiveFit = clampScore(src.objective_fit ?? src.relevance);
  return Math.round((surprise + quotability + payoff + information + objectiveFit) / 5 / 12);
}

export function durationFitPenalty(duration: number, target: "auto" | "10-20" | "20-30" | "30-60"): number {
  if (target === "auto") {
    if (duration < 8) return 18;
    if (duration > 58) return 12;
    if (duration >= 12 && duration <= 35) return 0;
    return 6;
  }
  const [lo, hi] = target.split("-").map(Number);
  if (duration < lo - 2 || duration > hi + 4) return 22;
  if (duration < lo || duration > hi) return 8;
  return 0;
}
