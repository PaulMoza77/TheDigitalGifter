import type { SocialPlatform, SocialProvider } from "./types";

export type { SocialPlatform, SocialProvider };

export type PlatformConstraint = {
  platform: SocialPlatform;
  provider: SocialProvider;
  label: string;
  shortLabel: string;
  minDurationSeconds: number;
  maxDurationSeconds: number;
  minWidth: number;
  minHeight: number;
  aspect: "9:16";
  aspectTolerance: number;
  maxFileSizeBytes: number;
  containers: string[];
  codecs: string[];
  requiresTitle: boolean;
  notes: string;
};

/** Official-ish constraints for a vertical TDG Reel (1080×1920 H.264 MP4). */
export const PLATFORM_CONSTRAINTS: Record<SocialPlatform, PlatformConstraint> = {
  instagram_reels: {
    platform: "instagram_reels",
    provider: "meta",
    label: "Instagram Reels",
    shortLabel: "IG",
    minDurationSeconds: 3,
    maxDurationSeconds: 90,
    minWidth: 540,
    minHeight: 960,
    aspect: "9:16",
    aspectTolerance: 0.08,
    maxFileSizeBytes: 1024 * 1024 * 1024,
    containers: ["mp4", "mov"],
    codecs: ["h264", "avc1", "hev1", "h265"],
    requiresTitle: false,
    notes: "Graph API Reels: media_type=REELS then media_publish. Needs instagram_content_publish.",
  },
  facebook_reels: {
    platform: "facebook_reels",
    provider: "meta",
    label: "Facebook Reels",
    shortLabel: "FB",
    minDurationSeconds: 3,
    maxDurationSeconds: 90,
    minWidth: 540,
    minHeight: 960,
    aspect: "9:16",
    aspectTolerance: 0.08,
    maxFileSizeBytes: 1024 * 1024 * 1024,
    containers: ["mp4", "mov"],
    codecs: ["h264", "avc1"],
    requiresTitle: false,
    notes: "Page Reels via /{page-id}/video_reels. Needs pages_manage_posts on a Page token.",
  },
  tiktok: {
    platform: "tiktok",
    provider: "tiktok",
    label: "TikTok",
    shortLabel: "TT",
    minDurationSeconds: 3,
    maxDurationSeconds: 60,
    minWidth: 540,
    minHeight: 960,
    aspect: "9:16",
    aspectTolerance: 0.08,
    maxFileSizeBytes: 4 * 1024 * 1024 * 1024,
    containers: ["mp4", "webm", "mov"],
    codecs: ["h264", "avc1", "h265", "vp9"],
    requiresTitle: false,
    notes: "TikTok Content Posting API (Direct Post / inbox). Needs video.publish app review.",
  },
  youtube_shorts: {
    platform: "youtube_shorts",
    provider: "youtube",
    label: "YouTube Shorts",
    shortLabel: "YT",
    minDurationSeconds: 1,
    maxDurationSeconds: 60,
    minWidth: 540,
    minHeight: 960,
    aspect: "9:16",
    aspectTolerance: 0.08,
    maxFileSizeBytes: 256 * 1024 * 1024 * 1024,
    containers: ["mp4", "mov", "mpeg", "avi"],
    codecs: ["h264", "avc1", "vp9"],
    requiresTitle: true,
    notes: "YouTube Data API videos.insert; vertical ≤60s is Shorts-compatible.",
  },
};

export const PLATFORM_ORDER: SocialPlatform[] = [
  "instagram_reels",
  "facebook_reels",
  "tiktok",
  "youtube_shorts",
];

export function providerForPlatform(platform: SocialPlatform): SocialProvider {
  return PLATFORM_CONSTRAINTS[platform].provider;
}

export function isSocialPlatform(value: string): value is SocialPlatform {
  return value in PLATFORM_CONSTRAINTS;
}
