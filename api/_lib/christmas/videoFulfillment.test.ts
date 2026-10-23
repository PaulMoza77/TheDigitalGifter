import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHRISTMAS_PACKS } from "./constants";
import { resolveVideoSourceSceneKeys } from "./videoPrompts";

/**
 * Isolated contract tests for Magic/Ultimate fulfillment wiring.
 * These are mock/regression checks — not real Higgsfield generation evidence.
 */

describe("Christmas V2 video fulfillment contracts (mock/isolated)", () => {
  it("primary createOrder paths insert video rows for paid packs", () => {
    const apiFunnel = readFileSync("api/christmas-funnel.ts", "utf8");
    const edgeFunnel = readFileSync("supabase/functions/christmas-funnel/index.ts", "utf8");
    for (const src of [apiFunnel, edgeFunnel]) {
      expect(src).toContain("resolveVideoSourceSceneKeys");
      expect(src).toContain("insertVideos(service, data.id, videoSourceSceneKeys)");
      expect(src).toContain('currency: "eur"');
    }
  });

  it("video workers use christmas_v2_* tables and Higgsfield only", () => {
    const edge = readFileSync("supabase/functions/christmas-generate-video/index.ts", "utf8");
    const node = readFileSync("api/christmas-generate-video.ts", "utf8");
    for (const src of [edge, node]) {
      expect(src).toContain("christmas_v2_orders");
      expect(src).toContain("christmas_v2_order_scenes");
      expect(src).toContain("christmas_v2_order_videos");
      expect(src).toContain("generateChristmasHiggsfieldVideo");
      expect(src).toContain("christmas_v2_finalize_generation_if_done");
      expect(src).toContain("Downloaded video is too small to be valid");
      expect(src).not.toMatch(/seedance|REPLICATE_API_TOKEN/);
    }
  });

  it("completion email is gated until videos complete for Magic/Ultimate", () => {
    const edgeImage = readFileSync("supabase/functions/christmas-generate/index.ts", "utf8");
    const nodeImage = readFileSync("api/christmas-generate.ts", "utf8");
    for (const src of [edgeImage, nodeImage]) {
      expect(src).toContain("ready_for_email");
      expect(src).toContain("should_enqueue_video");
      expect(src).toContain("christmas_v2_finalize_generation_if_done");
    }
    const edgeVideo = readFileSync("supabase/functions/christmas-generate-video/index.ts", "utf8");
    expect(edgeVideo).toContain("sendChristmasDeliveryEmail");
  });

  it("email helpers write christmas_v2_email_deliveries with idempotency", () => {
    const edgeEmail = readFileSync("supabase/functions/_shared/christmas/email.ts", "utf8");
    const nodeEmail = readFileSync("api/_lib/christmas/email.ts", "utf8");
    for (const src of [edgeEmail, nodeEmail]) {
      expect(src).toContain("christmas_v2_email_deliveries");
      expect(src).toContain("christmas_v2_orders");
      expect(src).toContain("Idempotency-Key");
      expect(src).toContain("already_sent");
    }
  });

  it("migration defines video-aware V2 finalize RPC", () => {
    const migration = readFileSync(
      "supabase/migrations/20261023180000_christmas_v2_video_finalize.sql",
      "utf8",
    );
    expect(migration).toContain("christmas_v2_finalize_generation_if_done");
    expect(migration).toContain("should_enqueue_video");
    expect(migration).toContain("ready_for_email");
    expect(migration).toContain("christmas_v2_order_videos");
    expect(migration).toContain("christmas_v2_order_videos_order_source_uidx");
  });

  it("maps package entitlements to correct video job counts", () => {
    const sceneKeys = [
      "by-the-christmas-tree",
      "snowy-winter-portrait",
      "cozy-christmas",
      "grand-evergreen",
      "festive-dinner",
      "red-gold-card",
      "by-the-hearth",
      "choosing-the-star",
      "story-time",
      "sweater-weather",
    ];
    expect(resolveVideoSourceSceneKeys(sceneKeys, CHRISTMAS_PACKS.magic.videoCount)).toHaveLength(1);
    expect(resolveVideoSourceSceneKeys(sceneKeys, CHRISTMAS_PACKS.ultimate.videoCount)).toHaveLength(
      3,
    );
    expect(resolveVideoSourceSceneKeys(sceneKeys, CHRISTMAS_PACKS.starter.videoCount)).toHaveLength(0);
  });

  it("origin routes expose generate + generate-video for same-origin enqueue", () => {
    const routes = readFileSync("server/routes.mjs", "utf8");
    expect(routes).toContain('"/api/christmas-generate": "christmas-generate.ts"');
    expect(routes).toContain('"/api/christmas-generate-video": "christmas-generate-video.ts"');
  });
});
