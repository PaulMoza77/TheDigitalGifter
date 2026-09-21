export const CLIP_INGEST_PROVIDERS = ["auto", "authorized_http", "ytdlp", "direct", "vimeo"] as const;
export type ClipIngestProviderId = (typeof CLIP_INGEST_PROVIDERS)[number];

export function clipIngestEndpoint(): string {
  return String(process.env.CLIP_INGEST_ENDPOINT || process.env.CLIP_FACTORY_YOUTUBE_IMPORT_URL || "").trim();
}

export function clipIngestPrimaryProvider(): ClipIngestProviderId {
  const raw = String(process.env.CLIP_INGEST_PROVIDER || "auto").trim().toLowerCase();
  return (CLIP_INGEST_PROVIDERS as readonly string[]).includes(raw) ? (raw as ClipIngestProviderId) : "auto";
}

export function clipIngestFallbackProvider(): ClipIngestProviderId {
  const raw = String(process.env.CLIP_INGEST_FALLBACK_PROVIDER || "ytdlp").trim().toLowerCase();
  return (CLIP_INGEST_PROVIDERS as readonly string[]).includes(raw) ? (raw as ClipIngestProviderId) : "ytdlp";
}

export function ytdlpImportEnabled(): boolean {
  return String(process.env.CLIP_FACTORY_DISABLE_YTDLP || "").trim() !== "1";
}

export function youtubeCanAttemptFileImport(): boolean {
  return Boolean(clipIngestEndpoint()) || ytdlpImportEnabled();
}

export function youtubeProviderChain(): Array<"authorized_http" | "ytdlp"> {
  const primary = clipIngestPrimaryProvider();
  const fallback = clipIngestFallbackProvider();
  const ordered: Array<"authorized_http" | "ytdlp"> = [];
  const push = (id: ClipIngestProviderId) => {
    if (id === "authorized_http" && clipIngestEndpoint() && !ordered.includes("authorized_http")) ordered.push("authorized_http");
    if (id === "ytdlp" && ytdlpImportEnabled() && !ordered.includes("ytdlp")) ordered.push("ytdlp");
    if (id === "auto") {
      push("authorized_http");
      push("ytdlp");
    }
  };
  push(primary);
  push(fallback);
  push("auto");
  return ordered;
}

export const USER_SOURCE_IMPORT_FAILED = "We couldn't import this source video. No clips were created.";
