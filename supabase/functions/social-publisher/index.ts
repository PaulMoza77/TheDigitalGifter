import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { assertAdmin, getAuthUser, getServiceClient, isServiceRoleRequest, readJson } from "../_shared/supabase.ts";
import { dispatchPublish } from "../_shared/social/adapters.ts";
import { decryptSecret, encryptSecret } from "../_shared/social/crypto.ts";
import {
  callbackRedirect,
  finishMetaOAuth,
  inspectMetaToken,
  invalidateMetaClientConfigCache,
  metaAuthorizeUrl,
  metaRedirectUri,
  resolveMetaClientConfig,
  safeOauthError,
} from "../_shared/social/metaAuth.ts";
import { isAllowedAdminReturn, isMetaPlatform, metaMediaKind, metaRetryPlan, publicAccountMetadata, sanitizeProviderError } from "../_shared/social/meta.ts";
import { buildProviderReadiness } from "../_shared/social/readiness.ts";
import {
  ensureYouTubeAccessToken,
  finishYouTubeOAuth,
  inspectYouTubeToken,
  invalidateYouTubeClientConfigCache,
  safeYouTubeOauthError,
  youtubeAuthorizeUrl,
  youtubeCallbackRedirect,
  youtubeRedirectUri,
} from "../_shared/social/youtubeAuth.ts";
import {
  isYouTubePlatform,
  normalizePrivacyStatus,
  parseYouTubeTags,
  youtubeRetryPlan,
} from "../_shared/social/youtube.ts";

type Platform =
  | "instagram_reels"
  | "instagram_photo"
  | "instagram_video"
  | "facebook_reels"
  | "facebook_photo"
  | "facebook_video"
  | "tiktok"
  | "youtube_shorts"
  | "youtube_video";
type Provider = "meta" | "tiktok" | "youtube";

const PLATFORMS: Platform[] = [
  "instagram_reels",
  "instagram_photo",
  "instagram_video",
  "facebook_reels",
  "facebook_photo",
  "facebook_video",
  "tiktok",
  "youtube_shorts",
  "youtube_video",
];

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function env(name: string): string {
  return asString(Deno.env.get(name));
}

function publicBaseUrl(): string {
  return (
    env("SOCIAL_PUBLISHER_PUBLIC_BASE_URL") ||
    env("SITE_URL") ||
    env("PUBLIC_SITE_URL") ||
    "https://www.thedigitalgifter.com"
  ).replace(/\/$/, "");
}

function oauthRedirectUri(): string {
  const explicit = env("SOCIAL_OAUTH_REDIRECT_URL");
  if (explicit) return explicit;
  return `${env("SUPABASE_URL").replace(/\/$/, "")}/functions/v1/social-publisher`;
}

function livePostsEnabled(settingsFlag: boolean): boolean {
  const envFlag = env("SOCIAL_PUBLISHER_ALLOW_LIVE_POSTS").toLowerCase();
  if (["1", "true", "yes"].includes(envFlag)) return true;
  return settingsFlag;
}

function providerFor(platform: Platform): Provider {
  if (platform === "tiktok") return "tiktok";
  if (platform === "youtube_shorts" || platform === "youtube_video") return "youtube";
  return "meta";
}

