import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { assertAdmin, getAuthUser, getServiceClient, isServiceRoleRequest, readJson } from "../_shared/supabase.ts";
import { dispatchPublish } from "../_shared/social/adapters.ts";
import { decryptSecret, encryptSecret } from "../_shared/social/crypto.ts";

type Platform = "instagram_reels" | "facebook_reels" | "tiktok" | "youtube_shorts";
type Provider = "meta" | "tiktok" | "youtube";

const PLATFORMS: Platform[] = ["instagram_reels", "facebook_reels", "tiktok", "youtube_shorts"];

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
  if (platform === "youtube_shorts") return "youtube";
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
    meta: Boolean(env("META_APP_ID") && env("META_APP_SECRET")),
    tiktok: Boolean((env("TIKTOK_CLIENT_KEY") || env("TIKTOK_CLIENT_KEY_ID")) && env("TIKTOK_CLIENT_SECRET")),
    youtube: Boolean(
      (env("YOUTUBE_CLIENT_ID") || env("GOOGLE_OAUTH_CLIENT_ID") || env("GOOGLE_CLIENT_ID")) &&
        (env("YOUTUBE_CLIENT_SECRET") || env("GOOGLE_OAUTH_CLIENT_SECRET") || env("GOOGLE_CLIENT_SECRET")),
    ),
  };
}

