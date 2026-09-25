/** Pure YouTube Live policy. No tokens, no FFmpeg, no network. */

export const YOUTUBE_LIVE_STATUSES = [
  "preparing",
  "waiting_for_ingest",
  "live",
  "stopping",
  "completed",
  "failed",
] as const;
export type YoutubeLiveStatus = (typeof YOUTUBE_LIVE_STATUSES)[number];

export const YOUTUBE_LIVE_ACTIVE_STATUSES = [
  "preparing",
  "waiting_for_ingest",
  "live",
  "stopping",
] as const;

export const LIVE_DURATION_PRESETS_HOURS = [3, 6, 11] as const;
export type LiveDurationHours = (typeof LIVE_DURATION_PRESETS_HOURS)[number];

/** Hard safety: never intentionally run 12 hours or longer. */
export const LIVE_HARD_LIMIT_HOURS = 12;
export const LIVE_DEFAULT_HOURS = 11 as LiveDurationHours;
export const LIVE_MAX_HOURS = 11;

export const YOUTUBE_LIVE_PRIVACY = ["private", "unlisted", "public"] as const;
export type YoutubeLivePrivacy = (typeof YOUTUBE_LIVE_PRIVACY)[number];

export function youtubeLiveMaxConcurrent(raw: string | number | undefined | null = 1): number {
  const n = Number(raw ?? 1);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(4, Math.floor(n));
}

export function assertLiveDurationHours(value: unknown): LiveDurationHours {
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours >= LIVE_HARD_LIMIT_HOURS) {
    throw new Error("Live duration must be under 12 hours.");
  }
  if ((LIVE_DURATION_PRESETS_HOURS as readonly number[]).includes(hours)) {
    return hours as LiveDurationHours;
  }
  throw new Error("Choose 3, 6, or 11 hours.");
}

export function plannedEndAtIso(startedAtMs: number, hours: LiveDurationHours): string {
  const capMs = LIVE_MAX_HOURS * 60 * 60 * 1000;
  const requestedMs = hours * 60 * 60 * 1000;
  const durationMs = Math.min(requestedMs, capMs);
  if (durationMs >= LIVE_HARD_LIMIT_HOURS * 60 * 60 * 1000) {
    throw new Error("Live duration must be under 12 hours.");
  }
  return new Date(startedAtMs + durationMs).toISOString();
}

export function isActiveLiveStatus(status: string): boolean {
  return (YOUTUBE_LIVE_ACTIVE_STATUSES as readonly string[]).includes(status);
}

export function liveElapsedLabel(startedAt: string | null | undefined, nowMs = Date.now()): string {
  if (!startedAt) return "";
  const ms = nowMs - Date.parse(startedAt);
  if (!Number.isFinite(ms) || ms < 0) return "";
  const totalMin = Math.floor(ms / 60000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

const INGEST_LEAK_KEYS = [
  "streamName",
  "stream_name",
  "streamKey",
  "stream_key",
  "ingestionAddress",
  "ingestion_address",
  "rtmpsIngestionAddress",
  "ingestUrl",
  "ingest_url",
  "ingestion_ciphertext",
  "access_token",
  "accessToken",
  "refresh_token",
  "refreshToken",
];

export function hasIngestionLeak(value: unknown, depth = 0): boolean {
  if (value == null || depth > 6) return false;
  if (typeof value === "string") {
    return /rtmps?:\/\/|streamName|ingestionAddress|ya29\.|1\/\/|refresh_token/i.test(value);
  }
  if (Array.isArray(value)) return value.some((item) => hasIngestionLeak(item, depth + 1));
  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (INGEST_LEAK_KEYS.includes(key)) return true;
      if (hasIngestionLeak(nested, depth + 1)) return true;
    }
  }
  return false;
}

export function redactIngestion(text: string, streamName = ""): string {
  let out = String(text || "");
  if (streamName) out = out.split(streamName).join("[redacted]");
  out = out.replace(/rtmps?:\/\/[^\s"'\\]+/gi, "[rtmp]");
  out = out.replace(/ya29\.[A-Za-z0-9._-]+/g, "[token]");
  return out.slice(0, 800);
}

export type PublicYoutubeLiveSession = {
  id: string;
  library_asset_id: string;
  production_id: string;
  youtube_broadcast_id: string | null;
  youtube_stream_id: string | null;
  youtube_video_id: string | null;
  youtube_url: string | null;
  status: YoutubeLiveStatus;
  title: string;
  description: string;
  privacy_status: YoutubeLivePrivacy;
  made_for_kids: boolean;
  duration_hours: number;
  started_at: string | null;
  planned_end_at: string | null;
  ended_at: string | null;
  last_error: string | null;
  source_copy: boolean | null;
  created_at: string;
  updated_at: string;
};

const PUBLIC_SESSION_KEYS: Array<keyof PublicYoutubeLiveSession> = [
  "id",
  "library_asset_id",
  "production_id",
  "youtube_broadcast_id",
  "youtube_stream_id",
  "youtube_video_id",
  "youtube_url",
  "status",
  "title",
  "description",
  "privacy_status",
  "made_for_kids",
  "duration_hours",
  "started_at",
  "planned_end_at",
  "ended_at",
  "last_error",
  "source_copy",
  "created_at",
  "updated_at",
];

export function publicLiveSession(row: Record<string, unknown> | null | undefined): PublicYoutubeLiveSession | null {
  if (!row) return null;
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_SESSION_KEYS) {
    out[key] = row[key] ?? (key === "made_for_kids" ? false : key === "duration_hours" ? LIVE_DEFAULT_HOURS : null);
  }
  out.title = String(row.title || "TDG Live");
  out.description = String(row.description || "");
  out.privacy_status = YOUTUBE_LIVE_PRIVACY.includes(String(row.privacy_status) as YoutubeLivePrivacy)
    ? row.privacy_status
    : "private";
  out.status = YOUTUBE_LIVE_STATUSES.includes(String(row.status) as YoutubeLiveStatus)
    ? row.status
    : "failed";
  out.made_for_kids = row.made_for_kids === true;
  out.duration_hours = Number(row.duration_hours || LIVE_DEFAULT_HOURS);
  out.last_error = row.last_error ? redactIngestion(String(row.last_error)) : null;
  if (hasIngestionLeak(out)) {
    throw new Error("Refusing to return live session fields that contain ingestion secrets.");
  }
  return out as PublicYoutubeLiveSession;
}

export function youtubeWatchUrl(videoId: string | null | undefined): string | null {
  const id = String(videoId || "").trim();
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}
