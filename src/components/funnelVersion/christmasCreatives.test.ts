import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHRISTMAS_CREATIVES, CHRISTMAS_HERO_CREATIVE } from "./christmasCreatives";

describe("christmas funnel creatives", () => {
  it("builds each after clip from a distinct before photo", () => {
    expect(CHRISTMAS_CREATIVES).toHaveLength(3);
    const befores = CHRISTMAS_CREATIVES.map((item) => item.beforeSrc);
    expect(new Set(befores).size).toBe(3);
    for (const item of CHRISTMAS_CREATIVES) {
      expect(item.beforeSrc).toMatch(/christmas.*before\.png$/);
      expect(item.clipSrc).toMatch(/\.mp4$/);
      expect(item.posterSrc).toMatch(/\.jpg$/);
      expect(item.clipSrc).toContain(item.id);
    }
    expect(CHRISTMAS_HERO_CREATIVE.id).toBe("family");
  });

  it("renders the memories-style before/after filter on the Christmas homepage", () => {
    const page = readFileSync(new URL("./FunnelHomePage.tsx", import.meta.url), "utf8");
    expect(page).toContain("BeforeAfterClip");
    expect(page).toContain("CHRISTMAS_CREATIVES");
    expect(page).toContain('id="examples"');
  });
});
