import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
function read(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

describe("social publisher wiring", () => {
  it("keeps tokens server-side and claims jobs with SKIP LOCKED", () => {
    const sql = read("supabase/migrations/20260918190000_social_publisher.sql");
    expect(sql).toContain("create table if not exists public.social_accounts");
    expect(sql).toContain("access_token_ciphertext");
    expect(sql).toContain("create table if not exists public.social_publications");
    expect(sql).toContain("create table if not exists public.social_publication_targets");
    expect(sql).toContain("create table if not exists public.social_auto_queues");
    expect(sql).toContain("for update of t skip locked");
    expect(sql).toContain("unique (publication_id, platform)");
    expect(sql).toContain("revoke all on public.social_accounts from anon, authenticated");
    expect(sql).not.toMatch(/Europe\/Bucharest/);
    expect(read("supabase/migrations/20260925190000_publisher_social_bridge.sql")).toContain(
      "publisher_publication_id",
    );

    const edge = read("supabase/functions/social-publisher/index.ts");
    expect(edge).toContain("action === \"tick\"");
    expect(edge).toContain("action === \"publisher_sync\"");
    expect(edge).toContain("claim_social_publication_targets");
    expect(edge).toContain("provider_signed_url");
    expect(edge).toContain("resolveProviderReadableUrl");
    expect(edge).toContain("skip_reason");
    expect(edge).toContain("pre_activation");
    expect(edge).toContain("meta_oauth_callback");
    expect(edge).toContain("youtube_oauth_callback");
    expect(edge).toContain("prepare_test_upload");
    expect(read("supabase/functions/_shared/social/meta.ts")).toContain("config_id");
    expect(read("supabase/functions/_shared/social/youtube.ts")).toContain("youtube.readonly");
    expect(read("supabase/functions/_shared/social/youtube.ts")).toContain("youtube.force-ssl");
    expect(read("supabase/functions/social-publisher/index.ts")).toContain("youtube_live_internal_prepare");
    expect(read("supabase/functions/social-publisher/index.ts")).toContain("isServiceRoleRequest(req)");
    expect(read("api/youtube-live.ts")).toContain("requireClipFactoryAdmin");
    expect(read("api/youtube-live.ts")).not.toContain("streamName");
    expect(read("src/features/youtube-live/StartLiveModal.tsx")).toContain("START LIVE");
    expect(read("src/pages/admin/AdminSocialAccountsPage.tsx")).toContain("YouTube Live API");
    expect(read("src/pages/admin/AdminSocialAccountsPage.tsx")).toContain("YouTube Upload");
    expect(read("src/pages/admin/AdminSocialAccountsPage.tsx")).toContain("Reconnect required");
    expect(read("supabase/functions/_shared/social/youtubeAuth.ts")).toContain("finishYouTubeOAuth");
    expect(edge).toContain("encryptSecret");
    expect(edge).not.toContain("page_access_token: undefined");
    expect(edge).toContain("SOCIAL_PUBLISHER_ALLOW_LIVE_POSTS");
    expect(edge).toContain("IMPLEMENTED · WAITING FOR PROVIDER APPROVAL");
    expect(edge).not.toContain("instagram_content_publish App Review");
    expect(edge).not.toContain("VITE_META_APP_SECRET");
    expect(edge).toContain("Already published; will not repost");
    expect(read("api/clip-factory.ts")).toContain("provider_signed_url");
    expect(read("api/clip-factory.ts")).toContain("isServiceRoleRequest");
    expect(read("api/publisher.ts")).toContain("set_autopilot");
    expect(read("src/pages/admin/AdminPublisherPage.tsx")).toContain("YouTube Shorts");
    expect(read("src/features/publisher/destinations.ts")).not.toContain("business_management");
    expect(read("supabase/functions/_shared/social/meta.ts")).toContain("OPTIONAL_META_PERMISSIONS");
    expect(read("supabase/functions/_shared/social/meta.ts")).toMatch(/OPTIONAL_META_PERMISSIONS = \["business_management"\]/);

    const adapters = read("supabase/functions/_shared/social/adapters.ts");
    expect(adapters).toContain("graph.facebook.com/v21.0");
    expect(adapters).toContain("media_type: \"REELS\"");
    expect(adapters).toContain("video_reels");
    expect(adapters).toContain("open.tiktokapis.com/v2/post/publish/video/init/");
    expect(adapters).toContain("googleapis.com/upload/youtube/v3/videos");
    expect(adapters).toContain("selfDeclaredMadeForKids");
    expect(adapters).toContain("publishAt");
    expect(adapters).toContain("persistUploadSession");
    expect(edge).toContain("persistYouTubeUploadSession");

    const cron = read("api/social-publisher-cron.ts");
    expect(cron).toContain("SOCIAL_PUBLISHER_CRON_SECRET");
    expect(cron).toContain("tickSocialPublisher");
    expect(read("api/_lib/social-publisher/invoke.ts")).toContain('action: "tick"');
    expect(read("server/routes.mjs")).toContain("/api/social-publisher-cron");
    expect(read("server/routes.mjs")).toContain("/api/meta-oauth/callback");
    expect(read("server/routes.mjs")).toContain("/api/admin/social/youtube/callback");
    expect(read("api/meta-oauth-callback.ts")).toContain("Referrer-Policy");
    expect(read("api/meta-oauth-callback.ts")).not.toContain("console.log");
    expect(read("api/meta-oauth-callback.ts")).not.toContain("supabase/functions");
    expect(read("api/_lib/metaAdminReturn.ts")).toContain('pathname !== "/admin/social-accounts"');
    expect(read("api/youtube-oauth-callback.ts")).toContain("youtube_oauth_callback");
    expect(read("api/youtube-oauth-callback.ts")).not.toContain("console.log");
    expect(read("api/youtube-oauth-callback.ts")).not.toContain("supabase/functions");

    const deploy = read("scripts/deploy-social-publisher.sh");
    const migrationStop = deploy.indexOf("BLOCKED: migration failed. social-publisher was not deployed.");
    const functionDeploy = deploy.indexOf("functions deploy social-publisher");
    expect(migrationStop).toBeGreaterThan(0);
    expect(functionDeploy).toBeGreaterThan(migrationStop);
    expect(deploy).toContain("20260923180000_meta_login_publishing.sql");
    expect(deploy).toContain("20260923190000_youtube_oauth_publishing.sql");
    expect(deploy).toContain("20260923193000_social_provider_configs.sql");
    expect(deploy).toContain("20260925160000_youtube_live_sessions.sql");
    expect(deploy).toContain("20260925190000_publisher_social_bridge.sql");
    expect(deploy).toContain("YOUTUBE_REDIRECT_URI");
    expect(edge).toContain("upsert_youtube_provider_config");
    expect(edge).toContain("upsert_meta_provider_config");
    expect(edge).toContain("invalidateMetaClientConfigCache()");
    expect(edge).toContain("invalidateYouTubeClientConfigCache()");
    expect(read("supabase/migrations/20260923193000_social_provider_configs.sql")).toContain(
      "social_provider_configs",
    );
    expect(deploy).not.toMatch(/SOCIAL_PUBLISHER_ALLOW_LIVE_POSTS=/);
    expect(deploy).toContain("SET: META_APP_SECRET");
    expect(deploy).toContain("upsert_meta_provider_config");
    expect(deploy).not.toMatch(/META_APP_SECRET=EAA/);
    expect(read("supabase/functions/_shared/social/metaAuth.ts")).toContain("delete nextMeta.page_access_token");
    expect(read("src/pages/admin/AdminSocialAccountsPage.tsx")).toContain("Connect YouTube");
    expect(read("src/pages/admin/AdminSocialAccountsPage.tsx")).toContain("Prepare test upload");
    expect(read("src/pages/admin/AdminSocialAccountsPage.tsx")).toContain("visibleMissing");
  });

  it("does not put generation controls back on Library and keeps generation APIs", () => {
    const library = read("src/pages/admin/AdminLibraryPage.tsx");
    expect(library).not.toMatch(/Higgsfield|Budget USD|Assemble Reel/);
    expect(library).toContain("onShare");
    expect(read("src/features/admin-library/LibraryVideoCard.tsx")).toContain("Share / Schedule");
    expect(read("src/pages/admin/AdminStudioPage.tsx")).toContain("generation");
    expect(read("supabase/functions/generate-nano-banana/index.ts").length).toBeGreaterThan(100);
  });
});
