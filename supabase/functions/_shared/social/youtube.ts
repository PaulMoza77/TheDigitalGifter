/** Pure YouTube OAuth / publishing helpers. No tokens, no network, no Deno APIs. */

export const YOUTUBE_OAUTH_CALLBACK_PATH = "/api/admin/social/youtube/callback";

export const REQUIRED_YOUTUBE_UPLOAD_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
] as const;

/** Live Streaming API management. youtube.force-ssl (or the full youtube scope) is required. */
export const REQUIRED_YOUTUBE_LIVE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.force-ssl",
] as const;

export const REQUIRED_YOUTUBE_SCOPES = [
  ...REQUIRED_YOUTUBE_UPLOAD_SCOPES,
  ...REQUIRED_YOUTUBE_LIVE_SCOPES,
] as const;

export type RequiredYouTubeScope = (typeof REQUIRED_YOUTUBE_SCOPES)[number];

export const YOUTUBE_MAX_PUBLISH_ATTEMPTS = 3;

export const YOUTUBE_PLATFORMS = ["youtube_shorts", "youtube_video"] as const;
export type YouTubePlatform = (typeof YOUTUBE_PLATFORMS)[number];

export const YOUTUBE_PRIVACY_STATUSES = ["private", "unlisted", "public"] as const;
export type YouTubePrivacyStatus = (typeof YOUTUBE_PRIVACY_STATUSES)[number];

export const YOUTUBE_PUBLIC_ACCOUNT_METADATA_KEYS = [
  "youtube_channel_id",
  "youtube_channel_title",
  "youtube_channel_handle",
  "granted_scopes",
  "missing_scopes",
  "missing_live_scopes",
  "granted_permissions",
  "missing_permissions",
  "youtube_upload_ready",
  "youtube_live_ready",
  "live_reconnect_required",
  "token_checked_at",
  "token_expires_at",
  "token_valid",
  "connection_error",
  "oauth_app_status",
  "refresh_token_warning",
] as const;

const OAUTH_ERROR_CODES = new Set([
  "access_denied",
  "invalid_state",
  "expired_state",
  "exchange_failed",
  "no_channel",
  "missing_scopes",
  "oauth_failed",
  "reconnect_required",
]);

export function youtubeOauthRedirectUri(input: { explicit?: string; publicBaseUrl: string }): string {
  const explicit = String(input.explicit || "").trim();
  if (explicit) return explicit;
  const base = String(input.publicBaseUrl || "https://www.thedigitalgifter.com").replace(/\/$/, "");
  return `${base}${YOUTUBE_OAUTH_CALLBACK_PATH}`;
}

export function isExactYouTubeRedirectUri(candidate: string, expected: string): boolean {
  try {
    const left = new URL(candidate);
    const right = new URL(expected);
    return (
      left.origin === right.origin &&
      left.pathname === right.pathname &&
      !left.search &&
      !right.search &&
      !left.hash &&
      !right.hash &&
      !left.username &&
      !left.password
    );
  } catch {
    return false;
  }
}

export function buildYouTubeAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  forceConsent?: boolean;
}): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "false");
  url.searchParams.set("scope", REQUIRED_YOUTUBE_SCOPES.join(" "));
  if (input.forceConsent !== false) {
    url.searchParams.set("prompt", "consent");
  }
  return url.toString();
}

export function normalizeYouTubeScopes(raw: string | string[] | null | undefined): string[] {
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((item) => String(item || "").trim()).filter(Boolean))];
  }
  const text = String(raw || "").trim();
  if (!text) return [];
  return [...new Set(text.split(/[,\s]+/).map((item) => item.trim()).filter(Boolean))];
}

function youtubeScopeSet(granted: string[]): Set<string> {
  const set = new Set(normalizeYouTubeScopes(granted));
  // Google sometimes returns scope aliases without the full URL prefix.
  if (set.has("youtube.upload")) set.add("https://www.googleapis.com/auth/youtube.upload");
  if (set.has("youtube.readonly")) set.add("https://www.googleapis.com/auth/youtube.readonly");
  if (set.has("youtube.force-ssl")) set.add("https://www.googleapis.com/auth/youtube.force-ssl");
  if (set.has("youtube")) set.add("https://www.googleapis.com/auth/youtube");
  // Full YouTube scope covers Live Streaming API management.
  if (set.has("https://www.googleapis.com/auth/youtube")) {
    set.add("https://www.googleapis.com/auth/youtube.force-ssl");
  }
  return set;
}

