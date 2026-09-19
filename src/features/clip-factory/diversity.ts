import { intervalIoU } from "./boundaries";
import type { ViralCandidate } from "./types";

export function selectDiverseCandidates(input: ViralCandidate[], limit: number): ViralCandidate[] {
  const ranked = [...input].sort((a, b) => b.overallViralScore - a.overallViralScore);
  const picked: ViralCandidate[] = [];
  for (const cand of ranked) {
    if (picked.length >= limit) break;
    const tooSimilar = picked.some((other) => intervalIoU(cand.startTime, cand.endTime, other.startTime, other.endTime) > 0.45);
    if (tooSimilar) continue;
    picked.push(cand);
  }
  if (picked.length < limit) {
    for (const cand of ranked) {
      if (picked.length >= limit) break;
      if (picked.includes(cand)) continue;
      picked.push(cand);
    }
  }
  return picked.map((item, index) => ({ ...item, overallViralScore: item.overallViralScore, duration: Number((item.endTime - item.startTime).toFixed(3)) }));
}

export function sortCandidates(
  items: ViralCandidate[],
  sort: "score" | "shortest" | "longest" | "funny" | "emotional" | "educational" | "visual",
): ViralCandidate[] {
  const copy = [...items];
  copy.sort((a, b) => {
    if (sort === "shortest") return a.duration - b.duration;
    if (sort === "longest") return b.duration - a.duration;
    if (sort === "funny") return b.scores.humor - a.scores.humor;
    if (sort === "emotional") return b.scores.emotion - a.scores.emotion;
    if (sort === "educational") return b.scores.standalone - a.scores.standalone;
    if (sort === "visual") return b.scores.visual - a.scores.visual;
    return b.overallViralScore - a.overallViralScore;
  });
  return copy;
}
