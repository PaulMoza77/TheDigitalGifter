import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHRISTMAS_INDEXABLE_PATHS,
  getChristmasPermanentRedirectTarget,
  shouldNoindexChristmasPath,
  should404UnknownChristmasPath,
  buildApexToWwwLocation,
  buildTrailingSlashRedirect,
} from "../../../../server/christmasIndexing.mjs";
import { getChristmasSeo } from "../../../../server/christmasSeo.mjs";
import { CHRISTMAS_SITEMAP_PATHS, SITE_URL } from "../../../../api/sitemap.xml.ts";

describe("christmas P1 indexing policy", () => {
  it("redirects gifts alias to gift-finder", () => {
    expect(getChristmasPermanentRedirectTarget("/christmas/gifts")).toBe("/christmas/gift-finder");
    expect(getChristmasSeo("/christmas/gifts")).toBeNull();
  });

  it("keeps primary product pages indexable and kids/funnel noindex", () => {
    for (const path of CHRISTMAS_INDEXABLE_PATHS) {
      expect(shouldNoindexChristmasPath(path)).toBe(false);
    }
    expect(shouldNoindexChristmasPath("/christmas/kids")).toBe(true);
    expect(shouldNoindexChristmasPath("/christmas-ai-photos")).toBe(true);
    expect(shouldNoindexChristmasPath("/christmas-ai-photos/order")).toBe(true);
    expect(shouldNoindexChristmasPath("/wishlist/x")).toBe(true);
    expect(shouldNoindexChristmasPath("/christmas/tree/x")).toBe(true);
  });

  it("aligns sitemap list with indexable paths on www", () => {
    expect(SITE_URL).toBe("https://www.thedigitalgifter.com");
    // EN indexable paths remain; P3A may append complete localized pilots (e.g. /ro/...)
    for (const path of CHRISTMAS_INDEXABLE_PATHS) {
      expect(CHRISTMAS_SITEMAP_PATHS).toContain(path);
    }
    expect(CHRISTMAS_SITEMAP_PATHS).toContain("/ro/christmas/cards");
    expect(CHRISTMAS_SITEMAP_PATHS).not.toContain("/en/christmas");
  });

  it("normalizes apex host and trailing slash", () => {
    expect(buildApexToWwwLocation("thedigitalgifter.com", "/christmas/cards", "?a=1")).toBe(
      "https://www.thedigitalgifter.com/christmas/cards?a=1",
    );
    expect(buildTrailingSlashRedirect("/christmas/cards/")).toBe("/christmas/cards");
  });

  it("404s unknown christmas product URLs", () => {
    expect(should404UnknownChristmasPath("/christmas/not-a-real-product")).toBe(true);
    expect(should404UnknownChristmasPath("/christmas/photo-generator")).toBe(false);
    expect(should404UnknownChristmasPath("/ro/christmas/cards")).toBe(false);
    expect(should404UnknownChristmasPath("/ro/christmas/not-a-real-product")).toBe(true);
  });

  it("wires origin + vercel + robots for P1", () => {
    const origin = readFileSync(join(process.cwd(), "server/origin.mjs"), "utf8");
    expect(origin).toContain("buildChristmasRedirectLocation");
    expect(origin).toContain("buildApexToWwwLocation");
    expect(origin).toContain("should404UnknownChristmasPath");
    const vercel = readFileSync(join(process.cwd(), "vercel.json"), "utf8");
    expect(vercel).toContain("/christmas/gifts");
    const robots = readFileSync(join(process.cwd(), "public/robots.txt"), "utf8");
    expect(robots).toContain("https://www.thedigitalgifter.com/sitemap.xml");
    expect(robots).not.toMatch(/Disallow:\s*\/wishlist/);
  });
});