function apiError(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

function htmlRedirect(to: string) {
  return new Response(null, { status: 302, headers: { Location: to } });
}

function oauthConfigured() {
  return {
    meta: Boolean(env("META_APP_ID") && env("META_APP_SECRET") && env("META_CONFIGURATION_ID")),
    tiktok: Boolean((env("TIKTOK_CLIENT_KEY") || env("TIKTOK_CLIENT_KEY_ID")) && env("TIKTOK_CLIENT_SECRET")),
    youtube: Boolean(
      (env("YOUTUBE_CLIENT_ID") || env("GOOGLE_OAUTH_CLIENT_ID") || env("GOOGLE_CLIENT_ID")) &&
        (env("YOUTUBE_CLIENT_SECRET") || env("GOOGLE_OAUTH_CLIENT_SECRET") || env("GOOGLE_CLIENT_SECRET")),
    ),
  };
}

async function youtubeConfigured(service: ReturnType<typeof getServiceClient>) {
  const envReady = oauthConfigured().youtube;
  if (envReady) return true;
  const { data } = await service
    .from("social_provider_configs")
    .select("client_id,client_secret_ciphertext")
    .eq("provider", "youtube")
    .maybeSingle();
  return Boolean(data?.client_id && data?.client_secret_ciphertext);
}

async function metaConfigured(service: ReturnType<typeof getServiceClient>) {
  const envReady = oauthConfigured().meta;
  if (envReady) return true;
  const resolved = await resolveMetaClientConfig(service);
  return resolved.missing.length === 0;
}

function envGaps() {
  const missingMeta: string[] = [];
  if (!env("META_APP_ID")) missingMeta.push("META_APP_ID");
  if (!env("META_APP_SECRET")) missingMeta.push("META_APP_SECRET");
  if (!env("META_CONFIGURATION_ID")) missingMeta.push("META_CONFIGURATION_ID");
  const missingTt: string[] = [];
  if (!oauthConfigured().tiktok) missingTt.push("TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET");
  const missingYt: string[] = [];
  if (!oauthConfigured().youtube) missingYt.push("YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REDIRECT_URI");
  return { meta: missingMeta, tiktok: missingTt, youtube: missingYt };
}

function providerReadiness(
  configured: ReturnType<typeof oauthConfigured>,
  live: boolean,
  accounts: Array<{ provider?: string; status?: string; metadata?: Record<string, unknown> | null }> = [],
) {
  const gaps = envGaps();
  if (configured.meta) gaps.meta = [];
  if (configured.youtube) gaps.youtube = [];
  return buildProviderReadiness({
    configured,
    live,
    missingEnv: gaps,
    accounts,
  });
}

function sanitizeAccount(row: Record<string, unknown>) {
  return {
    id: row.id,
    provider: row.provider,
    account_id: row.account_id,
    account_name: row.account_name,
    status: row.status,
    expires_at: row.expires_at,
    metadata: publicMetadata(row.metadata as Record<string, unknown> | null),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function publicMetadata(meta: Record<string, unknown> | null) {
  return publicAccountMetadata(meta);
}

function isAssetSrcAllowed(src: string): boolean {
  if (src.startsWith("/api/clip-factory") && !src.includes("..")) return true;
  return src.startsWith("/assets/") && !src.includes("..") && !src.includes("://");
}

function absoluteMediaUrl(src: string): string {
  if (src.startsWith("https://") || src.startsWith("http://")) return src;
  return `${publicBaseUrl()}${src.startsWith("/") ? src : `/${src}`}`;
}

function rollup(targets: Array<{ status: string }>): string {
  if (!targets.length) return "draft";
  if (targets.every((t) => t.status === "cancelled")) return "cancelled";
  if (targets.some((t) => t.status === "processing")) return "processing";
  const active = targets.filter((t) => t.status !== "cancelled");
  const published = active.filter((t) => t.status === "published").length;
  const failed = active.filter((t) => t.status === "failed").length;
  const scheduled = active.filter((t) => t.status === "scheduled" || t.status === "draft").length;
  if (published === active.length && active.length > 0) return "published";
  if (published > 0 && (failed > 0 || scheduled > 0)) return "partial";
  if (failed === active.length && scheduled === 0) return "failed";
  if (scheduled > 0) return "scheduled";
  return "partial";
}

function validateAsset(asset: Record<string, unknown>, platforms: Platform[]) {
  const issues: Array<{ code: string; message: string; platform?: string }> = [];
  const kind = asString(asset.kind) || "reel";
  const src = asString(asset.src);
  const filename = asString(asset.filename);
  const duration = Number(asset.durationSeconds);
  const width = Number(asset.width ?? 1080);
  const height = Number(asset.height ?? 1920);
  if (!isAssetSrcAllowed(src)) issues.push({ code: "media_missing", message: "Asset path is not a library media file." });
  const photoPlatforms = platforms.filter((platform) => metaMediaKind(platform) === "photo");
  const videoPlatforms = platforms.filter((platform) => metaMediaKind(platform) !== "photo");
  const isPhoto = kind === "photo" || /\.(jpe?g|png|webp)$/i.test(filename);
  if (isPhoto && videoPlatforms.length) {
    issues.push({ code: "not_a_reel", message: "Photos cannot be published as Reels or videos." });
  }
  if (!isPhoto && photoPlatforms.length) {
    issues.push({ code: "not_a_photo", message: "This file is not an image." });
  }
  if (!platforms.length) issues.push({ code: "no_platforms", message: "Select at least one platform." });
  const verticalPlatforms = platforms.filter(
    (platform) =>
      platform === "instagram_reels" ||
      platform === "facebook_reels" ||
      platform === "tiktok" ||
      platform === "youtube_shorts",
  );
  if (
    verticalPlatforms.length &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    Math.abs(width / height - 9 / 16) > 0.08
  ) {
    issues.push({ code: "aspect_ratio", message: `Vertical 9:16 required. File is ${width}×${height}.` });
  }
  for (const platform of verticalPlatforms) {
    const max = platform === "instagram_reels" || platform === "facebook_reels" ? 90 : 60;
    if (Number.isFinite(duration) && duration > max) {
      issues.push({ code: "too_long", platform, message: `${platform} max duration is ${max}s.` });
    }
    if (Number.isFinite(duration) && duration < 1) {
      issues.push({ code: "too_short", platform, message: `${platform} video is too short.` });
    }
  }
  if (platforms.includes("youtube_video") && Number.isFinite(duration) && duration < 1) {
    issues.push({ code: "too_short", platform: "youtube_video", message: "youtube_video is too short." });
  }
  if (
    platforms.includes("youtube_shorts") ||
    platforms.includes("youtube_video")
  ) {
    // title is validated at create time via youtube_title
  }
  return { ok: issues.length === 0, issues };
}

function parsePlatforms(value: unknown): Platform[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => asString(item)))].filter((item): item is Platform =>
    PLATFORMS.includes(item as Platform),
  );
}

async function loadSettings(service: ReturnType<typeof getServiceClient>) {
  const { data } = await service.from("social_publisher_settings").select("*").eq("id", 1).maybeSingle();
  return {
    timezone: asString(data?.timezone) || "UTC",
    live_posts_enabled: Boolean(data?.live_posts_enabled),
  };
}

async function attachTargets(
  service: ReturnType<typeof getServiceClient>,
  publications: Array<Record<string, unknown>>,
) {
  if (!publications.length) return [];
  const ids = publications.map((p) => p.id);
  const { data: targets } = await service
    .from("social_publication_targets")
    .select(
      "id,publication_id,provider,platform,status,attempts,remote_post_id,remote_url,published_at,last_error,next_retry_at,platform_caption,platform_title",
    )
    .in("publication_id", ids);
  const byPub = new Map<string, Record<string, unknown>[]>();
  for (const t of targets || []) {
    const list = byPub.get(String(t.publication_id)) || [];
    list.push(t as Record<string, unknown>);
    byPub.set(String(t.publication_id), list);
  }
  return publications.map((p) => ({
    ...p,
    targets: byPub.get(String(p.id)) || [],
  }));
}

async function refreshPublicationStatus(
  service: ReturnType<typeof getServiceClient>,
  publicationId: string,
) {
  const { data: targets } = await service
    .from("social_publication_targets")
    .select("status")
    .eq("publication_id", publicationId);
  const status = rollup(targets || []);
  await service
    .from("social_publications")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", publicationId);
  return status;
}