function providerReadiness(configured: ReturnType<typeof oauthConfigured>, live: boolean) {
  const missingMeta: string[] = [];
  if (!configured.meta) missingMeta.push("META_APP_ID", "META_APP_SECRET");
  missingMeta.push("instagram_content_publish App Review", "pages_manage_posts");
  const missingTt: string[] = [];
  if (!configured.tiktok) missingTt.push("TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET");
  missingTt.push("TikTok Content Posting API audit / video.publish");
  const missingYt: string[] = [];
  if (!configured.youtube) missingYt.push("YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET");
  missingYt.push("YouTube Data API enabled", "OAuth consent for youtube.upload");
  if (!live) {
    missingMeta.push("SOCIAL_PUBLISHER_ALLOW_LIVE_POSTS");
    missingTt.push("SOCIAL_PUBLISHER_ALLOW_LIVE_POSTS");
    missingYt.push("SOCIAL_PUBLISHER_ALLOW_LIVE_POSTS");
  }
  return {
    meta: {
      ui: true,
      oauth: configured.meta,
      publishing: live && configured.meta ? "adapter_ready_not_live_proven" : "IMPLEMENTED — WAITING FOR PROVIDER APPROVAL",
      missing: missingMeta,
    },
    tiktok: {
      ui: true,
      oauth: configured.tiktok,
      publishing: live && configured.tiktok ? "adapter_ready_not_live_proven" : "IMPLEMENTED — WAITING FOR PROVIDER APPROVAL",
      missing: missingTt,
    },
    youtube: {
      ui: true,
      oauth: configured.youtube,
      publishing: live && configured.youtube ? "adapter_ready_not_live_proven" : "IMPLEMENTED — WAITING FOR PROVIDER APPROVAL",
      missing: missingYt,
    },
  };
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
  const src = meta || {};
  const out: Record<string, unknown> = {};
  for (const key of [
    "instagram_user_id",
    "instagram_username",
    "facebook_page_id",
    "facebook_page_name",
    "tiktok_username",
    "youtube_channel_id",
    "youtube_channel_title",
  ]) {
    if (src[key] != null) out[key] = src[key];
  }
  return out;
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
  if (kind === "photo" || /\.(jpe?g|png|webp)$/i.test(filename)) {
    issues.push({ code: "not_a_reel", message: "Photos cannot be published as Reels." });
  }
  if (!platforms.length) issues.push({ code: "no_platforms", message: "Select at least one platform." });
  if (Number.isFinite(width) && Number.isFinite(height) && Math.abs(width / height - 9 / 16) > 0.08) {
    issues.push({ code: "aspect_ratio", message: `Vertical 9:16 required. File is ${width}×${height}.` });
  }
  for (const platform of platforms) {
    const max = platform === "instagram_reels" || platform === "facebook_reels" ? 90 : 60;
    if (Number.isFinite(duration) && duration > max) {
      issues.push({ code: "too_long", platform, message: `${platform} max duration is ${max}s.` });
    }
    if (Number.isFinite(duration) && duration < 1) {
      issues.push({ code: "too_short", platform, message: `${platform} video is too short.` });
    }
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

async function exchangeMeta(code: string) {
  const appId = env("META_APP_ID");
  const secret = env("META_APP_SECRET");
  const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", secret);
  tokenUrl.searchParams.set("redirect_uri", oauthRedirectUri());
  tokenUrl.searchParams.set("code", code);
  const shortRes = await fetch(tokenUrl);
  const shortJson = (await shortRes.json()) as { access_token?: string; error?: { message?: string } };
  if (!shortJson.access_token) throw new Error(shortJson.error?.message || "Meta token exchange failed");
  const longUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", appId);
  longUrl.searchParams.set("client_secret", secret);
  longUrl.searchParams.set("fb_exchange_token", shortJson.access_token);
  const longRes = await fetch(longUrl);
  const longJson = (await longRes.json()) as { access_token?: string; expires_in?: number };
  const access = longJson.access_token || shortJson.access_token;
  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(access)}`,
  );
  const pagesJson = (await pagesRes.json()) as {
    data?: Array<{
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: { id?: string; username?: string };
    }>;
  };
  const page = pagesJson.data?.[0];
  return {
    access,
    expiresIn: longJson.expires_in || 60 * 24 * 3600,
    page,
  };
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

async function exchangeYouTube(code: string) {
  const body = new URLSearchParams({
    client_id: env("YOUTUBE_CLIENT_ID") || env("GOOGLE_OAUTH_CLIENT_ID") || env("GOOGLE_CLIENT_ID"),
    client_secret: env("YOUTUBE_CLIENT_SECRET") || env("GOOGLE_OAUTH_CLIENT_SECRET") || env("GOOGLE_CLIENT_SECRET"),
    code,
    grant_type: "authorization_code",
    redirect_uri: oauthRedirectUri(),
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
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
  const destBase = `${publicBaseUrl()}/admin/social-accounts`;
  if (err) return htmlRedirect(`${destBase}?oauth=error&message=${encodeURIComponent(err)}`);
  const { data: row } = await service.from("social_oauth_states").select("*").eq("state", state).maybeSingle();
  if (!row) return htmlRedirect(`${destBase}?oauth=error&message=invalid_state`);
  await service.from("social_oauth_states").delete().eq("state", state);
  const provider = asString(row.provider) as Provider;
  try {
    if (provider === "meta") {
      const exchanged = await exchangeMeta(code);
      const page = exchanged.page;
      await upsertAccount(service, {
        provider: "meta",
        account_id: page?.id || "meta",
        account_name: page?.name || "Meta",
        status: "connected",
        access_token_ciphertext: await encryptSecret(page?.access_token || exchanged.access),
        refresh_token_ciphertext: null,
        expires_at: new Date(Date.now() + exchanged.expiresIn * 1000).toISOString(),
        metadata: {
          facebook_page_id: page?.id || null,
          facebook_page_name: page?.name || null,
          page_access_token: undefined,
          instagram_user_id: page?.instagram_business_account?.id || null,
          instagram_username: page?.instagram_business_account?.username || null,
          page_access_token_ciphertext: page?.access_token
            ? await encryptSecret(page.access_token)
            : null,
        },
      });
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
      const exchanged = await exchangeYouTube(code);
      if (!exchanged.access_token) {
        throw new Error(exchanged.error_description || exchanged.error || "YouTube token exchange failed");
      }
      await upsertAccount(service, {
        provider: "youtube",
        account_id: "youtube",
        account_name: "YouTube",
        status: "connected",
        access_token_ciphertext: await encryptSecret(exchanged.access_token),
        refresh_token_ciphertext: exchanged.refresh_token ? await encryptSecret(exchanged.refresh_token) : null,
        expires_at: exchanged.expires_in
          ? new Date(Date.now() + exchanged.expires_in * 1000).toISOString()
          : null,
        metadata: {},
      });
    }
    return htmlRedirect(`${destBase}?oauth=${provider}&ok=1`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "oauth_failed";
    return htmlRedirect(`${destBase}?oauth=error&message=${encodeURIComponent(message)}`);
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
  const access = await decryptSecret(data.access_token_ciphertext as string);
  const meta = (data.metadata || {}) as Record<string, unknown>;
  const pageCipher = asString(meta.page_access_token_ciphertext);
  if (pageCipher) {
    const pageToken = await decryptSecret(pageCipher);
    if (pageToken) meta.page_access_token = pageToken;
  }
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

  const result = await dispatchPublish({
    platform,
    videoUrl,
    caption,
    hashtags,
    title: asString(target.platform_title) || null,
    account: {
      provider: account.provider,
      accountId: account.accountId,
      status: account.status,
      accessToken: account.accessToken,
      metadata: account.metadata,
    },
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
        lease_expires_at: null,
        social_account_id: account.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", target.id)
      .is("remote_post_id", null);
    await refreshPublicationStatus(service, String(publication.id));
    return { ok: true, remotePostId: result.remotePostId };
  }

  await service
    .from("social_publication_targets")
    .update({
      status: "failed",
      last_error: `${result.code}: ${result.message}`,
      lease_expires_at: null,
      next_retry_at: result.retryable ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", target.id);
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
  const targets = input.platforms.map((platform) => ({
    publication_id: publication.id,
    provider: providerFor(platform),
    platform,
    platform_caption: input.platformCaptions?.[platform] || null,
    platform_title: platform === "youtube_shorts" ? input.youtubeTitle || null : null,
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
    } catch (error) {
      return apiError(error instanceof Error ? error.message : "oauth_failed", 400);
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

    const { user } = await getAuthUser(req);
    await assertAdmin(user?.email);
    const service = getServiceClient();
    const settings = await loadSettings(service);
    const configured = oauthConfigured();

    if (action === "bootstrap" || !action) {
      const { data: accounts } = await service.from("social_accounts").select("*").order("provider");
      return jsonResponse({
        timezone: settings.timezone,
        livePostsEnabled: livePostsEnabled(settings.live_posts_enabled),
        oauthConfigured: configured,
        accounts: (accounts || []).map((row) => sanitizeAccount(row as Record<string, unknown>)),
        providerReadiness: providerReadiness(configured, livePostsEnabled(settings.live_posts_enabled)),
      });
    }

    if (action === "connect_url") {
      const provider = asString(body.provider) as Provider;
      const state = crypto.randomUUID();
      await service.from("social_oauth_states").insert({
        state,
        provider,
        created_by: user?.id || null,
        redirect_to: `${publicBaseUrl()}/admin/social-accounts`,
      });
      const redirectUri = oauthRedirectUri();
      if (provider === "meta") {
        if (!configured.meta) {
          return jsonResponse({
            url: null,
            waitingForApproval: true,
            missing: ["META_APP_ID", "META_APP_SECRET"],
          });
        }
        const auth = new URL("https://www.facebook.com/v21.0/dialog/oauth");
        auth.searchParams.set("client_id", env("META_APP_ID"));
        auth.searchParams.set("redirect_uri", redirectUri);
        auth.searchParams.set("state", state);
        auth.searchParams.set("response_type", "code");
        auth.searchParams.set(
          "scope",
          "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,business_management",
        );
        return jsonResponse({ url: auth.toString() });
      }
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
      if (!configured.youtube) {
        return jsonResponse({
          url: null,
          waitingForApproval: true,
          missing: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"],
        });
      }
      const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      auth.searchParams.set(
        "client_id",
        env("YOUTUBE_CLIENT_ID") || env("GOOGLE_OAUTH_CLIENT_ID") || env("GOOGLE_CLIENT_ID"),
      );
      auth.searchParams.set("redirect_uri", redirectUri);
      auth.searchParams.set("state", state);
      auth.searchParams.set("response_type", "code");
      auth.searchParams.set("access_type", "offline");
      auth.searchParams.set("prompt", "consent");
      auth.searchParams.set("scope", "https://www.googleapis.com/auth/youtube.upload");
      return jsonResponse({ url: auth.toString() });
    }

    if (action === "disconnect") {
      const id = asString(body.account_id);
      await service
        .from("social_accounts")
        .update({
          status: "revoked",
          access_token_ciphertext: null,
          refresh_token_ciphertext: null,
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
    const message = error instanceof Error ? error.message : "social_publisher_failed";
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
