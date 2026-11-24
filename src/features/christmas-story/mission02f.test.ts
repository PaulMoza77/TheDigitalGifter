import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEMO_GIFT } from "./data/demoGift";
import { authorizeMediaAccess } from "../../../server/christmas-story-media/privateStore.ts";

const root = resolve(process.cwd());

function read(rel: string) {
  return readFileSync(resolve(root, rel), "utf8");
}

describe("Mission 02F — private media + staging gates", () => {
  it("authorization denies cross-order and revoked recipient access", () => {
    const orderA = "11111111-1111-4111-8111-111111111111";
    const orderB = "22222222-2222-4222-8222-222222222222";
    expect(
      authorizeMediaAccess({
        assetOrderId: orderA,
        storagePath: `${orderA}/film.mp4`,
        buyerOrderId: orderA,
      }).allowed,
    ).toBe(true);
    expect(
      authorizeMediaAccess({
        assetOrderId: orderA,
        storagePath: `${orderA}/film.mp4`,
        buyerOrderId: orderB,
      }).allowed,
    ).toBe(false);
    expect(
      authorizeMediaAccess({
        assetOrderId: orderA,
        storagePath: `${orderA}/film.mp4`,
        recipientGrant: { orderId: orderA, enabled: false, revokedAt: "2026-01-01" },
      }).allowed,
    ).toBe(false);
  });

  it("edge signMedia fails closed without public fallback", () => {
    const edge = read("supabase/functions/christmas-story/index.ts");
    expect(edge).toContain('action === "signMedia" || action === "renewMedia"');
    expect(edge).toContain("path_not_order_scoped");
    expect(edge).toContain("christmas_story_media_sign_events");
    expect(edge).toContain("url: null");
    expect(edge).toContain("never allow anonymous uploads");
  });

  it("ships private store + staging worker bridge", () => {
    expect(existsSync(resolve(root, "server/christmas-story-media/privateStore.ts"))).toBe(true);
    expect(existsSync(resolve(root, "scripts/christmas-story-02f/staging-film-worker.mjs"))).toBe(
      true,
    );
    expect(existsSync(resolve(root, "scripts/christmas-story-02f/private-media-e2e.mjs"))).toBe(
      true,
    );
    const worker = read("scripts/christmas-story-02f/staging-film-worker.mjs");
    expect(worker).toContain("CS_STAGING_ALLOW_REMOTE");
    expect(worker).toContain("refused_suspicious_host");
  });

  it("demo presentation avoids overclaiming stock moments", () => {
    expect(DEMO_GIFT.film.frames.some((f) => /table set for us/i.test(f.caption))).toBe(false);
    expect(DEMO_GIFT.song.audioUrl).toBeNull();
    expect(DEMO_GIFT.film.frames.length).toBeGreaterThanOrEqual(6);
  });

  it("migration adds private media sign events", () => {
    const sql = read("supabase/migrations/20261125010000_christmas_story_02f_private_media.sql");
    expect(sql).toContain("christmas_story_media_sign_events");
    expect(sql).toContain("public = false");
  });
});
