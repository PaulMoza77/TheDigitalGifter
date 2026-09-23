import type { PublisherContentType, PublisherDestination, PublisherProvider } from "./types";

export const DESTINATION_LABELS: Record<PublisherDestination, string> = {
  instagram_reel_post: "Instagram Reel/Post",
  instagram_story: "Instagram Story",
  facebook_reel_post: "Facebook Reel/Post",
  facebook_story: "Facebook Story",
  threads: "Threads",
  youtube_short: "YouTube Short",
  tiktok: "TikTok",
};

export const DESTINATION_PROVIDER: Record<PublisherDestination, PublisherProvider> = {
  instagram_reel_post: "meta",
  instagram_story: "meta",
  facebook_reel_post: "meta",
  facebook_story: "meta",
  threads: "threads",
  youtube_short: "youtube",
  tiktok: "tiktok",
};

export const CONTENT_TYPE_LABELS: Record<PublisherContentType, string> = {
  video: "Video / Reel / Short",
  image: "Image",
};

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function isPublisherDestination(value: string): value is PublisherDestination {
  return value in DESTINATION_LABELS;
}

export function contentTypeFromLibraryKind(kind: string, filename: string): PublisherContentType {
  if (kind === "photo" || /\.(jpe?g|png|webp|gif)$/i.test(filename)) return "image";
  return "video";
}

export function bulkTimes(intervalMinutes: 30 | 60, start = "08:00", end = "20:00"): string[] {
  const parse = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const startMin = parse(start);
  const endMin = parse(end);
  const times: string[] = [];
  for (let min = startMin; min <= endMin; min += intervalMinutes) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return times;
}

export function normalizeTimes(times: string[]): string[] {
  const unique = new Set<string>();
  for (const raw of times) {
    const match = String(raw || "").trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) continue;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) continue;
    unique.add(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }
  return [...unique].sort();
}

export function normalizeWeekdays(weekdays: number[]): number[] {
  return [...new Set(weekdays.filter((day) => Number.isInteger(day) && day >= 1 && day <= 7))].sort(
    (a, b) => a - b,
  );
}
