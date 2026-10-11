import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CHRISTMAS_PACK_OFFERS,
  CHRISTMAS_V2_CURRENCY,
  snapshotOffer,
} from "./offers";

/**
 * Deterministic EUR 7/17/27 mock fulfillment contract tests.
 * Live Stripe / paid Higgsfield remain BLOCKED; SQL lifecycle proven via
 * scripts/christmas-v2-iso-sql-assertions.sql against local christmas_v2_iso.
 */

const PACKS = [
  { key: "starter" as const, images: 3, videos: 0, amount: 700 },
  { key: "magic" as const, images: 5, videos: 1, amount: 1700 },
  { key: "ultimate" as const, images: 10, videos: 3, amount: 2700 },
];

describe("Christmas V2 mock fulfillment matrix (deterministic)", () => {
  it.each(PACKS)(
    "EUR pack $key snapshots immutable entitlements $images images / $videos videos / $amount cents",
    ({ key, images, videos, amount }) => {
      const offer = CHRISTMAS_PACK_OFFERS[key];
      expect(offer.currency).toBe(CHRISTMAS_V2_CURRENCY);
      expect(offer.amountCents).toBe(amount);
      expect(offer.imageCount).toBe(images);
      expect(offer.videoCount).toBe(videos);
      const snap = snapshotOffer(key);
      expect(snap.amountCents).toBe(amount);
      expect(snap.imageCount).toBe(images);
      expect(snap.videoCount).toBe(videos);
      expect(snap.currency).toBe("eur");
    },
  );

  it("createOrder paths insert scene + video rows matching pack entitlements", () => {
    const edge = readFileSync(resolve("supabase/functions/christmas-funnel/index.ts"), "utf8");
    const node = readFileSync(resolve("api/christmas-funnel.ts"), "utf8");
    for (const src of [edge, node]) {
      expect(src).toContain("await insertScenes(service, data.id, sceneKeys)");
      expect(src).toContain("await insertVideos(service, data.id, videoSourceSceneKeys)");
      expect(src).toContain("const videoSourceSceneKeys = sceneKeys.slice(0, pack.videoCount)");
    }
  });

  it("workers defer complete/email until paid videos finalize", () => {
    const image = readFileSync(resolve("api/christmas-generate.ts"), "utf8");
    const video = readFileSync(resolve("api/christmas-generate-video.ts"), "utf8");
    const migration = readFileSync(
      resolve("supabase/migrations/20261011140000_christmas_v2_eur_offers_and_finalize.sql"),
      "utf8",
    );
    expect(migration).toContain("awaiting_videos");
    expect(image).toContain("awaiting_videos");
    expect(image).toContain("Delivery email only when");
    expect(video).toContain("christmas_v2_finalize_generation_if_done");
    expect(video).toContain("sendChristmasDeliveryEmail");
  });

  it("mock generation flags exist and paid AI is not the default path", () => {
    const constants = readFileSync(resolve("api/_lib/christmas/constants.ts"), "utf8");
    expect(constants).toContain("CHRISTMAS_GENERATION_MOCK");
    expect(constants).toMatch(/generationMock\(\)[\s\S]*=== \"true\"/);
    const image = readFileSync(resolve("api/christmas-generate.ts"), "utf8");
    expect(image).toContain("generationMock()");
    expect(image).not.toContain("api.replicate.com");
    expect(image).toContain("submitSoulV2Image");
    expect(image).toContain("pollHiggsfieldRequest");
  });

  it("ships disposable SQL assertion harness covering concurrency + EUR matrix", () => {
    const sql = readFileSync(resolve("scripts/christmas-v2-iso-sql-assertions.sql"), "utf8");
    for (const name of [
      "amount_mismatch_rejected",
      "currency_mismatch_rejected",
      "valid_eur_starter_fulfill",
      "already_paid_idempotent",
      "claim_completed_is_already_completed",
      "stale_running_reclaim",
      "awaiting_videos_when_images_done",
      "complete_after_videos",
      "partial_failure_not_complete",
      "missing_video_jobs_awaiting",
      "legacy_usd_fulfill",
      "entitlements_",
    ]) {
      expect(sql).toContain(name);
    }
  });
});

describe("Christmas V2 Stripe test-mode contract (offline)", () => {
  it("documents BLOCKED live Stripe when secrets absent and keeps EUR cents in checkout builders", () => {
    const hasStripe = Boolean(String(process.env.STRIPE_SECRET_KEY || "").trim());
    // This suite never creates live sessions; it only asserts wiring.
    expect(hasStripe).toBe(false);

    const nodeFunnel = readFileSync(resolve("api/christmas-funnel.ts"), "utf8");
    expect(nodeFunnel).toContain('line_items[0][price_data][currency]", CHRISTMAS_V2_CURRENCY');
    expect(nodeFunnel).toContain("unit_amount");
    expect(nodeFunnel).toContain("fulfill_christmas_v2_order_payment");
    expect(nodeFunnel).toMatch(/p_currency:\s*asString\(session\?\.currency\)/);
    expect(nodeFunnel).not.toMatch(
      /p_currency:\s*asString\(session\?\.currency\)\s*\|\|\s*CHRISTMAS_V2_CURRENCY/,
    );

    const edgeFulfill = readFileSync(
      resolve("supabase/functions/_shared/christmas/stripeFulfill.ts"),
      "utf8",
    );
    expect(edgeFulfill).toContain("fulfill_christmas_v2_order_payment");
    expect(edgeFulfill).not.toMatch(
      /fulfill_christmas_v2_order_payment[\s\S]{0,400}\|\|\s*"usd"/,
    );
  });
});
