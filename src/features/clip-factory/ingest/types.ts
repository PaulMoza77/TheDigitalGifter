import type { IngestionCapability } from "./capability";

export const VIDEO_PROVIDERS = [
  "direct",
  "youtube",
  "vimeo",
  "tiktok",
  "upload",
  "library",
  "unknown",
] as const;

export type VideoProvider = (typeof VIDEO_PROVIDERS)[number];

export type IngestErrorCode =
  | "invalid_url"
  | "ssrf_blocked"
  | "unsupported_protocol"
  | "video_private"
  | "video_unavailable"
  | "source_auth_required"
  | "import_unavailable"
  | "import_failed"
  | "duration_exceeded"
  | "huge_file"
  | "unsupported_codec"
  | "corrupt_file"
  | "rights_required"
  | "network";

export type SourceMetadata = {
  sourceId: string;
  sourceType: VideoProvider;
  originalUrl: string;
  provider: VideoProvider;
  url: string;
  normalizedUrl: string;
  externalId?: string | null;
  title?: string | null;
  author?: string | null;
  durationSeconds?: number | null;
  thumbnailUrl?: string | null;
  thumbnail?: string | null;
  duration?: number | null;
  privacy?: "public" | "unlisted" | "private" | "unknown";
  embeddable?: boolean | null;
  canImport: boolean;
  ingestionCapability: IngestionCapability;
  mediaUrl?: string | null;
  mediaAsset?: { kind: "upload" | "library" | "storage"; id?: string; path?: string } | null;
  importMode: "direct_download" | "authorized_api" | "library" | "upload" | "unavailable";
  fallback?: "upload" | null;
  message?: string | null;
  metadata?: Record<string, unknown>;
};

export type AdapterContext = {
  destPath: string;
  rightsConfirmed: boolean;
};

export type ImportResult = {
  contentType: string;
  bytes: number;
  metadata: SourceMetadata;
};

export interface VideoSourceAdapter {
  id: VideoProvider;
  detect(raw: string): boolean;
  validate(raw: string): { ok: true; url: string } | { ok: false; code: IngestErrorCode; message: string };
  getMetadata(raw: string): Promise<SourceMetadata>;
  canImport(metadata: SourceMetadata): boolean;
  import(raw: string, ctx: AdapterContext): Promise<ImportResult>;
  cleanup?(path: string): Promise<void>;
}

export class IngestFailure extends Error {
  code: IngestErrorCode;
  constructor(code: IngestErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "IngestFailure";
  }
}

export function normalizeSourceMetadata(partial: Omit<SourceMetadata, "sourceId" | "sourceType" | "originalUrl" | "thumbnail" | "duration" | "ingestionCapability"> & {
  sourceId?: string;
  sourceType?: VideoProvider;
  originalUrl?: string;
  ingestionCapability: IngestionCapability;
}): SourceMetadata {
  const provider = partial.provider;
  const normalizedUrl = partial.normalizedUrl || partial.url;
  const sourceId = partial.sourceId || `${provider}:${partial.externalId || normalizedUrl}`;
  const thumbnailUrl = partial.thumbnailUrl ?? null;
  const durationSeconds = partial.durationSeconds ?? null;
  return {
    ...partial,
    sourceId,
    sourceType: partial.sourceType || provider,
    originalUrl: partial.originalUrl || partial.url,
    thumbnailUrl,
    durationSeconds,
    thumbnail: thumbnailUrl,
    duration: durationSeconds,
    canImport: partial.ingestionCapability === "FULL_IMPORT",
  };
}
