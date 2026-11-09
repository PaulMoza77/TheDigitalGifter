import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHRISTMAS_PACKS, CHRISTMAS_SCENES } from "./constants";
import {
  CHRISTMAS_SCENE_VIDEO_PROMPTS,
  CHRISTMAS_VIDEO_DURATION_SECONDS,
  CHRISTMAS_VIDEO_MODEL_DEFAULT,
  CHRISTMAS_VIDEO_SCENE_KEYS,
  buildChristmasVideoPrompt,
  orderReadyForDeliveryEmail,
  resolveVideoSourceSceneKeys,
} from "./videoPrompts";

describe("Christmas scene-specific Higgsfield video prompts", () => {
  it("covers every enabled Christmas scene with a dedicated prompt", () => {
    expect(CHRISTMAS_SCENES).toHaveLength(19);
    expect(CHRISTMAS_VIDEO_SCENE_KEYS).toHaveLength(19);
    for (const scene of CHRISTMAS_SCENES) {
      const def = CHRISTMAS_SCENE_VIDEO_PROMPTS[scene.key];
      expect(def, `missing video prompt for ${scene.key}`).toBeTruthy();
      expect(def.sceneKey).toBe(scene.key);
      expect(def.motion.length).toBeGreaterThan(40);
      const prompt = buildChristmasVideoPrompt(scene.key);
      expect(prompt).toContain(String(CHRISTMAS_VIDEO_DURATION_SECONDS));
      expect(prompt.toLowerCase()).toContain("preserve the exact faces");
      expect(prompt.toLowerCase()).toMatch(/no face morphing|identity/);
      expect(prompt.toLowerCase()).toContain("camera");
      expect(prompt).not.toMatch(/TODO|placeholder|lorem ipsum/i);
      // Scene-specific — not the old single generic string for every scene.
      expect(prompt).toContain(def.motion.slice(0, 32));
    }
  });

  it("keeps Deno and Node prompt registries in sync", () => {
    const deno = readFileSync(
      "supabase/functions/_shared/christmas/videoPrompts.ts",
      "utf8",
    );
    for (const key of CHRISTMAS_VIDEO_SCENE_KEYS) {
      expect(deno).toContain(`"${key}"`);
      expect(deno).toContain(CHRISTMAS_SCENE_VIDEO_PROMPTS[key].motion.slice(0, 48));
    }
  });

  it("defaults to Higgsfield Kling I2V", () => {
    expect(CHRISTMAS_VIDEO_MODEL_DEFAULT).toBe("kling-video/v3.0/pro/image-to-video");
  });
});

describe("Christmas video job entitlements", () => {
  it("creates Magic 1 and Ultimate 3 video source keys from selected scenes", () => {
    const scenes = CHRISTMAS_SCENES.map((s) => s.key);
    expect(resolveVideoSourceSceneKeys(scenes, CHRISTMAS_PACKS.starter.videoCount)).toEqual([]);
    expect(resolveVideoSourceSceneKeys(scenes, CHRISTMAS_PACKS.magic.videoCount)).toEqual([
      scenes[0],
    ]);
    expect(resolveVideoSourceSceneKeys(scenes, CHRISTMAS_PACKS.ultimate.videoCount)).toEqual(
      scenes.slice(0, 3),
    );
  });

  it("never promises videos for Starter", () => {
    expect(CHRISTMAS_PACKS.starter.videoCount).toBe(0);
    expect(CHRISTMAS_PACKS.starter.imageCount).toBe(3);
    expect(CHRISTMAS_PACKS.magic.imageCount).toBe(5);
    expect(CHRISTMAS_PACKS.magic.videoCount).toBe(1);
    expect(CHRISTMAS_PACKS.ultimate.imageCount).toBe(10);
    expect(CHRISTMAS_PACKS.ultimate.videoCount).toBe(3);
    expect(CHRISTMAS_PACKS.starter.amountCents).toBe(700);
    expect(CHRISTMAS_PACKS.magic.amountCents).toBe(1700);
    expect(CHRISTMAS_PACKS.ultimate.amountCents).toBe(2700);
  });
});

describe("Christmas delivery email readiness", () => {
  it("blocks Magic/Ultimate email until videos finish", () => {
    const scenes = Array.from({ length: 5 }, () => ({ status: "succeeded" }));
    expect(
      orderReadyForDeliveryEmail({
        videoCount: 1,
        scenes,
        videos: [{ status: "queued" }],
      }).ready,
    ).toBe(false);
    expect(
      orderReadyForDeliveryEmail({
        videoCount: 1,
        scenes,
        videos: [{ status: "succeeded" }],
      }).ready,
    ).toBe(true);
  });

  it("allows Starter email after images only", () => {
    expect(
      orderReadyForDeliveryEmail({
        videoCount: 0,
        scenes: [{ status: "succeeded" }, { status: "succeeded" }, { status: "succeeded" }],
        videos: [],
      }).ready,
    ).toBe(true);
  });

  it("marks partial failure without claiming full success", () => {
    const result = orderReadyForDeliveryEmail({
      videoCount: 3,
      scenes: Array.from({ length: 10 }, (_, i) => ({
        status: i === 0 ? "failed" : "succeeded",
      })),
      videos: [{ status: "succeeded" }, { status: "failed" }, { status: "succeeded" }],
    });
    expect(result.ready).toBe(true);
    expect(result.partialFailure).toBe(true);
    expect(result.allFailed).toBe(false);
  });

  it("requires payment gate in generate workers (source contract)", () => {
    const edgeVideo = readFileSync(
      "supabase/functions/christmas-generate-video/index.ts",
      "utf8",
    );
    const edgeImage = readFileSync("supabase/functions/christmas-generate/index.ts", "utf8");
    expect(edgeVideo).toContain("PAYMENT_REQUIRED");
    expect(edgeVideo).toContain("christmas_v2_order_videos");
    expect(edgeVideo).toContain("buildChristmasVideoPrompt");
    expect(edgeVideo).toContain("generateChristmasHiggsfieldVideo");
    expect(edgeVideo).not.toContain("REPLICATE_API_TOKEN");
    expect(edgeImage).toContain("christmas_v2_finalize_generation_if_done");
    expect(edgeImage).toContain("should_enqueue_video");
    expect(edgeImage).toContain("ready_for_email");
  });
});
