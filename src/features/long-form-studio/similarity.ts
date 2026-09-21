import type { ExistingProductionFingerprint, LongFormConfig, SimilarityReport } from "./types";

function overlapRatio(a: string[], b: string[]): number {
  if (!a.length && !b.length) return 1;
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  const hit = a.filter((id) => setB.has(id)).length;
  return hit / Math.max(a.length, b.length);
}

function orderSimilarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const n = Math.min(a.length, b.length);
  let same = 0;
  for (let i = 0; i < n; i += 1) if (a[i] === b[i]) same += 1;
  return same / Math.max(a.length, b.length);
}

function durationBucket(seconds: number): number {
  if (seconds <= 3600) return 1;
  if (seconds <= 10800) return 3;
  if (seconds <= 21600) return 6;
  if (seconds <= 28800) return 8;
  return 12;
}

export function similarityScore(a: LongFormConfig, b: LongFormConfig): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const scene = overlapRatio(a.sceneIds, b.sceneIds);
  const sequence = orderSimilarity(a.sceneSequence, b.sceneSequence);
  const musicSet = overlapRatio(a.musicTrackIds, b.musicTrackIds);
  const playlistOrder = orderSimilarity(a.playlistOrder, b.playlistOrder);
  const treatment = a.visualTreatment === b.visualTreatment ? 1 : 0;
  const title =
    a.title.trim().toLowerCase() && a.title.trim().toLowerCase() === b.title.trim().toLowerCase() ? 1 : 0;
  const thumb = a.thumbnailConceptId && a.thumbnailConceptId === b.thumbnailConceptId ? 1 : 0;
  const duration = durationBucket(a.durationSeconds) === durationBucket(b.durationSeconds) ? 1 : 0;
  const style = a.stylePreset === b.stylePreset ? 1 : 0;

  if (scene > 0.8) reasons.push("same scene");
  if (sequence > 0.8) reasons.push("same scene sequence");
  if (musicSet > 0.8) reasons.push("same music");
  if (playlistOrder > 0.8) reasons.push("same playlist order");
  if (treatment === 1) reasons.push("same visual treatment");
  if (title === 1) reasons.push("same title");
  if (thumb === 1) reasons.push("same thumbnail concept");
  if (duration === 1) reasons.push("same duration family");
  if (style === 1) reasons.push("same style");

  const score =
    scene * 0.22 +
    sequence * 0.1 +
    musicSet * 0.22 +
    playlistOrder * 0.12 +
    treatment * 0.1 +
    title * 0.08 +
    thumb * 0.04 +
    duration * 0.06 +
    style * 0.06;

  return { score: Number(score.toFixed(3)), reasons };
}

export function checkProductionSimilarity(
  next: LongFormConfig,
  existing: ExistingProductionFingerprint[],
  threshold = 0.88,
): SimilarityReport {
  let best: SimilarityReport = {
    score: 0,
    closestProductionId: null,
    closestTitle: null,
    reasons: [],
    tooSimilar: false,
  };
  for (const item of existing) {
    const { score, reasons } = similarityScore(next, item.config);
    if (score > best.score) {
      best = {
        score,
        closestProductionId: item.id,
        closestTitle: item.title,
        reasons,
        tooSimilar: score >= threshold,
      };
    }
  }
  return best;
}
