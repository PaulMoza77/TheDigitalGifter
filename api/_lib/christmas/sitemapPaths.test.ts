import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHRISTMAS_CATALOG_SEED } from "../../../src/features/christmas/catalog";
import { shellForPath } from "../../../src/features/christmas/routes";
import {
  CHRISTMAS_INDEXABLE_SITEMAP_PATHS,
  christmasIndexableSitemapPaths,
  isChristmasPrivateSharePath,
  shouldOmitFromSitemap,
} from "./sitemapPaths";

function readSrc(relative: string): string {
  return readFileSync(resolve(process.cwd(), relative), "utf8");
}

const LIVE_INDEXABLE = [
  "/christmas",
  "/christmas-ai-photos",
  "/christmas/photo-generator",
  "/christmas/family",
  "/christmas/couples",
  "/christmas/pets",
  "/christmas/dogs",
  "/christmas/cats",
  "/christmas/santa-video",
  "/christmas/wishlist",
  "/christmas/tree",
  "/christmas/advent",
  "/christmas/cards",
  "/christmas/messages",
  "/christmas/gift-finder",
] as const;

describe("christmas sitemap coverage", () => {
  it("lists hub, V2, and live indexable suite routes", () => {
    const paths = christmasIndexableSitemapPaths();
    expect(paths).toEqual(expect.arrayContaining([...LIVE_INDEXABLE]));
  });

  it("covers catalog discoverable routes except noindex/coming-soon shells", () => {
    const paths = new Set(christmasIndexableSitemapPaths());
    for (const product of CHRISTMAS_CATALOG_SEED) {
      if (!product.active || !product.publicDiscoverable) continue;
      if (product.metadata?.coming_soon || shellForPath(product.routePath)?.noindex) {
        expect(paths.has(product.routePath)).toBe(false);
        continue;
      }
      expect(paths.has(product.routePath)).toBe(true);
    }
  });

  it("excludes private shares, order tokens, and noindex shells", () => {
    const paths = christmasIndexableSitemapPaths();
    expect(paths).not.toContain("/christmas/kids");
    expect(paths).not.toContain("/christmas-ai-photos/order");
    expect(paths.some((path) => path.includes(":shareId"))).toBe(false);
    expect(paths.some((path) => path.startsWith("/christmas/tree/"))).toBe(false);
    expect(paths.some((path) => path.startsWith("/wishlist/"))).toBe(false);
    expect(isChristmasPrivateSharePath("/christmas/tree/abc123shareidlong")).toBe(true);
    expect(isChristmasPrivateSharePath("/wishlist/abc123shareidlong")).toBe(true);
    expect(isChristmasPrivateSharePath("/christmas/tree")).toBe(false);
    expect(isChristmasPrivateSharePath("/christmas/wishlist")).toBe(false);
    expect(shouldOmitFromSitemap("https://thedigitalgifter.com/wishlist/secret-share")).toBe(true);
    expect(shouldOmitFromSitemap("https://thedigitalgifter.com/christmas/tree/secret-share")).toBe(true);
    expect(shouldOmitFromSitemap("https://thedigitalgifter.com/christmas/tree")).toBe(false);
  });

  it("sitemap handler uses the shared indexable list and never hardcodes share URLs", () => {
    const sitemap = readSrc("api/sitemap.xml.ts");
    expect(sitemap).toContain("christmasIndexableSitemapPaths");
    expect(sitemap).toContain("shouldOmitFromSitemap");
    expect(sitemap).not.toContain("/christmas/tree/:shareId");
    expect(sitemap).not.toContain("/wishlist/:shareId");
    expect(CHRISTMAS_INDEXABLE_SITEMAP_PATHS).not.toContain("/christmas/tree/:shareId");
    expect(CHRISTMAS_INDEXABLE_SITEMAP_PATHS).not.toContain("/wishlist/:shareId");
  });
});
