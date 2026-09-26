export type PublishStatus = "legacy" | "pending_finish" | "processing" | "ready_to_publish" | "failed";

export type PlatformMetadata = {
  hook?: string;
  cta?: string;
  contentTags?: string[];
  instagram?: { caption: string; hashtags: string };
  facebook?: { caption: string; hashtags: string };
  youtube?: { title: string; description: string; hashtags: string; tags?: string[] };
};

export type PublishChecks = {
  videoValid?: boolean;
  musicLicenseVerified?: boolean;
  musicFileValid?: boolean;
  audioRenderSuccess?: boolean;
  finalVideoValid?: boolean;
  metadataGenerated?: boolean;
  platformRequirementsValid?: boolean;
};

export type AutopilotMusicTrack = {
  id: string;
  title: string;
  artistSource: string;
  mood: string;
  tags: string[];
  storagePath: string | null;
  publicSrc: string | null;
  filename: string | null;
  durationSeconds: number;
  approvedForAutopilot: boolean;
  commercialUseAllowed: boolean | null;
  instagramAllowed: boolean;
  facebookAllowed: boolean;
  youtubeAllowed: boolean;
  lastUsedAt: string | null;
  licenseType: string;
  licenseUrl: string | null;
  sourceUrl: string | null;
};

export type FinishJobRow = {
  id: string;
  library_asset_id: string;
  status: string;
  attempts: number;
  max_attempts: number;
};

export type LibraryAssetRow = {
  id: string;
  title: string;
  description: string;
  src: string;
  filename: string;
  category: string;
  kind: string;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  storage_bucket: string | null;
  storage_path: string | null;
  provenance: Record<string, unknown>;
  publish_status: PublishStatus;
  music_track_id: string | null;
  content_tags: string[];
  platform_metadata: PlatformMetadata;
  publish_checks: PublishChecks;
  source_video_path: string | null;
  finish_error: string | null;
};
