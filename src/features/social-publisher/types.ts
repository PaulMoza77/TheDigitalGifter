export const SOCIAL_PLATFORMS = [
  "instagram_reels",
  "instagram_photo",
  "instagram_video",
  "facebook_reels",
  "facebook_photo",
  "facebook_video",
  "tiktok",
  "youtube_shorts",
  "youtube_video",
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_PROVIDERS = ["meta", "tiktok", "youtube"] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

export const PUBLICATION_STATUSES = [
  "draft",
  "scheduled",
  "processing",
  "published",
  "partial",
  "failed",
  "cancelled",
] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export const TARGET_STATUSES = [
  "draft",
  "scheduled",
  "processing",
  "published",
  "failed",
  "cancelled",
] as const;
export type TargetStatus = (typeof TARGET_STATUSES)[number];

export const ACCOUNT_STATUSES = [
  "connected",
  "not_connected",
  "expired",
  "revoked",
  "error",
] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export type LibraryAssetKind = "reel" | "short" | "photo" | "long_form";

export type LibraryAssetSnapshot = {
  id: string;
  title: string;
  src: string;
  filename: string;
  kind: LibraryAssetKind;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  container?: string | null;
  codec?: string | null;
  fileSizeBytes?: number | null;
  exists?: boolean;
};

export type MediaIssue = {
  code: string;
  message: string;
  platform?: SocialPlatform;
};

export type MediaValidationResult = {
  ok: boolean;
  issues: MediaIssue[];
};

export type ScheduleMode = "now" | "schedule";

export type BulkScheduleInput = {
  assetIds: string[];
  platforms: SocialPlatform[];
  startDate: string;
  times: string[];
  postsPerDay: number;
  timezone: string;
  nowMs?: number;
};

export type BulkScheduleSlot = {
  assetId: string;
  scheduledAtIso: string;
  localDate: string;
  localTime: string;
};

export type TargetOutcome = {
  platform: SocialPlatform;
  status: TargetStatus;
  remotePostId?: string | null;
};

export type WorkerClaimFilter = {
  status: TargetStatus;
  remotePostId: string | null;
  scheduledAtMs: number;
  publicationStatus: PublicationStatus;
  nextRetryAtMs: number | null;
  leaseExpiresAtMs: number | null;
  nowMs: number;
};

export type PublishAdapterResult =
  | {
      ok: true;
      remotePostId: string;
      remoteUrl?: string | null;
      provider: SocialProvider;
    }
  | {
      ok: false;
      code: string;
      message: string;
      retryable: boolean;
      waitingForApproval?: boolean;
    };
