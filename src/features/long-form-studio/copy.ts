import type { MusicTrack, StylePreset } from "./types";
import { MOOD_LABELS, type MusicMood } from "./types";

const STYLE_WORDS: Record<StylePreset, { scene: string; music: string; emoji: string }> = {
  cozy: { scene: "Cozy Christmas Fireplace", music: "Relaxing Christmas Music", emoji: "🎄" },
  luxury: { scene: "Luxury Alpine Christmas", music: "Christmas Jazz", emoji: "✨" },
  snowy: { scene: "Snowy Christmas Cabin", music: "Soft Winter Ambience", emoji: "❄️" },
  traditional: { scene: "Traditional Christmas Home", music: "Classic Christmas Music", emoji: "🎄" },
  magical: { scene: "Magical Christmas Night", music: "Christmas Piano", emoji: "✨" },
  relaxing: { scene: "Christmas Sleep & Relaxation", music: "Gentle Christmas Music", emoji: "🌙" },
};

export function generateTitleOptions(input: {
  sceneTitle: string;
  style: StylePreset;
  moodLabel: string;
}): string[] {
  const style = STYLE_WORDS[input.style];
  const scene = input.sceneTitle.replace(/\s+·\s+.*/, "").trim() || style.scene;
  return [
    `${style.scene} ${style.emoji} ${style.music} & Snow Ambience`,
    `${input.moodLabel} by the Fireplace ${style.emoji} Cozy Winter Ambience`,
    `${scene} ${style.emoji} ${style.music} & Fireplace`,
  ].map((title) => title.replace(/\s+/g, " ").trim());
}

function chapterMarks(durationSeconds: number): Array<{ at: number; label: string }> {
  const hours = Math.max(1, Math.round(durationSeconds / 3600));
  const chapters: Array<{ at: number; label: string }> = [{ at: 0, label: "Settle in" }];
  if (durationSeconds >= 1800) chapters.push({ at: 20 * 60, label: "Deeper calm" });
  if (durationSeconds >= 3600) chapters.push({ at: 3600, label: "Hour two glow" });
  if (hours >= 3) chapters.push({ at: 2 * 3600, label: "Late evening" });
  if (hours >= 6) chapters.push({ at: 5 * 3600, label: "Overnight" });
  return chapters.filter((c) => c.at < durationSeconds);
}

function formatChapter(at: number): string {
  const h = Math.floor(at / 3600);
  const m = Math.floor((at % 3600) / 60);
  const s = at % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function requiredAttributions(tracks: MusicTrack[]): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const track of tracks) {
    if (!track.attributionRequired) continue;
    const text = track.attributionText.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    lines.push(text);
  }
  return lines;
}

export function generateDescription(input: {
  sceneTitle: string;
  style: StylePreset;
  mood: MusicMood | string;
  durationSeconds: number;
  tracks: MusicTrack[];
}): string {
  const style = STYLE_WORDS[input.style];
  const moodLabel = MOOD_LABELS[input.mood as MusicMood] || String(input.mood);
  const hours = Math.round(input.durationSeconds / 3600);
  const length = hours >= 1 ? `${hours}-hour` : "long";
  const paragraphs = [
    `A ${length} ${style.scene.toLowerCase()} atmosphere with ${moodLabel.toLowerCase()} — made for reading, working, sleeping, and slow winter evenings.`,
    `The Digital Gifter · original long-form ambience. Visuals from the TDG Library. Music is used only from tracks with stored commercial and YouTube rights.`,
  ];
  const chapters = chapterMarks(input.durationSeconds);
  if (chapters.length > 1) {
    paragraphs.push("Chapters");
    paragraphs.push(chapters.map((c) => `${formatChapter(c.at)} ${c.label}`).join("\n"));
  }
  const attrs = requiredAttributions(input.tracks);
  if (attrs.length) {
    paragraphs.push("Music attribution");
    paragraphs.push(attrs.join("\n"));
  }
  paragraphs.push("#christmas #christmasmusic #fireplace #ambience #relaxing");
  return paragraphs.join("\n\n");
}

export function generateThumbnailConcepts(sceneTitle: string): Array<{
  id: string;
  label: string;
  textMode: "none" | "short";
  overlayText: string;
  cropHint: string;
}> {
  const short = sceneTitle.split("·")[0]?.trim() || "Christmas";
  return [
    {
      id: "wide-none",
      label: "Cinematic wide · no text",
      textMode: "none",
      overlayText: "",
      cropHint: "center-wide",
    },
    {
      id: "fire-none",
      label: "Warm hearth · no text",
      textMode: "none",
      overlayText: "",
      cropHint: "lower-third-warm",
    },
    {
      id: "short-text",
      label: "Quiet title",
      textMode: "short",
      overlayText: short.slice(0, 28),
      cropHint: "center-wide",
    },
  ];
}
