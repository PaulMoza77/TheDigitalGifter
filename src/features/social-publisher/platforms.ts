import type { SocialPlatform, SocialProvider } from "./types";

export type { SocialPlatform, SocialProvider };

export type PlatformConstraint = {
  platform: SocialPlatform;
  provider: SocialProvider;
  label: string;
  shortLabel: string;
  kind: "photo" | "video" | "reel";
  minDurationSeconds: number;
  maxDurationSeconds: number;
  minWidth: number;
  minHeight: number;
  aspect: "9:16" | "any";
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
    kind: "reel",
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
  instagram_photo: {
    platform: "instagram_photo",
    provider: "meta",
    label: "Instagram Photo",
    shortLabel: "IG photo",
    kind: "photo",
    minDurationSeconds: 0,
    maxDurationSeconds: 0,
    minWidth: 320,
    minHeight: 320,
    aspect: "any",
    aspectTolerance: 1,
    maxFileSizeBytes: 8 * 1024 * 1024,
    containers: ["jpg", "jpeg", "png", "webp"],
    codecs: [],
    requiresTitle: false,
    notes: "Graph image_url container then media_publish. Instagram must be a professional account linked to the Page.",
  },
  instagram_video: {
    platform: "instagram_video",
    provider: "meta",
    label: "Instagram Video",
    shortLabel: "IG video",
    kind: "video",
    minDurationSeconds: 3,
    maxDurationSeconds: 60,
    minWidth: 320,
    minHeight: 320,
    aspect: "any",
    aspectTolerance: 1,
    maxFileSizeBytes: 1024 * 1024 * 1024,
    containers: ["mp4", "mov"],
    codecs: ["h264", "avc1", "hev1", "h265"],
    requiresTitle: false,
    notes: "Feed video via media_type=VIDEO. Same asset can also be scheduled as a Reel or to Facebook.",
  },
  facebook_reels: {
    platform: "facebook_reels",
    provider: "meta",
    label: "Facebook Reels",
    shortLabel: "FB",
    kind: "reel",
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
  facebook_photo: {
    platform: "facebook_photo",
    provider: "meta",
    label: "Facebook Photo",
    shortLabel: "FB photo",
    kind: "photo",
    minDurationSeconds: 0,
    maxDurationSeconds: 0,
    minWidth: 320,
    minHeight: 320,
    aspect: "any",
    aspectTolerance: 1,
    maxFileSizeBytes: 10 * 1024 * 1024,
    containers: ["jpg", "jpeg", "png", "webp"],
    codecs: [],
    requiresTitle: false,
    notes: "Page photo via /{page-id}/photos. Unpublished until the scheduler runs and live posting is enabled.",
  },
  facebook_video: {
    platform: "facebook_video",
    provider: "meta",
    label: "Facebook Video",
    shortLabel: "FB video",
    kind: "video",
    minDurationSeconds: 1,
    maxDurationSeconds: 1200,
    minWidth: 320,
    minHeight: 320,
    aspect: "any",
    aspectTolerance: 1,
    maxFileSizeBytes: 1024 * 1024 * 1024,
    containers: ["mp4", "mov"],
    codecs: ["h264", "avc1"],
    requiresTitle: false,
    notes: "Page video via /{page-id}/videos file_url. Same asset can be scheduled to Instagram.",
  },
  tiktok: {
    platform: "tiktok",
    provider: "tiktok",
    label: "TikTok",
    shortLabel: "TT",
    kind: "reel",
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
    kind: "reel",
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
  youtube_video: {
    platform: "youtube_video",
    provider: "youtube",
    label: "YouTube Video",
    shortLabel: "YT video",
    kind: "video",
    minDurationSeconds: 1,
    maxDurationSeconds: 12 * 60 * 60,
    minWidth: 480,
    minHeight: 360,
    aspect: "any",
    aspectTolerance: 0.2,
    maxFileSizeBytes: 256 * 1024 * 1024 * 1024,
    containers: ["mp4", "mov", "mpeg", "avi"],
    codecs: ["h264", "avc1", "vp9"],
    requiresTitle: true,
    notes: "YouTube Data API videos.insert for standard / long-form uploads.",
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
