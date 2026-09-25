import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
function read(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

describe("publisher v1 wiring", () => {
  it("wires Publisher Autopilot to social-publisher without a third scheduler", () => {
    const sql = read("supabase/migrations/20260923120000_publisher_v1.sql");
    expect(sql).toContain("publisher_schedule_rules");
    expect(sql).toContain("publisher_slots");
    expect(sql).toContain("publisher_publications");
    expect(sql).toContain("publisher_destination_jobs");
    expect(sql).toContain("publisher_attempts");
    expect(sql).toContain("unique (rule_id, scheduled_at)");
    expect(sql).toContain("unique (publication_id, destination)");
    expect(sql).toContain("for update of j skip locked");
    expect(sql).toContain("live_posts_enabled boolean not null default false");
    expect(sql).toContain("Europe/Bucharest");
    expect(sql).toContain("publisher_excluded");

    const bridgeSql = read("supabase/migrations/20260925190000_publisher_social_bridge.sql");
    expect(bridgeSql).toContain("publisher_publication_id uuid unique");
    expect(bridgeSql).toContain("live_posts_enabled_at");
    expect(bridgeSql).toContain("skip_reason");
    expect(bridgeSql).toContain("pre_activation");

    const service = read("api/_lib/publisher/service.ts");
    expect(service).toContain("syncPublisherSocialBridge");
    expect(service).toContain("tickSocialPublisher");
    expect(service).not.toMatch(/graph\.facebook\.com|tiktokapis|googleapis\.com\/upload/);
    expect(service).not.toContain("DryRunPublisherAdapter");
    expect(read("api/_lib/publisher/bridge.ts")).toContain("publisher_sync");
    expect(read("src/features/publisher/destinations.ts")).toContain("instagram_reels");
    expect(read("src/features/publisher/destinations.ts")).toContain("youtube_shorts");
    expect(read("src/pages/admin/AdminPublisherPage.tsx")).toContain("AUTOPILOT");
    expect(read("src/pages/admin/AdminPublisherPage.tsx")).not.toMatch(/only dry-run|this dry-run/);

    expect(read("server/routes.mjs")).toContain("/api/publisher");
    expect(read("server/routes.mjs")).toContain("/api/publisher-cron");
    expect(read("server/origin.mjs")).toContain("tickPublisherWorker");
    expect(read("src/layouts/AdminLayout.tsx")).toContain("/admin/publisher");
    expect(read("src/App.tsx")).toContain('path="publisher"');
    const clip = read("api/clip-factory.ts");
    const mediaHandler = clip.indexOf("&& action === \"media\"");
    const providerSign = clip.indexOf("postAction === \"provider_signed_url\"");
    const adminCall = clip.indexOf("admin = await requireClipFactoryAdmin");
    expect(mediaHandler).toBeGreaterThan(0);
    expect(providerSign).toBeGreaterThan(mediaHandler);
    expect(adminCall).toBeGreaterThan(providerSign);
    expect(clip).not.toContain("CLIP_FACTORY_SIGNING_SECRET");
    expect(read("api/_lib/publisher/providerMedia.ts")).not.toMatch(/return .*SECRET/);
    expect(read("src/features/publisher/api.ts")).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
