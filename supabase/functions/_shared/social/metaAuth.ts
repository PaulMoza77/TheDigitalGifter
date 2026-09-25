import { decryptSecret, encryptSecret } from "./crypto.ts";
import {
  adminSocialAccountsUrl,
  buildMetaBusinessLoginUrl,
  diffMetaPermissions,
  isProfessionalInstagram,
  metaConnectionStatus,
  metaOauthRedirectUri,
  oauthErrorCode,
  publicPageSummary,
  sanitizeProviderError,
  selectLinkedProfessionalPage,
  type MetaPageCandidate,
} from "./meta.ts";

type Service = {
  from: (table: string) => any;
};

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function env(name: string): string {
  return asString(Deno.env.get(name));
}

type MetaClientConfig = {
  appId: string;
  appSecret: string;
  configurationId: string;
  redirectUri: string;
};

let cachedDbConfig: MetaClientConfig | null | undefined;

export function invalidateMetaClientConfigCache(): void {
  cachedDbConfig = undefined;
}

async function loadMetaConfigFromDb(service?: Service): Promise<MetaClientConfig | null> {
  if (cachedDbConfig !== undefined) return cachedDbConfig;
  if (!service) return null;
  try {
    const { data } = await service
      .from("social_provider_configs")
      .select("client_id,client_secret_ciphertext,redirect_uri,metadata")
      .eq("provider", "meta")
      .maybeSingle();
    if (!data?.client_id || !data?.client_secret_ciphertext) {
      cachedDbConfig = null;
      return null;
    }
    const secret = await decryptSecret(asString(data.client_secret_ciphertext));
    const metadata = (data.metadata || {}) as Record<string, unknown>;
    const configurationId = asString(metadata.configuration_id || metadata.META_CONFIGURATION_ID);
    if (!secret || !configurationId) {
      cachedDbConfig = null;
      return null;
    }
    cachedDbConfig = {
      appId: asString(data.client_id),
      appSecret: secret,
      configurationId,
      redirectUri: asString(data.redirect_uri),
    };
    return cachedDbConfig;
  } catch {
    cachedDbConfig = null;
    return null;
  }
}

export async function resolveMetaClientConfig(service?: Service): Promise<{
  appId: string;
  appSecret: string;
  configurationId: string;
  redirectUri: string;
  missing: string[];
}> {
  const fromEnvId = env("META_APP_ID");
  const fromEnvSecret = env("META_APP_SECRET");
  const fromEnvConfigId = env("META_CONFIGURATION_ID");
  const fromEnvRedirect = metaRedirectUri();
  if (fromEnvId && fromEnvSecret && fromEnvConfigId) {
    return {
      appId: fromEnvId,
      appSecret: fromEnvSecret,
      configurationId: fromEnvConfigId,
      redirectUri: fromEnvRedirect,
      missing: [],
    };
  }
  const fromDb = await loadMetaConfigFromDb(service);
  const appId = fromEnvId || fromDb?.appId || "";
  const appSecret = fromEnvSecret || fromDb?.appSecret || "";
  const configurationId = fromEnvConfigId || fromDb?.configurationId || "";
  const redirectUri = fromEnvRedirect || fromDb?.redirectUri || metaRedirectUri();
  const missing: string[] = [];
  if (!appId) missing.push("META_APP_ID");
  if (!appSecret) missing.push("META_APP_SECRET");
  if (!configurationId) missing.push("META_CONFIGURATION_ID");
  return { appId, appSecret, configurationId, redirectUri, missing };
}

export function metaRedirectUri(): string {
  const base = (
    env("SOCIAL_PUBLISHER_PUBLIC_BASE_URL") ||
    env("SITE_URL") ||
    env("PUBLIC_SITE_URL") ||
    "https://www.thedigitalgifter.com"
  ).replace(/\/$/, "");
  return metaOauthRedirectUri({
    explicit: env("META_OAUTH_REDIRECT_URL"),
    publicBaseUrl: base,
  });
}

export function publicBase(): string {
  return (
    env("SOCIAL_PUBLISHER_PUBLIC_BASE_URL") ||
    env("SITE_URL") ||
    env("PUBLIC_SITE_URL") ||
    "https://www.thedigitalgifter.com"
  ).replace(/\/$/, "");
}

async function graphGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok, json };
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

async function exchangeUserToken(code: string, redirectUri: string, service?: Service) {
  const resolved = await resolveMetaClientConfig(service);
  if (resolved.missing.length) throw new Error("exchange_failed");
  const short = await postForm("https://graph.facebook.com/v21.0/oauth/access_token", {
    client_id: resolved.appId,
    client_secret: resolved.appSecret,
    redirect_uri: redirectUri,
    code,
  });
  const shortToken = asString(short.json.access_token);
  if (!shortToken) {
    throw new Error("exchange_failed");
  }
  const long = await postForm("https://graph.facebook.com/v21.0/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: resolved.appId,
    client_secret: resolved.appSecret,
    fb_exchange_token: shortToken,
  });
  const access = asString(long.json.access_token) || shortToken;
  const expiresIn = Number(long.json.expires_in || short.json.expires_in || 60 * 24 * 3600);
  return { access, expiresIn: Number.isFinite(expiresIn) ? expiresIn : 60 * 24 * 3600 };
}

