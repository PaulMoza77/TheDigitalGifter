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
  provider: VideoProvider;
  url: string;
  normalizedUrl: string;
  externalId?: string | null;
  title?: string | null;
  author?: string | null;
  durationSeconds?: number | null;
  thumbnailUrl?: string | null;
  privacy?: "public" | "unlisted" | "private" | "unknown";
  embeddable?: boolean | null;
  canImport: boolean;
  importMode: "direct_download" | "authorized_api" | "library" | "upload" | "unavailable";
  fallback?: "upload" | null;
  message?: string | null;
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
