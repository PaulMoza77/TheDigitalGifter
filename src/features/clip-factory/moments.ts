import { overlapSeconds } from "./boundaries";
import type { ViralCandidate } from "./types";

/** Best-scoring windows that do not overlap (tiny timestamp jitter allowed). */
export function selectNonOverlappingMoments(input: ViralCandidate[], limit: number, slack = 0.2): ViralCandidate[] {
  const ranked = [...input].sort((a, b) => b.overallViralScore - a.overallViralScore);
  const picked: ViralCandidate[] = [];
  for (const cand of ranked) {
    if (picked.length >= limit) break;
    const overlaps = picked.some(
      (other) => overlapSeconds(cand.startTime, cand.endTime, other.startTime, other.endTime) > slack,
    );
    if (overlaps) continue;
    picked.push(cand);
  }
  return picked.map((item) => ({
    ...item,
    duration: Number((item.endTime - item.startTime).toFixed(3)),
  }));
}

export function clipTimestampsValid(start: number, end: number, sourceDuration: number): boolean {
  return Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start && end <= sourceDuration + 0.05;
}
