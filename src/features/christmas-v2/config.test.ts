import { describe, expect, it } from "vitest";
import {
  CHRISTMAS_COGS_ESTIMATE,
  CHRISTMAS_PACKS,
  CHRISTMAS_STARTER_SCENES,
  CHRISTMAS_UPSELL_SCENES,
  CHRISTMAS_V2_ROUTE,
  buildChristmasScenePrompt,
  pickSurpriseScenes,
} from "./config";

describe("christmas-v2 config", () => {
  it("exposes the SEO funnel route", () => {
    expect(CHRISTMAS_V2_ROUTE).toBe("/christmas-ai-photos");
  });

  it("defines starter/magic/ultimate packs with EUR economics", () => {
    expect(CHRISTMAS_PACKS.starter.priceCents).toBe(700);
    expect(CHRISTMAS_PACKS.starter.imageCount).toBe(3);
    expect(CHRISTMAS_PACKS.starter.videoCount).toBe(0);
    expect(CHRISTMAS_PACKS.magic.priceCents).toBe(1700);
    expect(CHRISTMAS_PACKS.magic.imageCount).toBe(5);
    expect(CHRISTMAS_PACKS.magic.videoCount).toBe(1);
    expect(CHRISTMAS_PACKS.ultimate.priceCents).toBe(2700);
    expect(CHRISTMAS_PACKS.ultimate.imageCount).toBe(10);
    expect(CHRISTMAS_PACKS.ultimate.videoCount).toBe(3);
  });

  it("maps starter scenes to existing Christmas style concepts", () => {
    expect(CHRISTMAS_STARTER_SCENES).toHaveLength(3);
    expect(CHRISTMAS_STARTER_SCENES.map((s) => s.key)).toEqual([
      "by-the-christmas-tree",
      "snowy-winter-portrait",
      "cozy-christmas",
    ]);
    expect(CHRISTMAS_STARTER_SCENES.every((s) => s.orientation === "portrait")).toBe(true);
  });

  it("keeps a diverse upsell pool from existing generator styles", () => {
    expect(CHRISTMAS_UPSELL_SCENES.length).toBeGreaterThanOrEqual(8);
    const surprise = pickSurpriseScenes(8);
    expect(surprise).toHaveLength(8);
    expect(new Set(surprise).size).toBe(8);
  });

  it("builds identity-preserving prompts", () => {
    const prompt = buildChristmasScenePrompt(CHRISTMAS_STARTER_SCENES[0]);
    expect(prompt).toContain("CRITICAL");
    expect(prompt).toContain("By the Christmas Tree");
    expect(prompt.toLowerCase()).toContain("recognizable");
  });

  it("estimates positive COGS below pack EUR price", () => {
    expect(CHRISTMAS_COGS_ESTIMATE.starter.totalUsd).toBeLessThan(7);
    expect(CHRISTMAS_COGS_ESTIMATE.magic.totalUsd).toBeLessThan(17);
    expect(CHRISTMAS_COGS_ESTIMATE.ultimate.totalUsd).toBeLessThan(27);
  });
});
