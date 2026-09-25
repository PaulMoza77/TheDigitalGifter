import { decryptSecret, encryptSecret } from "./crypto.ts";
import {
  adminSocialAccountsUrl,
  isAllowedAdminReturn,
  sanitizeProviderError,
} from "./meta.ts";
import {
  REQUIRED_YOUTUBE_SCOPES,
  buildYouTubeAuthorizeUrl,
  channelHandleFromSnippet,
  diffYouTubeScopes,
  isExactYouTubeRedirectUri,
  normalizeYouTubeScopes,
  publicYouTubeChannelSummary,
  youtubeConnectionStatus,
  youtubeOauthErrorCode,
  youtubeOauthRedirectUri,
} from "./youtube.ts";

type Service = {
  from: (table: string) => any;
};

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function env(name: string): string {
  return asString(Deno.env.get(name));
}

export function youtubeClientId(): string {
  return env("YOUTUBE_CLIENT_ID") || env("GOOGLE_OAUTH_CLIENT_ID") || env("GOOGLE_CLIENT_ID");
}

export function youtubeClientSecret(): string {
  return env("YOUTUBE_CLIENT_SECRET") || env("GOOGLE_OAUTH_CLIENT_SECRET") || env("GOOGLE_CLIENT_SECRET");
}

let cachedDbConfig: { clientId: string; clientSecret: string; redirectUri: string } | null | undefined;

export function invalidateYouTubeClientConfigCache(): void {
  cachedDbConfig = undefined;
}

async function loadYouTubeConfigFromDb(service?: Service) {
  if (cachedDbConfig !== undefined) return cachedDbConfig;
  if (!service) return null;
  try {
    const { data } = await service
      .from("social_provider_configs")
      .select("client_id,client_secret_ciphertext,redirect_uri")
      .eq("provider", "youtube")
      .maybeSingle();
    if (!data?.client_id || !data?.client_secret_ciphertext) {
      cachedDbConfig = null;
      return null;
    }
    const secret = await decryptSecret(asString(data.client_secret_ciphertext));
    if (!secret) {
      cachedDbConfig = null;
      return null;
    }
    cachedDbConfig = {
      clientId: asString(data.client_id),
      clientSecret: secret,
      redirectUri: asString(data.redirect_uri),
    };
    return cachedDbConfig;
  } catch {
    cachedDbConfig = null;
    return null;
  }
}

export async function resolveYouTubeClientConfig(service?: Service): Promise<{
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  missing: string[];
}> {
  const fromEnvId = youtubeClientId();
  const fromEnvSecret = youtubeClientSecret();
  const fromEnvRedirect = youtubeRedirectUri();
  if (fromEnvId && fromEnvSecret) {
    return { clientId: fromEnvId, clientSecret: fromEnvSecret, redirectUri: fromEnvRedirect, missing: [] };
  }
  const fromDb = await loadYouTubeConfigFromDb(service);
  const clientId = fromEnvId || fromDb?.clientId || "";
  const clientSecret = fromEnvSecret || fromDb?.clientSecret || "";
  const redirectUri = fromEnvRedirect || fromDb?.redirectUri || youtubeRedirectUri();
  const missing: string[] = [];
  if (!clientId) missing.push("YOUTUBE_CLIENT_ID");
  if (!clientSecret) missing.push("YOUTUBE_CLIENT_SECRET");
  return { clientId, clientSecret, redirectUri, missing };
}

export function publicBase(): string {
  return (
    env("SOCIAL_PUBLISHER_PUBLIC_BASE_URL") ||
    env("SITE_URL") ||
    env("PUBLIC_SITE_URL") ||
    "https://www.thedigitalgifter.com"
  ).replace(/\/$/, "");
}

export function youtubeRedirectUri(): string {
  return youtubeOauthRedirectUri({
    explicit: env("YOUTUBE_REDIRECT_URI"),
    publicBaseUrl: publicBase(),
  });
}

export async function youtubeAuthorizeUrl(
  state: string,
  options: { forceConsent?: boolean; service?: Service } = {},
): Promise<{ url: string | null; missing: string[]; redirectUri: string }> {
  const resolved = await resolveYouTubeClientConfig(options.service);
  if (resolved.missing.length) return { url: null, missing: resolved.missing, redirectUri: resolved.redirectUri };
  return {
    url: buildYouTubeAuthorizeUrl({
      clientId: resolved.clientId,
      redirectUri: resolved.redirectUri,
      state,
      forceConsent: options.forceConsent !== false,
    }),
    missing: [],
    redirectUri: resolved.redirectUri,
  };
}

