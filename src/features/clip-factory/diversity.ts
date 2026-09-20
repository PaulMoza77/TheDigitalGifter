import { selectNonOverlappingMoments } from "./moments";
import type { ViralCandidate } from "./types";

export function selectDiverseCandidates(input: ViralCandidate[], limit: number): ViralCandidate[] {
  return selectNonOverlappingMoments(input, limit);
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