async function grantedPermissions(userToken: string): Promise<string[]> {
  const result = await graphGet("me/permissions", userToken);
  const rows = Array.isArray(result.json.data) ? result.json.data : [];
  return rows
    .filter((row) => asString((row as { status?: string }).status) === "granted")
    .map((row) => asString((row as { permission?: string }).permission))
    .filter(Boolean);
}

async function loadPages(userToken: string): Promise<MetaPageCandidate[]> {
  const result = await graphGet("me/accounts", userToken, {
    fields: "id,name,access_token,instagram_business_account{id,username}",
    limit: "50",
  });
  const rows = Array.isArray(result.json.data) ? result.json.data : [];
  const pages: MetaPageCandidate[] = [];
  for (const row of rows) {
    const page = row as {
      id?: string;
      name?: string;
      access_token?: string;
      instagram_business_account?: { id?: string; username?: string };
    };
    const id = asString(page.id);
    if (!id) continue;
    const ig = page.instagram_business_account;
    let accountType = "";
    if (ig?.id && page.access_token) {
      const profile = await graphGet(ig.id, page.access_token, {
        fields: "id,username,account_type",
      });
      accountType = asString(profile.json.account_type);
    }
    pages.push({
      id,
      name: asString(page.name),
      accessToken: asString(page.access_token),
      instagram: ig?.id
        ? { id: asString(ig.id), username: asString(ig.username), accountType }
        : null,
    });
  }
  return pages;
}

async function upsertMetaAccount(service: Service, row: Record<string, unknown>) {
  const { data: existing } = await service
    .from("social_accounts")
    .select("id")
    .eq("provider", "meta")
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
  const { data: others } = await service.from("social_accounts").select("id,metadata").eq("provider", "meta").neq("id", id);
  for (const other of others || []) {
    const metadata = { ...((other.metadata || {}) as Record<string, unknown>) };
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
      .eq("id", other.id);
  }
  return id;
}

export async function finishMetaOAuth(service: Service, code: string, redirectUri: string) {
  const exchanged = await exchangeUserToken(code, redirectUri, service);
  const permissions = await grantedPermissions(exchanged.access);
  const permissionDiff = diffMetaPermissions(permissions);
  const pages = await loadPages(exchanged.access);
  const selected = selectLinkedProfessionalPage(pages);
  const summary = publicPageSummary(selected.page);
  const linked = Boolean(summary.instagram_user_id);
  const professional = isProfessionalInstagram(asString(summary.instagram_account_type), linked);
  const status = metaConnectionStatus({
    reason: selected.reason,
    missingPermissions: permissionDiff.missing,
  });
  const pageToken = selected.page?.accessToken || "";
  const connectionError =
    status === "connected"
      ? null
      : selected.reason !== "ok"
        ? selected.reason
        : permissionDiff.missing.length
          ? "missing_permissions"
          : "oauth_failed";

  await upsertMetaAccount(service, {
    provider: "meta",
    account_id: summary.facebook_page_id || "meta",
    account_name: summary.facebook_page_name || "Meta",
    status,
    access_token_ciphertext: await encryptSecret(exchanged.access),
    refresh_token_ciphertext: null,
    expires_at: new Date(Date.now() + exchanged.expiresIn * 1000).toISOString(),
    metadata: {
      ...summary,
      instagram_is_professional: professional,
      instagram_linked: linked && selected.reason !== "instagram_not_linked",
      granted_permissions: permissionDiff.granted,
      missing_permissions: permissionDiff.missing,
      token_checked_at: new Date().toISOString(),
      token_valid: true,
      connection_error: connectionError,
      page_access_token_ciphertext: pageToken ? await encryptSecret(pageToken) : null,
    },
  });

  return {
    status,
    connectionError,
    pageId: summary.facebook_page_id,
    pageName: summary.facebook_page_name,
    instagramId: summary.instagram_user_id,
    instagramUsername: summary.instagram_username,
    granted: permissionDiff.granted,
    missing: permissionDiff.missing,
  };
}

export async function metaAuthorizeUrl(
  state: string,
  options: { service?: Service } = {},
): Promise<{ url: string | null; missing: string[]; redirectUri: string }> {
  const resolved = await resolveMetaClientConfig(options.service);
  if (resolved.missing.length) return { url: null, missing: resolved.missing, redirectUri: resolved.redirectUri };
  return {
    url: buildMetaBusinessLoginUrl({
      appId: resolved.appId,
      redirectUri: resolved.redirectUri || metaRedirectUri(),
      state,
      configurationId: resolved.configurationId,
    }),
    missing: [],
    redirectUri: resolved.redirectUri || metaRedirectUri(),
  };
}