async function upsertAccount(
  service: ReturnType<typeof getServiceClient>,
  row: Record<string, unknown>,
) {
  const { data: existing } = await service
    .from("social_accounts")
    .select("id")
    .eq("provider", row.provider)
    .eq("account_id", row.account_id)
    .maybeSingle();
  if (existing?.id) {
    await service
      .from("social_accounts")
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    return existing.id as string;
  }
  const { data, error } = await service.from("social_accounts").insert(row).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function consumeOauthState(service: ReturnType<typeof getServiceClient>, state: string) {
  if (!state || state.length > 80) return { error: "invalid_state" as const };
  const { data: row } = await service.from("social_oauth_states").select("*").eq("state", state).maybeSingle();
  if (!row) return { error: "invalid_state" as const };
  if (row.expires_at && new Date(String(row.expires_at)).getTime() < Date.now()) {
    await service.from("social_oauth_states").delete().eq("state", state);
    return { error: "expired_state" as const };
  }
  await service.from("social_oauth_states").delete().eq("state", state);
  return { row: row as Record<string, unknown> };
}

function oauthReturn(row: Record<string, unknown> | null, params: Record<string, string>) {
  const requested = asString(row?.redirect_to);
  if (requested && isAllowedAdminReturn(requested, publicBaseUrl())) {
    const url = new URL(requested);
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
    return url.toString();
  }
  return callbackRedirect(params);
}

async function runMetaCallback(
  service: ReturnType<typeof getServiceClient>,
  input: { code: string; state: string; error: string },
) {
  if (input.error) {
    if (input.state) await service.from("social_oauth_states").delete().eq("state", input.state);
    return callbackRedirect({ oauth: "error", message: safeOauthError(input.error) });
  }
  const consumed = await consumeOauthState(service, input.state);
  if ("error" in consumed && consumed.error) {
    return callbackRedirect({ oauth: "error", message: consumed.error });
  }
  const row = consumed.row;
  if (!row || asString(row.provider) !== "meta") {
    return callbackRedirect({ oauth: "error", message: "invalid_state" });
  }
  try {
    const result = await finishMetaOAuth(service, input.code, asString(row.oauth_redirect_uri) || metaRedirectUri());
    if (result.status !== "connected") {
      return oauthReturn(row, { oauth: "error", message: safeOauthError(result.connectionError || "oauth_failed") });
    }
    return oauthReturn(row, { oauth: "meta", ok: "1" });
  } catch {
    return oauthReturn(row, { oauth: "error", message: "exchange_failed" });
  }
}

async function runYouTubeCallback(
  service: ReturnType<typeof getServiceClient>,
  input: { code: string; state: string; error: string },
) {
  if (input.error) {
    if (input.state) await service.from("social_oauth_states").delete().eq("state", input.state);
    return youtubeCallbackRedirect({ oauth: "error", message: safeYouTubeOauthError(input.error) });
  }
  const consumed = await consumeOauthState(service, input.state);
  if ("error" in consumed && consumed.error) {
    return youtubeCallbackRedirect({ oauth: "error", message: consumed.error });
  }
  const row = consumed.row;
  if (!row || asString(row.provider) !== "youtube") {
    return youtubeCallbackRedirect({ oauth: "error", message: "invalid_state" });
  }
  try {
    const redirectUri = asString(row.oauth_redirect_uri) || youtubeRedirectUri();
    const result = await finishYouTubeOAuth(service, input.code, redirectUri);
    if (result.status !== "connected") {
      return oauthReturn(row, {
        oauth: "error",
        message: safeYouTubeOauthError(result.connectionError || "oauth_failed"),
      });
    }
    return oauthReturn(row, { oauth: "youtube", ok: "1" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "exchange_failed";
    return oauthReturn(row, { oauth: "error", message: safeYouTubeOauthError(message) });
  }
}

async function exchangeTikTok(code: string) {
  const body = new URLSearchParams({
    client_key: env("TIKTOK_CLIENT_KEY") || env("TIKTOK_CLIENT_KEY_ID"),
    client_secret: env("TIKTOK_CLIENT_SECRET"),
    code,
    grant_type: "authorization_code",
    redirect_uri: oauthRedirectUri(),
  });
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    open_id?: string;
    error?: string;
    error_description?: string;
  };
}

async function handleOauthCallback(req: Request) {
  const url = new URL(req.url);
  const code = asString(url.searchParams.get("code"));
  const state = asString(url.searchParams.get("state"));
  const err = asString(url.searchParams.get("error"));
  const service = getServiceClient();
  const peeked = state
    ? await service.from("social_oauth_states").select("provider").eq("state", state).maybeSingle()
    : { data: null };
  const providerPeek = asString(peeked.data?.provider);
  if (providerPeek === "meta" || (!peeked.data && err)) {
    return htmlRedirect(await runMetaCallback(service, { code, state, error: err }));
  }
  if (providerPeek === "youtube") {
    return htmlRedirect(await runYouTubeCallback(service, { code, state, error: err }));
  }
  if (err) {
    if (state) await service.from("social_oauth_states").delete().eq("state", state);
    return htmlRedirect(callbackRedirect({ oauth: "error", message: safeOauthError(err) }));
  }
  const consumed = await consumeOauthState(service, state);
  if ("error" in consumed && consumed.error) {
    return htmlRedirect(callbackRedirect({ oauth: "error", message: consumed.error }));
  }
  const row = consumed.row;
  const provider = asString(row?.provider) as Provider;
  try {
    if (provider === "meta" || provider === "youtube") {
      return htmlRedirect(callbackRedirect({ oauth: "error", message: "invalid_state" }));
    } else if (provider === "tiktok") {
      const exchanged = await exchangeTikTok(code);
      if (!exchanged.access_token) {
        throw new Error(exchanged.error_description || exchanged.error || "TikTok token exchange failed");
      }
      await upsertAccount(service, {
        provider: "tiktok",
        account_id: exchanged.open_id || "tiktok",
        account_name: "TikTok",
        status: "connected",
        access_token_ciphertext: await encryptSecret(exchanged.access_token),
        refresh_token_ciphertext: exchanged.refresh_token ? await encryptSecret(exchanged.refresh_token) : null,
        expires_at: exchanged.expires_in
          ? new Date(Date.now() + exchanged.expires_in * 1000).toISOString()
          : null,
        metadata: { open_id: exchanged.open_id || null },
      });
    } else {
      return htmlRedirect(callbackRedirect({ oauth: "error", message: "invalid_state" }));
    }
    return htmlRedirect(oauthReturn(row || null, { oauth: provider, ok: "1" }));
  } catch {
    return htmlRedirect(callbackRedirect({ oauth: "error", message: "exchange_failed" }));
  }
}

function cronAuthorized(req: Request): boolean {
  const secret = env("SOCIAL_PUBLISHER_CRON_SECRET") || env("CRON_SECRET") || env("PET_ANALYTICS_CRON_SECRET");
  if (!secret) return isServiceRoleRequest(req);
  const provided = asString(
    req.headers.get("x-cron-secret") ||
      req.headers.get("x-social-publisher-cron-secret") ||
      (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""),
  );
  return provided === secret || isServiceRoleRequest(req);
}

async function accountForPlatform(
  service: ReturnType<typeof getServiceClient>,
  platform: Platform,
) {
  const provider = providerFor(platform);
  const { data } = await service
    .from("social_accounts")
    .select("*")
    .eq("provider", provider)
    .eq("status", "connected")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const meta = (data.metadata || {}) as Record<string, unknown>;
  const pageCipher = asString(meta.page_access_token_ciphertext);
  if (pageCipher) {
    const pageToken = await decryptSecret(pageCipher);
    if (pageToken) meta.page_access_token = pageToken;
  }

  if (provider === "youtube") {
    const ensured = await ensureYouTubeAccessToken(service, data as Record<string, unknown>);
    return {
      id: data.id as string,
      provider,
      accountId: asString(data.account_id),
      status: ensured.status,
      accessToken: ensured.accessToken,
      metadata: meta,
    };
  }

  const access = await decryptSecret(data.access_token_ciphertext as string);
  if (data.expires_at && new Date(String(data.expires_at)).getTime() < Date.now()) {
    await service.from("social_accounts").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", data.id);
    return {
      id: data.id as string,
      provider,
      accountId: asString(data.account_id),
      status: "expired",
      accessToken: access || "",
      metadata: meta,
    };
  }
  return {
    id: data.id as string,
    provider,
    accountId: asString(data.account_id),
    status: asString(data.status),
    accessToken: access || "",
    metadata: meta,
  };
}

async function processTarget(
  service: ReturnType<typeof getServiceClient>,
  target: Record<string, unknown>,
  allowLive: boolean,
) {
  if (asString(target.remote_post_id)) {
    return { skipped: true, reason: "already_published" };
  }
  const { data: publication } = await service
    .from("social_publications")
    .select("*")
    .eq("id", target.publication_id)
    .single();
  if (!publication || publication.status === "cancelled") {
    await service
      .from("social_publication_targets")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", target.id);
    return { skipped: true, reason: "cancelled" };
  }
  const platform = asString(target.platform) as Platform;
  const account = await accountForPlatform(service, platform);
  const videoUrl = absoluteMediaUrl(asString(publication.asset_src));
  const caption = asString(target.platform_caption) || asString(publication.caption);
  const hashtags = asString(publication.hashtags);

  if (!account || account.status !== "connected" || !account.accessToken) {
    await service
      .from("social_publication_targets")
      .update({
        status: "failed",
        last_error:
          account?.status === "expired"
            ? "credentials_expired"
            : "account_disconnected",
        lease_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", target.id);
    await refreshPublicationStatus(service, String(publication.id));
    return { ok: false, code: account?.status === "expired" ? "credentials_expired" : "account_disconnected" };
  }

  if (!allowLive) {
    await service
      .from("social_publication_targets")
      .update({
        status: "scheduled",
        last_error: "IMPLEMENTED — WAITING FOR PROVIDER APPROVAL / SOCIAL_PUBLISHER_ALLOW_LIVE_POSTS. No production post was made.",
        lease_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        claimed_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", target.id);
    return { skipped: true, reason: "live_posting_disabled" };
  }

  if (isYouTubePlatform(platform)) {
    await service
      .from("social_publication_targets")
      .update({ status: "uploading", updated_at: new Date().toISOString() })
      .eq("id", target.id)
      .is("remote_post_id", null);
  }

  const options = (target.platform_options || {}) as Record<string, unknown>;
  const result = await dispatchPublish({
    platform,
    videoUrl,
    caption,
    hashtags,
    title: asString(target.platform_title) || null,
    containerId: asString(target.provider_container_id) || null,
    account: {
      provider: account.provider,
      accountId: account.accountId,
      status: account.status,
      accessToken: account.accessToken,
      metadata: account.metadata,
    },
    youtube: isYouTubePlatform(platform)
      ? {
          tags: parseYouTubeTags(options.tags ?? hashtags),
          categoryId: asString(options.categoryId) || "24",
          privacyStatus: normalizePrivacyStatus(options.privacyStatus, "private"),
          madeForKids: options.madeForKids === true,
          publishAt: asString(options.publishAt) || null,
        }
      : null,
    persistYouTubeUploadSession: isYouTubePlatform(platform)
      ? async (uploadUri: string) => {
          await service
            .from("social_publication_targets")
            .update({
              status: "uploading",
              provider_container_id: uploadUri,
              updated_at: new Date().toISOString(),
            })
            .eq("id", target.id)
            .is("remote_post_id", null);
        }
      : undefined,
  });

  if (result.ok) {
    await service
      .from("social_publication_targets")
      .update({
        status: "published",
        remote_post_id: result.remotePostId,
        remote_url: result.remoteUrl || null,
        published_at: new Date().toISOString(),
        last_error: null,
        provider_container_id: null,
        lease_expires_at: null,
        social_account_id: account.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", target.id)
      .is("remote_post_id", null);
    await refreshPublicationStatus(service, String(publication.id));
    return { ok: true, remotePostId: result.remotePostId };
  }

  const retry = isYouTubePlatform(platform)
    ? youtubeRetryPlan({
        platform,
        attempts: Number(target.attempts || 1),
        retryable: Boolean(result.retryable),
        remotePostId: asString(target.remote_post_id) || null,
        nowMs: Date.now(),
      })
    : metaRetryPlan({
        platform,
        attempts: Number(target.attempts || 1),
        retryable: Boolean(result.retryable),
        remotePostId: asString(target.remote_post_id) || null,
        nowMs: Date.now(),
      });
  const managedRetry = isMetaPlatform(platform) || isYouTubePlatform(platform);
  await service
    .from("social_publication_targets")
    .update({
      status: managedRetry ? retry.status : "failed",
      last_error: sanitizeProviderError(`${result.code}: ${result.message}`),
      lease_expires_at: null,
      next_retry_at: managedRetry
        ? retry.nextRetryAt
        : result.retryable
          ? new Date(Date.now() + 5 * 60 * 1000).toISOString()
          : null,
      provider_container_id: result.containerId || asString(target.provider_container_id) || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", target.id)
    .is("remote_post_id", null);
  await refreshPublicationStatus(service, String(publication.id));
  return { ok: false, code: result.code, message: result.message };
}

async function tickWorker(service: ReturnType<typeof getServiceClient>, allowLive: boolean) {
  const workerId = `worker-${crypto.randomUUID()}`;
  const { data: claimed, error } = await service.rpc("claim_social_publication_targets", {
    p_limit: 8,
    p_worker_id: workerId,
    p_now: new Date().toISOString(),
  });
  if (error) throw error;
  const rows = (claimed || []) as Record<string, unknown>[];
  const results = [];
  for (const target of rows) {
    results.push({ target_id: target.id, ...(await processTarget(service, target, allowLive)) });
  }
  return { claimed: rows.length, workerId, results };
}

async function createPublicationRow(
  service: ReturnType<typeof getServiceClient>,
  input: {
    asset: Record<string, unknown>;
    platforms: Platform[];
    caption: string;
    hashtags: string;
    youtubeTitle?: string;
    youtubeOptions?: Record<string, unknown>;
    platformCaptions?: Record<string, string>;
    scheduledAt: string;
    timezone: string;
    createdBy?: string | null;
  },
) {
  const { data: publication, error } = await service
    .from("social_publications")
    .insert({
      library_asset_id: asString(input.asset.id),
      asset_title: asString(input.asset.title),
      asset_src: asString(input.asset.src),
      status: "scheduled",
      scheduled_at: input.scheduledAt,
      timezone: input.timezone,
      caption: input.caption,
      hashtags: input.hashtags,
      created_by: input.createdBy || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  const ytOptions = {
    privacyStatus: normalizePrivacyStatus(input.youtubeOptions?.privacyStatus, "private"),
    madeForKids: input.youtubeOptions?.madeForKids === true,
    categoryId: asString(input.youtubeOptions?.categoryId) || "24",
    tags: parseYouTubeTags(input.youtubeOptions?.tags ?? input.hashtags),
    publishAt: asString(input.youtubeOptions?.publishAt) || null,
  };
  const targets = input.platforms.map((platform) => ({
    publication_id: publication.id,
    provider: providerFor(platform),
    platform,
    platform_caption: input.platformCaptions?.[platform] || null,
    platform_title: isYouTubePlatform(platform) ? input.youtubeTitle || null : null,
    platform_options: isYouTubePlatform(platform) ? ytOptions : {},
    status: "scheduled",
    idempotency_key: `${publication.id}:${platform}`,
  }));
  const { error: tErr } = await service.from("social_publication_targets").insert(targets);
  if (tErr) throw tErr;
  await service
    .from("social_publications")
    .update({ status: "scheduled", updated_at: new Date().toISOString() })
    .eq("id", publication.id);
  const [row] = await attachTargets(service, [publication]);
  return row;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  const url = new URL(req.url);

    if (req.method === "GET" && (url.searchParams.get("code") || url.searchParams.get("state") || url.searchParams.get("error"))) {
    try {
      return await handleOauthCallback(req);
    } catch {
      return htmlRedirect(callbackRedirect({ oauth: "error", message: "oauth_failed" }));
    }
  }

  const body = req.method === "GET" ? Object.fromEntries(url.searchParams.entries()) : await readJson<Record<string, unknown>>(req);
  const action = asString(body.action || url.searchParams.get("action"));

  try {
    if (action === "tick") {
      if (!cronAuthorized(req)) return apiError("Unauthorized", 401);
      const service = getServiceClient();
      const settings = await loadSettings(service);
      const result = await tickWorker(service, livePostsEnabled(settings.live_posts_enabled));
      return jsonResponse({ ok: true, ...result, livePostsEnabled: livePostsEnabled(settings.live_posts_enabled) });
    }

    if (action === "meta_oauth_callback") {
      if (!isServiceRoleRequest(req)) return apiError("Unauthorized", 401);
      const service = getServiceClient();
      const redirect = await runMetaCallback(service, {
        code: asString(body.code),
        state: asString(body.state),
        error: asString(body.error),
      });
      return jsonResponse({ redirect });
    }

    if (action === "youtube_oauth_callback") {
      if (!isServiceRoleRequest(req)) return apiError("Unauthorized", 401);
      const service = getServiceClient();
      const redirect = await runYouTubeCallback(service, {
        code: asString(body.code),
        state: asString(body.state),
        error: asString(body.error),
      });
      return jsonResponse({ redirect });
    }

    if (action === "upsert_youtube_provider_config" || action === "upsert_meta_provider_config") {
      if (!isServiceRoleRequest(req)) return apiError("Unauthorized", 401);
      const service = getServiceClient();
      const provider = action === "upsert_meta_provider_config" ? "meta" : "youtube";
      const clientId = asString(body.client_id);
      const clientSecret = asString(body.client_secret);
      const redirectUri =
        asString(body.redirect_uri) || (provider === "meta" ? metaRedirectUri() : youtubeRedirectUri());
      const configurationId = asString(body.configuration_id);
      if (!clientId || !clientSecret) return apiError("client_id and client_secret required");
      if (provider === "meta" && !configurationId) return apiError("configuration_id required");
      const row = {
        provider,
        client_id: clientId,
        client_secret_ciphertext: await encryptSecret(clientSecret),
        redirect_uri: redirectUri,
        metadata: {
          oauth_app_status: "testing",
          updated_by: "service_role",
          updated_at: new Date().toISOString(),
          ...(provider === "meta" ? { configuration_id: configurationId } : {}),
        },
        updated_at: new Date().toISOString(),
      };
      const { data: existing } = await service
        .from("social_provider_configs")
        .select("provider")
        .eq("provider", provider)
        .maybeSingle();
      if (existing?.provider) {
        const updated = await service.from("social_provider_configs").update(row).eq("provider", provider);
        if (updated.error) throw updated.error;
      } else {
        const inserted = await service.from("social_provider_configs").insert(row);
        if (inserted.error) throw inserted.error;
      }
      if (provider === "meta") invalidateMetaClientConfigCache();
      else invalidateYouTubeClientConfigCache();
      return jsonResponse({
        ok: true,
        provider,
        has_client_id: true,
        has_secret: true,
        has_configuration_id: provider === "meta" ? true : undefined,
      });
    }

    const { user } = await getAuthUser(req);
    await assertAdmin(user?.email);
    const service = getServiceClient();
    const settings = await loadSettings(service);
    const configured = oauthConfigured();
    configured.youtube = configured.youtube || (await youtubeConfigured(service));
    configured.meta = configured.meta || (await metaConfigured(service));

    if (action === "bootstrap" || !action) {
      const { data: accounts } = await service.from("social_accounts").select("*").order("provider");
      const publicAccounts = (accounts || []).map((row) => sanitizeAccount(row as Record<string, unknown>));
      return jsonResponse({
        timezone: settings.timezone,
        livePostsEnabled: livePostsEnabled(settings.live_posts_enabled),
        oauthConfigured: configured,
        accounts: publicAccounts,
        providerReadiness: providerReadiness(
          configured,
          livePostsEnabled(settings.live_posts_enabled),
          publicAccounts,
        ),
      });
    }

    if (action === "connection_health") {
      const provider = asString(body.provider) || "meta";
      const { data } = await service
        .from("social_accounts")
        .select("*")
        .eq("provider", provider)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data || data.status === "revoked") {
        return jsonResponse({ ok: true, valid: false, status: "not_connected", published: false, provider });
      }
      if (provider === "youtube") {
        const report = await inspectYouTubeToken(service, data as Record<string, unknown>);
        return jsonResponse({ ...report, provider: "youtube", published: false });
      }
      const report = await inspectMetaToken(service, data as Record<string, unknown>);
      return jsonResponse({ ...report, provider: "meta" });
    }

    if (action === "publish_test" || action === "prepare_test_upload") {
      const provider = asString(body.provider) || (action === "prepare_test_upload" ? "youtube" : "meta");
      if (provider === "youtube") {
        const { data } = await service
          .from("social_accounts")
          .select("status,metadata,expires_at")
          .eq("provider", "youtube")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const meta = publicMetadata((data?.metadata || {}) as Record<string, unknown>);
        const missing = Array.isArray(meta.missing_scopes)
          ? meta.missing_scopes.map(String)
          : Array.isArray(meta.missing_permissions)
            ? meta.missing_permissions.map(String)
            : [];
        const blockers: string[] = [];
        if (!data || data.status !== "connected") blockers.push("youtube_not_connected");
        if (!meta.youtube_channel_id) blockers.push("youtube_channel_missing");
        if (missing.length) blockers.push("missing_scopes");
        if (meta.has_refresh_token === false) blockers.push("refresh_token_missing");
        blockers.push("live_posts_disabled");
        blockers.push("oauth_app_in_testing");
        return jsonResponse({
          ok: true,
          published: false,
          executed: false,
          upload_started: false,
          prepared: blockers.filter((item) => item !== "live_posts_disabled" && item !== "oauth_app_in_testing").length === 0,
          ready: blockers.length === 2 && blockers.includes("live_posts_disabled") && blockers.includes("oauth_app_in_testing"),
          blockers,
          youtube_channel_id: meta.youtube_channel_id || null,
          youtube_channel_title: meta.youtube_channel_title || null,
          youtube_channel_handle: meta.youtube_channel_handle || null,
          granted_scopes: meta.granted_scopes || meta.granted_permissions || [],
          missing_scopes: missing,
          oauth_app_status: meta.oauth_app_status || "testing",
          refresh_token_warning: meta.refresh_token_warning || null,
          has_refresh_token: meta.has_refresh_token !== false,
          message:
            "No YouTube upload was started. Live posting stays off until you approve it. OAuth app is in Testing.",
        });
      }
      const { data } = await service
        .from("social_accounts")
        .select("status,metadata")
        .eq("provider", "meta")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const meta = publicMetadata((data?.metadata || {}) as Record<string, unknown>);
      const missing = Array.isArray(meta.missing_permissions) ? meta.missing_permissions.map(String) : [];
      const blockers: string[] = [];
      if (!data || data.status !== "connected") blockers.push("meta_not_connected");
      if (!meta.facebook_page_id) blockers.push("facebook_page_missing");
      if (!meta.instagram_user_id || meta.instagram_linked === false) blockers.push("instagram_not_linked");
      if (meta.instagram_is_professional === false) blockers.push("instagram_not_professional");
      if (missing.length) blockers.push("missing_permissions");
      blockers.push("live_posts_disabled");
      return jsonResponse({
        ok: true,
        published: false,
        executed: false,
        ready: blockers.length === 1 && blockers[0] === "live_posts_disabled",
        blockers,
        facebook_page_id: meta.facebook_page_id || null,
        facebook_page_name: meta.facebook_page_name || null,
        instagram_user_id: meta.instagram_user_id || null,
        instagram_username: meta.instagram_username || null,
        granted_permissions: meta.granted_permissions || [],
        missing_permissions: missing,
        message: "No post was sent to Facebook or Instagram. Live posting stays off until you approve it.",
      });
    }

    if (action === "connect_url") {
      const provider = asString(body.provider) as Provider;
      const state = crypto.randomUUID();
      const redirectUri = oauthRedirectUri();
      if (provider === "meta") {
        const authorized = await metaAuthorizeUrl(state, { service });
        if (!authorized.url) {
          return jsonResponse({
            url: null,
            waitingForApproval: true,
            missing: authorized.missing,
          });
        }
        await service.from("social_oauth_states").insert({
          state,
          provider: "meta",
          created_by: user?.id || null,
          redirect_to: `${publicBaseUrl()}/admin/social-accounts`,
          oauth_redirect_uri: authorized.redirectUri || metaRedirectUri(),
        });
        return jsonResponse({ url: authorized.url });
      }
      if (provider === "youtube") {
        const authorized = await youtubeAuthorizeUrl(state, { forceConsent: true, service });
        if (!authorized.url) {
          return jsonResponse({
            url: null,
            waitingForApproval: true,
            missing: authorized.missing,
          });
        }
        await service.from("social_oauth_states").insert({
          state,
          provider: "youtube",
          created_by: user?.id || null,
          redirect_to: `${publicBaseUrl()}/admin/social-accounts`,
          oauth_redirect_uri: authorized.redirectUri,
        });
        return jsonResponse({ url: authorized.url });
      }
      await service.from("social_oauth_states").insert({
        state,
        provider,
        created_by: user?.id || null,
        redirect_to: `${publicBaseUrl()}/admin/social-accounts`,
      });
      if (provider === "tiktok") {
        if (!configured.tiktok) {
          return jsonResponse({
            url: null,
            waitingForApproval: true,
            missing: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
          });
        }
        const auth = new URL("https://www.tiktok.com/v2/auth/authorize/");
        auth.searchParams.set("client_key", env("TIKTOK_CLIENT_KEY") || env("TIKTOK_CLIENT_KEY_ID"));
        auth.searchParams.set("redirect_uri", redirectUri);
        auth.searchParams.set("state", state);
        auth.searchParams.set("response_type", "code");
        auth.searchParams.set("scope", "user.info.basic,video.upload,video.publish");
        return jsonResponse({ url: auth.toString() });
      }
      return jsonResponse({
        url: null,
        waitingForApproval: true,
        missing: ["unsupported_provider"],
      });
    }

    if (action === "disconnect") {
      const id = asString(body.account_id);
      const { data: existing } = await service.from("social_accounts").select("metadata").eq("id", id).maybeSingle();
      const metadata = { ...((existing?.metadata || {}) as Record<string, unknown>) };
      delete metadata.page_access_token_ciphertext;
      delete metadata.page_access_token;
      await service
        .from("social_accounts")
        .update({
          status: "revoked",
          access_token_ciphertext: null,
          refresh_token_ciphertext: null,
          metadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      return jsonResponse({ ok: true });
    }

    if (action === "list_publications") {
      const tab = asString(body.tab) || "upcoming";
      let query = service.from("social_publications").select("*").order("scheduled_at", { ascending: tab !== "published" });
      if (tab === "upcoming" || tab === "calendar") query = query.in("status", ["scheduled", "processing", "partial"]).gte("scheduled_at", new Date(Date.now() - 3600_000).toISOString());
      if (tab === "published") query = query.in("status", ["published", "partial"]);
      if (tab === "failed") query = query.in("status", ["failed", "partial"]);
      const { data, error } = await query.limit(200);
      if (error) throw error;
      const items = await attachTargets(service, (data || []) as Record<string, unknown>[]);
      return jsonResponse({ items });
    }

    if (action === "get_publication") {
      const { data, error } = await service
        .from("social_publications")
        .select("*")
        .eq("id", asString(body.publication_id))
        .single();
      if (error) throw error;
      const [publication] = await attachTargets(service, [data as Record<string, unknown>]);
      return jsonResponse({ publication });
    }

    if (action === "create_publication") {
      const platforms = parsePlatforms(body.platforms);
      const asset = (body.asset || {}) as Record<string, unknown>;
      const validation = validateAsset(asset, platforms);
      if (!validation.ok) return jsonResponse({ error: "Media validation failed", issues: validation.issues }, 400);
      const mode = asString(body.mode) || "schedule";
      const timezone = asString(body.timezone) || settings.timezone || "UTC";
      const scheduledAt =
        mode === "now" ? new Date().toISOString() : asString(body.scheduled_at);
      if (!scheduledAt) return apiError("scheduled_at is required");
      const publication = await createPublicationRow(service, {
        asset,
        platforms,
        caption: asString(body.caption),
        hashtags: asString(body.hashtags),
        youtubeTitle: asString(body.youtube_title),
        youtubeOptions: (body.youtube_options || {}) as Record<string, unknown>,
        platformCaptions: (body.platform_captions || {}) as Record<string, string>,
        scheduledAt,
        timezone,
        createdBy: user?.id,
      });
      if (mode === "now") {
        const { data: targets } = await service
          .from("social_publication_targets")
          .select("*")
          .eq("publication_id", publication.id);
        for (const target of targets || []) {
          await processTarget(service, target as Record<string, unknown>, livePostsEnabled(settings.live_posts_enabled));
        }
        const [fresh] = await attachTargets(service, [
          (await service.from("social_publications").select("*").eq("id", publication.id).single()).data as Record<
            string,
            unknown
          >,
        ]);
        return jsonResponse({ publication: fresh, livePostsEnabled: livePostsEnabled(settings.live_posts_enabled) });
      }
      return jsonResponse({ publication });
    }

    if (action === "preview_bulk") {
      const assetIds = Array.isArray(body.asset_ids) ? body.asset_ids.map(asString) : [];
      const platforms = parsePlatforms(body.platforms);
      const times = Array.isArray(body.times) ? body.times.map(asString) : [];
      const startDate = asString(body.start_date);
      const postsPerDay = Number(body.posts_per_day || times.length || 0);
      const timezone = asString(body.timezone) || settings.timezone;
      const slots = buildBulkSlots({
        assetIds,
        times,
        postsPerDay,
        startDate,
        timezone,
      });
      if ("error" in slots) return jsonResponse({ error: slots.error, slots: [] }, 400);
      return jsonResponse({ slots: slots.slots, platforms });
    }

    if (action === "bulk_schedule") {
      const assets = Array.isArray(body.assets) ? (body.assets as Record<string, unknown>[]) : [];
      const platforms = parsePlatforms(body.platforms);
      const timezone = asString(body.timezone) || settings.timezone;
      const times = Array.isArray(body.times) ? body.times.map(asString) : [];
      const startDate = asString(body.start_date);
      const postsPerDay = Number(body.posts_per_day || times.length || 0);
      const built = buildBulkSlots({
        assetIds: assets.map((a) => asString(a.id)),
        times,
        postsPerDay,
        startDate,
        timezone,
      });
      if ("error" in built) return apiError(built.error);
      const publications = [];
      for (const slot of built.slots) {
        const asset = assets.find((a) => asString(a.id) === slot.assetId);
        if (!asset) continue;
        const validation = validateAsset(asset, platforms);
        if (!validation.ok) return jsonResponse({ error: "Media validation failed", issues: validation.issues, asset: asset.id }, 400);
        publications.push(
          await createPublicationRow(service, {
            asset,
            platforms,
            caption: asString(body.caption),
            hashtags: asString(body.hashtags),
            youtubeTitle: asString(body.youtube_title),
            youtubeOptions: (body.youtube_options || {}) as Record<string, unknown>,
            scheduledAt: slot.scheduledAtIso,
            timezone,
            createdBy: user?.id,
          }),
        );
      }
      return jsonResponse({ publications, count: publications.length });
    }

    if (action === "cancel_publication") {
      const id = asString(body.publication_id);
      await service
        .from("social_publications")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", id);
      await service
        .from("social_publication_targets")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("publication_id", id)
        .in("status", ["scheduled", "draft", "failed", "processing"]);
      return jsonResponse({ ok: true });
    }

    if (action === "reschedule_publication") {
      const id = asString(body.publication_id);
      const scheduledAt = asString(body.scheduled_at);
      const timezone = asString(body.timezone) || settings.timezone;
      const { data: publication } = await service.from("social_publications").select("*").eq("id", id).single();
      if (!publication) return apiError("Not found", 404);
      await service
        .from("social_publications")
        .update({ scheduled_at: scheduledAt, timezone, status: "scheduled", cancelled_at: null, updated_at: new Date().toISOString() })
        .eq("id", id);
      await service
        .from("social_publication_targets")
        .update({ status: "scheduled", last_error: null, lease_expires_at: null, updated_at: new Date().toISOString() })
        .eq("publication_id", id)
        .is("remote_post_id", null)
        .neq("status", "published");
      const { data: fresh } = await service.from("social_publications").select("*").eq("id", id).single();
      const [row] = await attachTargets(service, [fresh as Record<string, unknown>]);
      return jsonResponse({ publication: row });
    }

    if (action === "retry_target") {
      const id = asString(body.target_id);
      const { data: target } = await service.from("social_publication_targets").select("*").eq("id", id).single();
      if (!target) return apiError("Not found", 404);
      if (target.remote_post_id) return apiError("Already published; will not repost.");
      await service
        .from("social_publication_targets")
        .update({
          status: "scheduled",
          next_retry_at: new Date().toISOString(),
          last_error: null,
          lease_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .is("remote_post_id", null);
      await service
        .from("social_publications")
        .update({ status: "scheduled", updated_at: new Date().toISOString() })
        .eq("id", target.publication_id);
      return jsonResponse({ ok: true });
    }

    return apiError("Unknown action");
  } catch (error) {
    const message = sanitizeProviderError(error instanceof Error ? error.message : "social_publisher_failed");
    const status = /admin|forbidden|auth/i.test(message) ? 403 : 500;
    return apiError(message, status);
  }
});

function buildBulkSlots(input: {
  assetIds: string[];
  times: string[];
  postsPerDay: number;
  startDate: string;
  timezone: string;
}): { slots: Array<{ assetId: string; scheduledAtIso: string; localDate: string; localTime: string }> } | { error: string } {
  const assetIds = [...new Set(input.assetIds.filter(Boolean))];
  if (!assetIds.length) return { error: "Select at least one Reel." };
  if (!input.times.length) return { error: "Add post times." };
  if (input.times.length !== input.postsPerDay) {
    return { error: `Provide exactly ${input.postsPerDay} time(s).` };
  }
  const now = Date.now();
  const slots = [];
  let day = 0;
  let index = 0;
  const addDays = (date: string, n: number) => {
    const [y, m, d] = date.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + n));
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
  };
  const zoned = (date: string, time: string) => {
    const [year, month, dayN] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    const utcGuess = Date.UTC(year, month - 1, dayN, hour, minute, 0);
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: input.timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const partsOf = (ms: number) => {
      const parts = fmt.formatToParts(new Date(ms));
      const get = (t: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === t)?.value || "0");
      return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    };
    const desired = Date.UTC(year, month - 1, dayN, hour, minute, 0);
    let guess = utcGuess;
    for (let i = 0; i < 3; i++) guess -= partsOf(guess) - desired;
    return guess;
  };
  for (const assetId of assetIds) {
    for (let guard = 0; guard < 2000; guard++) {
      const date = addDays(input.startDate, day);
      const time = input.times[index];
      const ms = zoned(date, time);
      index += 1;
      if (index >= input.times.length) {
        index = 0;
        day += 1;
      }
      if (ms > now) {
        slots.push({
          assetId,
          scheduledAtIso: new Date(ms).toISOString(),
          localDate: date,
          localTime: time,
        });
        break;
      }
    }
  }
  return { slots };
}
