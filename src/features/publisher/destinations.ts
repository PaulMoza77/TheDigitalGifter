import type { PublisherContentType, PublisherDestination, PublisherProvider } from "./types";
import type { SocialPlatform } from "../social-publisher/types";

export const DESTINATION_LABELS: Record<PublisherDestination, string> = {
  instagram_reel_post: "Instagram Reel",
  instagram_story: "Instagram Story",
  facebook_reel_post: "Facebook Reel",
  facebook_story: "Facebook Story",
  threads: "Threads",
  youtube_short: "YouTube Short",
  tiktok: "TikTok",
};

/** Destinations Autopilot actually publishes through social-publisher. */
export const AUTOPILOT_DESTINATIONS: PublisherDestination[] = [
  "instagram_reel_post",
  "facebook_reel_post",
  "youtube_short",
];

export const DEFAULT_NEW_RULE_DESTINATIONS: PublisherDestination[] = [...AUTOPILOT_DESTINATIONS];

export const PUBLISHER_TO_SOCIAL_PLATFORM: Partial<Record<PublisherDestination, SocialPlatform>> = {
  instagram_reel_post: "instagram_reels",
  facebook_reel_post: "facebook_reels",
  youtube_short: "youtube_shorts",
};

export const SOCIAL_PLATFORM_TO_PUBLISHER: Partial<Record<SocialPlatform, PublisherDestination>> = {
  instagram_reels: "instagram_reel_post",
  facebook_reels: "facebook_reel_post",
  youtube_shorts: "youtube_short",
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

export function isAutopilotDestination(value: string): value is PublisherDestination {
  return AUTOPILOT_DESTINATIONS.includes(value as PublisherDestination);
}

export function mapPublisherDestinationToSocialPlatform(
  destination: PublisherDestination,
): SocialPlatform | null {
  return PUBLISHER_TO_SOCIAL_PLATFORM[destination] || null;
}

export function socialPlatformsForDestinations(destinations: PublisherDestination[]): SocialPlatform[] {
  const platforms: SocialPlatform[] = [];
  const seen = new Set<SocialPlatform>();
  for (const destination of destinations) {
    const platform = mapPublisherDestinationToSocialPlatform(destination);
    if (!platform || seen.has(platform)) continue;
    seen.add(platform);
    platforms.push(platform);
  }
  return platforms;
}

export function publisherDestinationForSocialPlatform(platform: SocialPlatform): PublisherDestination | null {
  return SOCIAL_PLATFORM_TO_PUBLISHER[platform] || null;
}

export function maxAutopilotDurationSeconds(destinations: PublisherDestination[]): number | null {
  const mapped = destinations.filter(isAutopilotDestination);
  if (!mapped.length) return null;
  if (mapped.includes("youtube_short")) return 60;
  return 90;
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
