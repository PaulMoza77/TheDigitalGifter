/** Pure Meta Login / publishing helpers. No tokens, no network, no Deno APIs. */

export const META_GRAPH_VERSION = "v21.0";

/**
 * Official Graph permission names.
 * The product is "Instagram Content Publishing"; the OAuth scope is instagram_content_publish.
 */
export const REQUIRED_META_PERMISSIONS = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
] as const;

export type RequiredMetaPermission = (typeof REQUIRED_META_PERMISSIONS)[number];

export const META_OAUTH_CALLBACK_PATH = "/api/meta-oauth/callback";

export const META_MAX_PUBLISH_ATTEMPTS = 3;

export const META_PLATFORMS = [
  "instagram_reels",
  "instagram_photo",
  "instagram_video",
  "facebook_reels",
  "facebook_photo",
  "facebook_video",
] as const;

export type MetaPlatform = (typeof META_PLATFORMS)[number];

export type MetaMediaKind = "photo" | "video" | "reel";

const OAUTH_ERROR_CODES = new Set([
  "access_denied",
  "invalid_state",
  "expired_state",
  "exchange_failed",
  "no_pages",
  "instagram_not_linked",
  "instagram_not_professional",
  "missing_permissions",
  "oauth_failed",
]);

export function metaOauthRedirectUri(input: { explicit?: string; publicBaseUrl: string }): string {
  const explicit = String(input.explicit || "").trim();
  if (explicit) return explicit;
  const base = String(input.publicBaseUrl || "https://www.thedigitalgifter.com").replace(/\/$/, "");
  return `${base}${META_OAUTH_CALLBACK_PATH}`;
}