export async function inspectMetaToken(service: Service, account: Record<string, unknown>) {
  const userToken = await decryptSecret(asString(account.access_token_ciphertext));
  const metadata = (account.metadata || {}) as Record<string, unknown>;
  const pageCipher = asString(metadata.page_access_token_ciphertext);
  const pageToken = pageCipher ? await decryptSecret(pageCipher) : null;
  const token = userToken || pageToken || "";
  if (!token) {
    await service
      .from("social_accounts")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", account.id);
    return {
      ok: true,
      valid: false,
      status: "expired",
      missing_permissions: [],
      scopes: [],
      facebook_page_id: metadata.facebook_page_id || null,
      facebook_page_name: metadata.facebook_page_name || null,
      instagram_user_id: metadata.instagram_user_id || null,
      instagram_username: metadata.instagram_username || null,
      instagram_is_professional: Boolean(metadata.instagram_is_professional),
      instagram_linked: Boolean(metadata.instagram_linked),
      error: "missing_token",
    };
  }

  const resolved = await resolveMetaClientConfig(service);
  const appId = resolved.appId;
  const secret = resolved.appSecret;
  const debugUrl = new URL("https://graph.facebook.com/v21.0/debug_token");
  debugUrl.searchParams.set("input_token", token);
  let debugJson: {
    data?: {
      is_valid?: boolean;
      expires_at?: number;
      scopes?: string[];
      granular_scopes?: Array<{ scope?: string }>;
    };
    error?: { message?: string };
  };
  try {
    const debugRes = await fetch(debugUrl, {
      headers: { Authorization: `Bearer ${appId}|${secret}` },
    });
    debugJson = (await debugRes.json()) as typeof debugJson;
  } catch {
    return {
      ok: true,
      valid: false,
      status: asString(account.status) || "error",
      missing_permissions: [],
      scopes: [],
      facebook_page_id: metadata.facebook_page_id || null,
      facebook_page_name: metadata.facebook_page_name || null,
      instagram_user_id: metadata.instagram_user_id || null,
      instagram_username: metadata.instagram_username || null,
      instagram_is_professional: Boolean(metadata.instagram_is_professional),
      instagram_linked: Boolean(metadata.instagram_linked),
      error: "token_check_failed",
    };
  }
  const data = debugJson.data || {};
  const scopes = [
    ...(Array.isArray(data.scopes) ? data.scopes : []),
    ...(Array.isArray(data.granular_scopes) ? data.granular_scopes.map((item) => asString(item.scope)) : []),
  ].filter(Boolean);
  const permissionDiff = diffMetaPermissions(scopes);
  const valid = Boolean(data.is_valid);
  const linked = Boolean(metadata.instagram_user_id) && metadata.instagram_linked !== false;
  const professional = isProfessionalInstagram(asString(metadata.instagram_account_type), linked);
  let status: string = asString(account.status) || "error";
  if (!valid) status = "expired";
  else if (!linked || !professional || permissionDiff.missing.length) status = "error";
  else status = "connected";

  const nextMeta: Record<string, unknown> = {
    ...metadata,
    granted_permissions: permissionDiff.granted.length ? permissionDiff.granted : metadata.granted_permissions,
    missing_permissions: permissionDiff.missing,
    token_checked_at: new Date().toISOString(),
    token_valid: valid,
    token_expires_at: data.expires_at ? new Date(data.expires_at * 1000).toISOString() : metadata.token_expires_at || null,
    instagram_is_professional: professional,
    connection_error: valid ? (status === "connected" ? null : status === "error" ? "connection_incomplete" : null) : "token_invalid",
  };
  delete nextMeta.page_access_token;
  delete nextMeta.access_token;
  delete nextMeta.accessToken;

  await service
    .from("social_accounts")
    .update({
      status,
      expires_at: data.expires_at ? new Date(data.expires_at * 1000).toISOString() : account.expires_at,
      metadata: nextMeta,
      updated_at: new Date().toISOString(),
    })
    .eq("id", account.id);

  return {
    ok: true,
    valid,
    status,
    expires_at: data.expires_at ? new Date(data.expires_at * 1000).toISOString() : null,
    scopes: permissionDiff.granted,
    missing_permissions: permissionDiff.missing,
    facebook_page_id: metadata.facebook_page_id || null,
    facebook_page_name: metadata.facebook_page_name || null,
    instagram_user_id: metadata.instagram_user_id || null,
    instagram_username: metadata.instagram_username || null,
    instagram_is_professional: professional,
    instagram_linked: linked,
    error: valid ? null : sanitizeProviderError(debugJson.error?.message || "token_invalid"),
  };
}

export function callbackRedirect(params: Record<string, string>): string {
  return adminSocialAccountsUrl(publicBase(), params);
}

export function safeOauthError(raw: string): string {
  return oauthErrorCode(raw);
}
