import type { AutopilotMusicTrack } from "./types";
import { moodHintsFromTags } from "./contentAnalysis";

function moodScore(track: AutopilotMusicTrack, hints: string[]): number {
  const mood = track.mood.toLowerCase();
  let score = 0;
  for (const hint of hints) {
    if (hint === "energetic" && /energetic|upbeat|synth|joy/.test(mood)) score += 3;
    if (hint === "calm" && /peaceful|emotional|nostalgic|silent|night/.test(mood)) score += 3;
    if (hint === "atmospheric" && /magical|cinematic|synth/.test(mood)) score += 3;
    if (hint === "warm" && /traditional|cozy|nostalgic/.test(mood)) score += 3;
  }
  const overlap = track.tags.filter((tag) => hints.includes(tag) || hints.some((h) => tag.includes(h)));
  score += overlap.length;
  return score;
}

export function filterSafeTracks(
  tracks: AutopilotMusicTrack[],
  platform: "instagram" | "facebook" | "youtube",
): AutopilotMusicTrack[] {
  return tracks.filter((track) => {
    if (!track.approvedForAutopilot) return false;
    if (track.commercialUseAllowed !== true) return false;
    if (platform === "instagram" && !track.instagramAllowed) return false;
    if (platform === "facebook" && !track.facebookAllowed) return false;
    if (platform === "youtube" && !track.youtubeAllowed) return false;
    return true;
  });
}

export function selectMusicTrack(input: {
  tracks: AutopilotMusicTrack[];
  contentTags: string[];
  recentTrackIds?: string[];
}): AutopilotMusicTrack | null {
  const hints = moodHintsFromTags(input.contentTags);
  const safe = filterSafeTracks(input.tracks, "instagram").filter((t) =>
    filterSafeTracks([t], "facebook").length && filterSafeTracks([t], "youtube").length,
  );
  if (!safe.length) return null;

  const recent = new Set(input.recentTrackIds || []);
  const ranked = [...safe].sort((a, b) => {
    const scoreDelta = moodScore(b, hints) - moodScore(a, hints);
    if (scoreDelta !== 0) return scoreDelta;
    const aRecent = recent.has(a.id) ? 1 : 0;
    const bRecent = recent.has(b.id) ? 1 : 0;
    if (aRecent !== bRecent) return aRecent - bRecent;
    const aUsed = a.lastUsedAt ? Date.parse(a.lastUsedAt) : 0;
    const bUsed = b.lastUsedAt ? Date.parse(b.lastUsedAt) : 0;
    return aUsed - bUsed;
  });

  const topScore = moodScore(ranked[0]!, hints);
  const top = ranked.filter((track) => moodScore(track, hints) === topScore);
  const nonRecent = top.filter((track) => !recent.has(track.id));
  return (nonRecent[0] || top[0] || ranked[0]) ?? null;
}