function diffKnownScopes(granted: string[], required: readonly string[]): { granted: string[]; missing: string[] } {
  const set = youtubeScopeSet(granted);
  const missing = required.filter((scope) => !set.has(scope));
  const present = required.filter((scope) => set.has(scope));
  return { granted: [...present], missing: [...missing] };
}

export function diffYouTubeUploadScopes(granted: string[]): { granted: string[]; missing: string[] } {
  return diffKnownScopes(granted, REQUIRED_YOUTUBE_UPLOAD_SCOPES);
}

export function diffYouTubeLiveScopes(granted: string[]): { granted: string[]; missing: string[] } {
  return diffKnownScopes(granted, REQUIRED_YOUTUBE_LIVE_SCOPES);
}

export function diffYouTubeScopes(granted: string[]): { granted: string[]; missing: string[] } {
  return diffKnownScopes(granted, REQUIRED_YOUTUBE_SCOPES);
}

export function youtubeLiveScopeReady(granted: string[]): boolean {
  return diffYouTubeLiveScopes(granted).missing.length === 0;
}

export function youtubeUploadScopeReady(granted: string[]): boolean {
  return diffYouTubeUploadScopes(granted).missing.length === 0;
}

export function youtubeConnectionStatus(input: {
  channelId: string | null | undefined;
  missingScopes: string[];
}): "connected" | "error" {
  if (!String(input.channelId || "").trim()) return "error";
  if (input.missingScopes.length > 0) return "error";
  return "connected";
}

export function isYouTubePlatform(platform: string): platform is YouTubePlatform {
  return (YOUTUBE_PLATFORMS as readonly string[]).includes(platform);
}

export function youtubeQueueState(
  status: string,
): "queued" | "uploading" | "processing" | "published" | "failed" | "other" {
  if (status === "scheduled" || status === "draft" || status === "queued") return "queued";
  if (status === "uploading") return "uploading";
  if (status === "processing" || status === "publishing") return "processing";
  if (status === "published" || status === "completed") return "published";
  if (status === "failed") return "failed";
  return "other";
}

export function youtubeRetryPlan(input: {
  platform: string;
  attempts: number;
  retryable: boolean;
  remotePostId: string | null;
  nowMs: number;
}): { status: "scheduled" | "failed"; nextRetryAt: string | null } {
  if (input.remotePostId) return { status: "failed", nextRetryAt: null };
  if (!isYouTubePlatform(input.platform) || !input.retryable || input.attempts >= YOUTUBE_MAX_PUBLISH_ATTEMPTS) {
    return { status: "failed", nextRetryAt: null };
  }
  const minutes = Math.min(60, 2 ** Math.max(0, input.attempts - 1));
  return {
    status: "scheduled",
    nextRetryAt: new Date(input.nowMs + minutes * 60_000).toISOString(),
  };
}

export function normalizePrivacyStatus(value: unknown, fallback: YouTubePrivacyStatus = "private"): YouTubePrivacyStatus {
  const raw = String(value || "").trim().toLowerCase();
  if ((YOUTUBE_PRIVACY_STATUSES as readonly string[]).includes(raw)) {
    return raw as YouTubePrivacyStatus;
  }
  return fallback;
}

export function parseYouTubeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 30);
  }
  const text = String(value || "").trim();
  if (!text) return [];
  return text
    .split(/[,#]+/)
    .map((item) => item.trim().replace(/^#+/, ""))
    .filter(Boolean)
    .slice(0, 30);
}

export function youtubeVideoUrl(videoId: string, platform: string): string {
  const id = String(videoId || "").trim();
  if (!id) return "";
  if (platform === "youtube_shorts") return `https://www.youtube.com/shorts/${id}`;
  return `https://www.youtube.com/watch?v=${id}`;
}

export function youtubeOauthErrorCode(raw: string): string {
  const code = String(raw || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 40);
  if (OAUTH_ERROR_CODES.has(code)) return code;
  if (code === "accessdenied") return "access_denied";
  return "oauth_failed";
}

export function channelHandleFromSnippet(snippet: {
  customUrl?: string | null;
  title?: string | null;
} | null | undefined): string | null {
  const custom = String(snippet?.customUrl || "").trim();
  if (custom) return custom.startsWith("@") ? custom : `@${custom.replace(/^@/, "")}`;
  return null;
}

export function publicYouTubeChannelSummary(input: {
  id?: string | null;
  title?: string | null;
  handle?: string | null;
}) {
  return {
    youtube_channel_id: String(input.id || "").trim() || null,
    youtube_channel_title: String(input.title || "").trim() || null,
    youtube_channel_handle: String(input.handle || "").trim() || null,
  };
}
