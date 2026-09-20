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

    const edge = read("supabase/functions/social-publisher/index.ts");
    expect(edge).toContain("action === \"tick\"");
    expect(edge).toContain("claim_social_publication_targets");
    expect(edge).toContain("encryptSecret");
    expect(edge).toContain("SOCIAL_PUBLISHER_ALLOW_LIVE_POSTS");
    expect(edge).toContain("IMPLEMENTED — WAITING FOR PROVIDER APPROVAL");
    expect(edge).not.toContain("VITE_META_APP_SECRET");
    expect(edge).toContain("Already published; will not repost");

    const adapters = read("supabase/functions/_shared/social/adapters.ts");
    expect(adapters).toContain("graph.facebook.com/v21.0");
    expect(adapters).toContain("media_type: \"REELS\"");
    expect(adapters).toContain("video_reels");
    expect(adapters).toContain("open.tiktokapis.com/v2/post/publish/video/init/");
    expect(adapters).toContain("googleapis.com/upload/youtube/v3/videos");

    const cron = read("api/social-publisher-cron.ts");
    expect(cron).toContain("SOCIAL_PUBLISHER_CRON_SECRET");
    expect(cron).toContain("action: \"tick\"");
    expect(read("server/routes.mjs")).toContain("/api/social-publisher-cron");
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