async function postForm(url: string, body: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok, json };
}

export async function exchangeYouTubeCode(code: string, redirectUri: string, service?: Service) {
  const resolved = await resolveYouTubeClientConfig(service);
  if (!isExactYouTubeRedirectUri(redirectUri, resolved.redirectUri || youtubeRedirectUri())) {
    throw new Error("invalid_redirect_uri");
  }
  const result = await postForm("https://oauth2.googleapis.com/token", {
    client_id: resolved.clientId,
    client_secret: resolved.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  const access = asString(result.json.access_token);
  if (!access) throw new Error("exchange_failed");
  return {
    access,
    refresh: asString(result.json.refresh_token) || null,
    expiresIn: Number(result.json.expires_in || 3600),
    scope: normalizeYouTubeScopes(asString(result.json.scope)),
    tokenType: asString(result.json.token_type) || "Bearer",
  };
}

export async function refreshYouTubeAccessToken(refreshToken: string, service?: Service) {
  const resolved = await resolveYouTubeClientConfig(service);
  const result = await postForm("https://oauth2.googleapis.com/token", {
    client_id: resolved.clientId,
    client_secret: resolved.clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const access = asString(result.json.access_token);
  if (!access) {
    const err = asString(result.json.error) || "refresh_failed";
    throw new Error(err === "invalid_grant" ? "reconnect_required" : "refresh_failed");
  }
  return {
    access,
    refresh: asString(result.json.refresh_token) || null,
    expiresIn: Number(result.json.expires_in || 3600),
    scope: normalizeYouTubeScopes(asString(result.json.scope)),
  };
}

export async function fetchYouTubeChannel(accessToken: string) {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("mine", "true");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const json = (await res.json()) as {
    items?: Array<{ id?: string; snippet?: { title?: string; customUrl?: string } }>;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(sanitizeProviderError(json.error?.message || `channel_lookup_failed_${res.status}`));
  }
  const item = Array.isArray(json.items) ? json.items[0] : null;
  if (!item?.id) throw new Error("no_channel");
  return {
    id: asString(item.id),
    title: asString(item.snippet?.title) || "YouTube",
    handle: channelHandleFromSnippet(item.snippet),
  };
}

async function upsertYouTubeAccount(service: Service, row: Record<string, unknown>) {
  const { data: existing } = await service
    .from("social_accounts")
    .select("id")
    .eq("provider", "youtube")
    .eq("account_id", row.account_id)
    .maybeSingle();
  let id = asString(existing?.id);
  if (id) {
    await service.from("social_accounts").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id);
  } else {
    const inserted = await service.from("social_accounts").insert(row).select("id").single();
    if (inserted.error) throw inserted.error;
    id = asString(inserted.data?.id);
  }
  const { data: others } = await service
    .from("social_accounts")
    .select("id,metadata")
    .eq("provider", "youtube")
    .neq("id", id);
  for (const other of others || []) {
    await service
      .from("social_accounts")
      .update({
        status: "revoked",
        access_token_ciphertext: null,
        refresh_token_ciphertext: null,
        metadata: {
          ...((other.metadata || {}) as Record<string, unknown>),
          connection_error: "replaced_by_newer_connection",
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", other.id);
  }
  return id;
}

export async function finishYouTubeOAuth(service: Service, code: string, redirectUri: string) {
  const exchanged = await exchangeYouTubeCode(code, redirectUri, service);
  const scopeDiff = diffYouTubeScopes(exchanged.scope.length ? exchanged.scope : [...REQUIRED_YOUTUBE_SCOPES]);
  const channel = await fetchYouTubeChannel(exchanged.access);
  const summary = publicYouTubeChannelSummary(channel);
  const status = youtubeConnectionStatus({
    channelId: summary.youtube_channel_id,
    missingScopes: scopeDiff.missing,
  });
  const connectionError =
    status === "connected" ? null : !summary.youtube_channel_id ? "no_channel" : "missing_scopes";

  // Keep an existing refresh token when Google omits a new one on reconnect.
  let refreshCipher: string | null = exchanged.refresh ? await encryptSecret(exchanged.refresh) : null;
  if (!refreshCipher) {
    const { data: prior } = await service
      .from("social_accounts")
      .select("refresh_token_ciphertext")
      .eq("provider", "youtube")
      .eq("account_id", summary.youtube_channel_id || "youtube")
      .maybeSingle();
    refreshCipher = asString(prior?.refresh_token_ciphertext) || null;
  }

  await upsertYouTubeAccount(service, {
    provider: "youtube",
    account_id: summary.youtube_channel_id || "youtube",
    account_name: summary.youtube_channel_title || "YouTube",
    status,
    access_token_ciphertext: await encryptSecret(exchanged.access),
    refresh_token_ciphertext: refreshCipher,
    expires_at: new Date(Date.now() + Math.max(60, exchanged.expiresIn) * 1000).toISOString(),
    metadata: {
      ...summary,
      granted_scopes: scopeDiff.granted,
      missing_scopes: scopeDiff.missing,
      granted_permissions: scopeDiff.granted,
      missing_permissions: scopeDiff.missing,
      token_checked_at: new Date().toISOString(),
      token_valid: true,
      token_expires_at: new Date(Date.now() + Math.max(60, exchanged.expiresIn) * 1000).toISOString(),
      connection_error: connectionError,
      oauth_app_status: "testing",
      refresh_token_warning:
        "OAuth app is in Testing. Google may expire refresh tokens after 7 days until the app is published.",
      has_refresh_token: Boolean(refreshCipher),
    },
  });

  return {
    status,
    connectionError,
    channelId: summary.youtube_channel_id,
    channelTitle: summary.youtube_channel_title,
    channelHandle: summary.youtube_channel_handle,
    granted: scopeDiff.granted,
    missing: scopeDiff.missing,
  };
}

export async function ensureYouTubeAccessToken(
  service: Service,
  account: Record<string, unknown>,
): Promise<{ accessToken: string; status: string; refreshed: boolean }> {
  const access = await decryptSecret(asString(account.access_token_ciphertext));
  const refresh = await decryptSecret(asString(account.refresh_token_ciphertext));
  const expiresAt = account.expires_at ? new Date(String(account.expires_at)).getTime() : 0;
  const skewMs = 2 * 60 * 1000;
  if (access && expiresAt && expiresAt - skewMs > Date.now()) {
    return { accessToken: access, status: asString(account.status) || "connected", refreshed: false };
  }
  if (!refresh) {
    await service
      .from("social_accounts")
      .update({
        status: "expired",
        metadata: {
          ...((account.metadata || {}) as Record<string, unknown>),
          token_valid: false,
          connection_error: "reconnect_required",
          token_checked_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id);
    return { accessToken: "", status: "expired", refreshed: false };
  }
  try {
    const refreshed = await refreshYouTubeAccessToken(refresh, service);
    const expiresIso = new Date(Date.now() + Math.max(60, refreshed.expiresIn) * 1000).toISOString();
    const metadata = {
      ...((account.metadata || {}) as Record<string, unknown>),
      token_valid: true,
      token_checked_at: new Date().toISOString(),
      token_expires_at: expiresIso,
      connection_error: null,
      has_refresh_token: true,
    };
    if (refreshed.scope.length) {
      const diff = diffYouTubeScopes(refreshed.scope);
      metadata.granted_scopes = diff.granted;
      metadata.missing_scopes = diff.missing;
      metadata.granted_permissions = diff.granted;
      metadata.missing_permissions = diff.missing;
    }
    const patch: Record<string, unknown> = {
      status: "connected",
      access_token_ciphertext: await encryptSecret(refreshed.access),
      expires_at: expiresIso,
      metadata,
      updated_at: new Date().toISOString(),
    };
    if (refreshed.refresh) {
      patch.refresh_token_ciphertext = await encryptSecret(refreshed.refresh);
    }
    await service.from("social_accounts").update(patch).eq("id", account.id);
    return { accessToken: refreshed.access, status: "connected", refreshed: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "refresh_failed";
    await service
      .from("social_accounts")
      .update({
        status: message === "reconnect_required" ? "expired" : "error",
        metadata: {
          ...((account.metadata || {}) as Record<string, unknown>),
          token_valid: false,
          connection_error: message,
          token_checked_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id);
    return { accessToken: "", status: message === "reconnect_required" ? "expired" : "error", refreshed: false };
  }
}

export async function inspectYouTubeToken(service: Service, account: Record<string, unknown>) {
  const ensured = await ensureYouTubeAccessToken(service, account);
  const metadata = (account.metadata || {}) as Record<string, unknown>;
  if (!ensured.accessToken) {
    return {
      ok: true,
      valid: false,
      status: ensured.status,
      scopes: Array.isArray(metadata.granted_scopes) ? metadata.granted_scopes : [],
      missing_scopes: Array.isArray(metadata.missing_scopes) ? metadata.missing_scopes : [...REQUIRED_YOUTUBE_SCOPES],
      youtube_channel_id: metadata.youtube_channel_id || null,
      youtube_channel_title: metadata.youtube_channel_title || null,
      youtube_channel_handle: metadata.youtube_channel_handle || null,
      oauth_app_status: metadata.oauth_app_status || "testing",
      refresh_token_warning: metadata.refresh_token_warning || null,
      error: asString(metadata.connection_error) || "missing_token",
    };
  }

  try {
    const channel = await fetchYouTubeChannel(ensured.accessToken);
    const summary = publicYouTubeChannelSummary(channel);
    const priorGranted = Array.isArray(metadata.granted_scopes)
      ? metadata.granted_scopes.map(String)
      : Array.isArray(metadata.granted_permissions)
        ? metadata.granted_permissions.map(String)
        : [...REQUIRED_YOUTUBE_SCOPES];
    const scopeDiff = diffYouTubeScopes(priorGranted);
    const status = youtubeConnectionStatus({
      channelId: summary.youtube_channel_id,
      missingScopes: scopeDiff.missing,
    });
    const nextMeta: Record<string, unknown> = {
      ...metadata,
      ...summary,
      granted_scopes: scopeDiff.granted,
      missing_scopes: scopeDiff.missing,
      granted_permissions: scopeDiff.granted,
      missing_permissions: scopeDiff.missing,
      token_checked_at: new Date().toISOString(),
      token_valid: true,
      connection_error: status === "connected" ? null : "connection_incomplete",
      oauth_app_status: "testing",
      refresh_token_warning:
        "OAuth app is in Testing. Google may expire refresh tokens after 7 days until the app is published.",
    };
    delete nextMeta.access_token;
    delete nextMeta.accessToken;
    delete nextMeta.refresh_token;
    await service
      .from("social_accounts")
      .update({
        status,
        account_id: summary.youtube_channel_id || account.account_id,
        account_name: summary.youtube_channel_title || account.account_name,
        metadata: nextMeta,
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id);
    return {
      ok: true,
      valid: status === "connected",
      status,
      scopes: scopeDiff.granted,
      missing_scopes: scopeDiff.missing,
      youtube_channel_id: summary.youtube_channel_id,
      youtube_channel_title: summary.youtube_channel_title,
      youtube_channel_handle: summary.youtube_channel_handle,
      oauth_app_status: "testing",
      refresh_token_warning: nextMeta.refresh_token_warning,
      error: status === "connected" ? null : "connection_incomplete",
    };
  } catch (error) {
    const message = sanitizeProviderError(error instanceof Error ? error.message : "token_check_failed");
    await service
      .from("social_accounts")
      .update({
        status: "error",
        metadata: {
          ...metadata,
          token_valid: false,
          token_checked_at: new Date().toISOString(),
          connection_error: message,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id);
    return {
      ok: true,
      valid: false,
      status: "error",
      scopes: [],
      missing_scopes: [...REQUIRED_YOUTUBE_SCOPES],
      youtube_channel_id: metadata.youtube_channel_id || null,
      youtube_channel_title: metadata.youtube_channel_title || null,
      youtube_channel_handle: metadata.youtube_channel_handle || null,
      oauth_app_status: "testing",
      refresh_token_warning: metadata.refresh_token_warning || null,
      error: message,
    };
  }
}

export function youtubeCallbackRedirect(params: Record<string, string>): string {
  return adminSocialAccountsUrl(publicBase(), params);
}

export function safeYouTubeOauthError(raw: string): string {
  return youtubeOauthErrorCode(raw);
}

export { isAllowedAdminReturn };
