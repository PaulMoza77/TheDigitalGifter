export const PUBLISHER_STATUSES = [
  "needs_content",
  "needs_approval",
  "scheduled",
  "processing",
  "completed",
  "failed",
  "cancelled",
] as const;

export type PublisherStatus = (typeof PUBLISHER_STATUSES)[number];

export const PUBLISHER_CONTENT_TYPES = ["video", "image"] as const;
export type PublisherContentType = (typeof PUBLISHER_CONTENT_TYPES)[number];

export const PUBLISHER_DESTINATIONS = [
  "instagram_reel_post",
  "instagram_story",
  "facebook_reel_post",
  "facebook_story",
  "threads",
  "youtube_short",
  "tiktok",
] as const;

export type PublisherDestination = (typeof PUBLISHER_DESTINATIONS)[number];

export const PUBLISHER_PROVIDERS = ["dry_run", "meta", "threads", "youtube", "tiktok"] as const;
export type PublisherProvider = (typeof PUBLISHER_PROVIDERS)[number];

export const DEFAULT_PUBLISHER_TIMEZONE = "Europe/Bucharest";
export const ROLLING_HORIZON_DAYS = 7;
export const DEFAULT_REUSE_COOLDOWN_DAYS = 14;
export const DEFAULT_MAX_ATTEMPTS = 3;

export type PublisherScheduleRule = {
  id: string;
  name: string;
  timezone: string;
  weekdays: number[];
  times: string[];
  contentType: PublisherContentType;
  destinations: PublisherDestination[];
  libraryCategory: string | null;
  libraryTags: string[];
  autoAssign: boolean;
  reuseCooldownDays: number;
  approvalRequired: boolean;
  active: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublisherSlot = {
  id: string;
  ruleId: string;
  scheduledAt: string;
  timezone: string;
  status: PublisherStatus;
  locked: boolean;
  manuallyEdited: boolean;
  assignmentLocked: boolean;
  contentReason: string | null;
  publicationId: string | null;
};

export type PublisherPublication = {
  id: string;
  slotId: string | null;
  libraryAssetId: string | null;
  caption: string;
  contentType: PublisherContentType;
  assignmentSource: "auto" | "manual" | "none";
  approved: boolean;
  approvedAt: string | null;
  status: PublisherStatus;
  scheduledAt: string;
  timezone: string;
  locked: boolean;
  destinations: PublisherDestination[];
  duplicateKey: string | null;
};

export type PublisherDestinationJob = {
  id: string;
  publicationId: string;
  destination: PublisherDestination;
  status: PublisherStatus;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: string | null;
  claimedBy: string | null;
  claimedAt: string | null;
  leaseExpiresAt: string | null;
  remotePostId: string | null;
  remoteUrl: string | null;
  lastError: string | null;
  lastErrorCode: string | null;
};

export type PublisherAttempt = {
  id: string;
  jobId: string;
  kind: "dry_run" | "provider";
  success: boolean;
  resultCode: string;
  message: string;
  remotePostId: string | null;
  remoteUrl: string | null;
  createdAt: string;
};

export type PublisherLibraryAsset = {
  id: string;
  title: string;
  src: string;
  filename: string;
  kind: string;
  category: string;
  tags: string[];
  poster?: string | null;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  exists: boolean;
  ready: boolean;
  processing: boolean;
  failed: boolean;
  excluded: boolean;
  eligible: boolean;
  contentType: PublisherContentType;
  lastUsedByDestination: Record<string, string>;
};

export type PublisherAdapterResult = {
  ok: boolean;
  code: string;
  message: string;
  retryable: boolean;
  remotePostId: string | null;
  remoteUrl: string | null;
  dryRun: boolean;
};

export type PublisherConnectionStatus = "connected" | "not_connected";

export type PublishRequest = {
  destination: PublisherDestination;
  libraryAssetId: string;
  mediaUrl: string;
  caption: string;
  contentType: PublisherContentType;
  scheduledAt: string;
  forceFail?: boolean;
};

export interface PublisherAdapter {
  destination: PublisherDestination | "*";
  provider: PublisherProvider;
  connectionStatus: PublisherConnectionStatus;
  validate(request: PublishRequest): PublisherAdapterResult;
  publish(request: PublishRequest): Promise<PublisherAdapterResult>;
}
