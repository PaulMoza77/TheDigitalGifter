import { buildMetaBusinessLoginUrl } from "./meta";
import { REQUIRED_YOUTUBE_SCOPES, buildYouTubeAuthorizeUrl as buildYouTubeAuthorizeUrlShared } from "./youtube";
import type { SocialProvider } from "./types";

export const META_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
] as const;

export const TIKTOK_OAUTH_SCOPES = ["user.info.basic", "video.upload", "video.publish"] as const;

export const YOUTUBE_OAUTH_SCOPES = REQUIRED_YOUTUBE_SCOPES;

export function buildMetaAuthorizeUrl(input: {
  appId: string;
  redirectUri: string;
  state: string;
  configurationId?: string;
}): string {
  if (input.configurationId) {
    return buildMetaBusinessLoginUrl({
      appId: input.appId,
      redirectUri: input.redirectUri,
      state: input.state,
      configurationId: input.configurationId,
    });
  }
  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", input.appId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", META_OAUTH_SCOPES.join(","));
  return url.toString();
}

export function buildTikTokAuthorizeUrl(input: {
  clientKey: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", input.clientKey);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", TIKTOK_OAUTH_SCOPES.join(","));
  return url.toString();
}

export function buildYouTubeAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  forceConsent?: boolean;
}): string {
  return buildYouTubeAuthorizeUrlShared(input);
}

export function oauthRedirectPath(provider: SocialProvider): string {
  return `/admin/social-accounts?oauth=${provider}`;
}