/** Facebook Login for Business. Permissions come from the configuration, not from a scope list. */
export function buildMetaBusinessLoginUrl(input: {
  appId: string;
  redirectUri: string;
  state: string;
  configurationId: string;
}): string {
  const url = new URL(`https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", input.appId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("config_id", input.configurationId);
  url.searchParams.set("override_default_response_type", "true");
  return url.toString();
}

export function isAllowedAdminReturn(target: string, publicBaseUrl: string): boolean {
  try {
    const base = new URL(publicBaseUrl);
    const url = new URL(target);
    if (url.origin !== base.origin) return false;
    if (url.username || url.password) return false;
    if (url.pathname !== "/admin/social-accounts") return false;
    return true;
  } catch {
    return false;
  }
}

export function adminSocialAccountsUrl(publicBaseUrl: string, params: Record<string, string> = {}): string {
  const base = String(publicBaseUrl || "https://www.thedigitalgifter.com").replace(/\/$/, "");
  const url = new URL(`${base}/admin/social-accounts`);
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;
    if (key === "message" && !OAUTH_ERROR_CODES.has(value)) continue;
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function oauthErrorCode(raw: string): string {
  const code = String(raw || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 40);
  if (OAUTH_ERROR_CODES.has(code)) return code;
  if (code === "accessdenied") return "access_denied";
  return "oauth_failed";
}

const TOKEN_PATTERNS: RegExp[] = [
  /access_token=[^&\s]+/gi,
  /client_secret=[^&\s]+/gi,
  /fb_exchange_token=[^&\s]+/gi,
  /input_token=[^&\s]+/gi,
  /EAA[A-Za-z0-9]{10,}/g,
  /Bearer\s+[A-Za-z0-9._\-]+/gi,
];

export function sanitizeProviderError(message: string, max = 280): string {
  let text = String(message || "provider_error");
  for (const pattern of TOKEN_PATTERNS) text = text.replace(pattern, "[redacted]");
  text = text.replace(/\s+/g, " ").trim();
  if (!text) text = "provider_error";
  return text.slice(0, max);
}

export function diffMetaPermissions(granted: string[]): { granted: string[]; missing: string[] } {
  const set = new Set(granted.map((item) => item.trim()).filter(Boolean));
  if (set.has("instagram_content_publishing")) set.add("instagram_content_publish");
  const missing = REQUIRED_META_PERMISSIONS.filter((permission) => !set.has(permission));
  const present = REQUIRED_META_PERMISSIONS.filter((permission) => set.has(permission));
  return { granted: [...present], missing: [...missing] };
}

export function isProfessionalInstagram(accountType: string, linkedViaBusinessEdge = false): boolean {
  const value = String(accountType || "").trim().toUpperCase();
  if (value === "BUSINESS" || value === "MEDIA_CREATOR") return true;
  if (value === "PERSONAL") return false;
  return linkedViaBusinessEdge && value.length === 0;
}

export type MetaPageCandidate = {
  id: string;
  name: string;
  accessToken?: string;
  instagram?: { id?: string; username?: string; accountType?: string } | null;
};

export type MetaPageSelectionReason = "ok" | "no_pages" | "instagram_not_linked" | "instagram_not_professional";

export function selectLinkedProfessionalPage(pages: MetaPageCandidate[]): {
  page: MetaPageCandidate | null;
  reason: MetaPageSelectionReason;
} {
  if (!pages.length) return { page: null, reason: "no_pages" };
  const linked = pages.filter((page) => page.instagram?.id);
  if (!linked.length) return { page: pages[0] || null, reason: "instagram_not_linked" };
  const professional = linked.find((page) =>
    isProfessionalInstagram(page.instagram?.accountType || "", true),
  );
  if (!professional) return { page: linked[0] || null, reason: "instagram_not_professional" };
  return { page: professional, reason: "ok" };
}

export function publicPageSummary(page: MetaPageCandidate | null) {
  if (!page) {
    return {
      facebook_page_id: null,
      facebook_page_name: null,
      instagram_user_id: null,
      instagram_username: null,
      instagram_account_type: null,
    };
  }
  return {
    facebook_page_id: page.id || null,
    facebook_page_name: page.name || null,
    instagram_user_id: page.instagram?.id || null,
    instagram_username: page.instagram?.username || null,
    instagram_account_type: page.instagram?.accountType || null,
  };
}

export function metaConnectionStatus(input: {
  reason: MetaPageSelectionReason;
  missingPermissions: string[];
}): "connected" | "error" {
  if (input.reason !== "ok") return "error";
  if (input.missingPermissions.length > 0) return "error";
  return "connected";
}

export function isMetaPlatform(platform: string): platform is MetaPlatform {
  return (META_PLATFORMS as readonly string[]).includes(platform);
}

export function metaMediaKind(platform: string): MetaMediaKind | null {
  if (platform === "instagram_reels" || platform === "facebook_reels") return "reel";
  if (platform === "instagram_photo" || platform === "facebook_photo") return "photo";
  if (platform === "instagram_video" || platform === "facebook_video") return "video";
  return null;
}

export function queueState(status: string): "queued" | "publishing" | "published" | "failed" | "other" {
  if (status === "scheduled" || status === "draft" || status === "queued") return "queued";
  if (status === "processing" || status === "publishing") return "publishing";
  if (status === "published" || status === "completed") return "published";
  if (status === "failed") return "failed";
  return "other";
}

export function metaRetryPlan(input: {
  platform: string;
  attempts: number;
  retryable: boolean;
  remotePostId: string | null;
  nowMs: number;
}): { status: "scheduled" | "failed"; nextRetryAt: string | null } {
  if (input.remotePostId) return { status: "failed", nextRetryAt: null };
  if (!isMetaPlatform(input.platform) || !input.retryable || input.attempts >= META_MAX_PUBLISH_ATTEMPTS) {
    return { status: "failed", nextRetryAt: null };
  }
  const minutes = Math.min(60, 2 ** Math.max(0, input.attempts - 1));
  return {
    status: "scheduled",
    nextRetryAt: new Date(input.nowMs + minutes * 60_000).toISOString(),
  };
}

export const PUBLIC_ACCOUNT_METADATA_KEYS = [
  "instagram_user_id",
  "instagram_username",
  "instagram_account_type",
  "instagram_is_professional",
  "instagram_linked",
  "facebook_page_id",
  "facebook_page_name",
  "granted_permissions",
  "missing_permissions",
  "token_checked_at",
  "token_expires_at",
  "token_valid",
  "connection_error",
  "tiktok_username",
  "youtube_channel_id",
  "youtube_channel_title",
] as const;

export function publicAccountMetadata(meta: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const src = meta || {};
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_ACCOUNT_METADATA_KEYS) {
    if (src[key] != null) out[key] = src[key];
  }
  return out;
}
