import { clearedForCommercialYoutube } from "./musicRights";
import type { MusicMood, MusicTrack, PlaylistEntry, StylePreset } from "./types";

export const CROSSFADE_SECONDS = 3;

const STYLE_MOOD: Record<StylePreset, MusicMood> = {
  cozy: "cozy_instrumental",
  luxury: "christmas_jazz",
  snowy: "relaxing_christmas",
  traditional: "classic_christmas",
  magical: "christmas_piano",
  relaxing: "sleep_christmas",
};

export function moodForStyle(style: StylePreset): MusicMood {
  return STYLE_MOOD[style];
}

export function shuffleIds(ids: string[], seed: number): string[] {
  const copy = [...ids];
  let s = seed || 1;
  for (let i = copy.length - 1; i > 0; i -= 1) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = copy[i];
    copy[i] = copy[j]!;
    copy[j] = tmp!;
  }
  return copy;
}

export function eligiblePlaylistTracks(tracks: MusicTrack[], mood: string): MusicTrack[] {
  return tracks.filter((track) => track.mood === mood && clearedForCommercialYoutube(track) && track.durationSeconds > 8);
}

export function buildPlaylist(input: {
  tracks: MusicTrack[];
  mood: string;
  targetSeconds: number;
  shuffle?: boolean;
  seed?: number;
}): { entries: PlaylistEntry[]; selected: MusicTrack[]; musicDuration: number } {
  const pool = eligiblePlaylistTracks(input.tracks, input.mood);
  if (!pool.length || input.targetSeconds <= 0) {
    return { entries: [], selected: [], musicDuration: 0 };
  }
  const order = input.shuffle ? shuffleIds(pool.map((t) => t.id), input.seed ?? 1) : pool.map((t) => t.id);
  const byId = new Map(pool.map((t) => [t.id, t]));
  const ordered = order.map((id) => byId.get(id)!).filter(Boolean);
  const fade = CROSSFADE_SECONDS;
  const entries: PlaylistEntry[] = [];
  const used: MusicTrack[] = [];
  let covered = 0;
  let index = 0;
  let lastId = "";
  while (covered < input.targetSeconds - 0.05) {
    let track = ordered[index % ordered.length]!;
    if (ordered.length > 1 && track.id === lastId) {
      index += 1;
      track = ordered[index % ordered.length]!;
    }
    const start = covered === 0 ? 0 : Math.max(0, covered - fade);
    const end = Math.min(input.targetSeconds, start + track.durationSeconds);
    entries.push({
      trackId: track.id,
      startSeconds: Number(start.toFixed(3)),
      endSeconds: Number(end.toFixed(3)),
      fadeInSeconds: covered === 0 ? 1.5 : fade,
      fadeOutSeconds: end >= input.targetSeconds ? 2 : fade,
    });
    used.push(track);
    lastId = track.id;
    covered = end;
    index += 1;
    if (index > 500) break;
  }
  const unique = [...new Map(used.map((t) => [t.id, t])).values()];
  const musicDuration = unique.reduce((sum, t) => sum + t.durationSeconds, 0);
  return { entries, selected: unique, musicDuration };
}

export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
