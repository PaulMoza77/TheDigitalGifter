import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHRISTMAS_INDEXABLE_SEO,
  CHRISTMAS_SPA_SEO,
  isChristmasSharePath,
  resolveChristmasSpaSeo,
} from "./christmasPageHead";

function readSrc(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("CHRISTMAS-032 SPA PageHead SEO", () => {
  it("gives hub + live verticals unique titles, descriptions, and canonicals", () => {
    const titles = CHRISTMAS_INDEXABLE_SEO.map((entry) => entry.title);
    const descriptions = CHRISTMAS_INDEXABLE_SEO.map((entry) => entry.description);
    const canonicals = CHRISTMAS_INDEXABLE_SEO.map((entry) => entry.canonical);

    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    expect(new Set(canonicals).size).toBe(canonicals.length);
    expect(CHRISTMAS_INDEXABLE_SEO.every((entry) => entry.canonical.startsWith("https://"))).toBe(
      true,
    );
    expect(CHRISTMAS_INDEXABLE_SEO.some((entry) => entry.id === "hub")).toBe(true);
  });

  it("marks cards and messages indexable=true", () => {
    expect(resolveChristmasSpaSeo("/christmas/cards")?.indexable).toBe(true);
    expect(resolveChristmasSpaSeo("/christmas/messages")?.indexable).toBe(true);
    expect(readSrc("src/features/christmas/ChristmasCardsPage.tsx")).toContain("indexable");
    expect(readSrc("src/features/christmas/ChristmasMessagesPage.tsx")).toContain("indexable");
  });

  it("noindexes share and tree personal pages", () => {
    expect(isChristmasSharePath("/christmas/tree/abc")).toBe(true);
    expect(isChristmasSharePath("/christmas/tree")).toBe(false);
    expect(isChristmasSharePath("/wishlist/share-1")).toBe(true);
    expect(resolveChristmasSpaSeo("/christmas/tree/abc")?.indexable).toBe(false);
    expect(resolveChristmasSpaSeo("/wishlist/share-1")?.indexable).toBe(false);
    expect(resolveChristmasSpaSeo("/christmas/tree")?.indexable).toBe(true);
    expect(readSrc("src/features/christmas/ChristmasTreePage.tsx")).toContain("noindex");
    expect(readSrc("src/features/christmas/ChristmasWishlistPage.tsx")).toContain("noindex");
  });

  it("keeps kids shell noindex and aliases gift-finder canonical", () => {
    expect(resolveChristmasSpaSeo("/christmas/kids")?.indexable).toBe(false);
    expect(resolveChristmasSpaSeo("/christmas/gifts")?.canonical).toBe(
      "https://www.thedigitalgifter.com/christmas/gift-finder",
    );
    expect(readSrc("src/features/christmas/components/ChristmasFeatureShell.tsx")).toContain(
      "noindex={shell.noindex}",
    );
  });

  it("renders PageHead on hub + every live vertical file", () => {
    const files = [...new Set(CHRISTMAS_SPA_SEO.map((entry) => entry.pageFile))];
    for (const file of files) {
      expect(readSrc(file)).toContain("<PageHead");
    }
    expect(readSrc("src/components/PageHead.tsx")).toContain("noindex,follow");
    expect(readSrc("src/components/PageHead.tsx")).toContain("index,follow");
    expect(readSrc("src/components/PageHead.tsx")).toContain("canonical");
    expect(readSrc("src/components/PageHead.tsx")).toContain("og:title");
  });

  it("lists indexable Christmas paths in the sitemap and documents the SPA limitation", () => {
    const sitemap = readSrc("api/sitemap.xml.ts");
    for (const entry of CHRISTMAS_INDEXABLE_SEO) {
      expect(sitemap).toContain(`"${entry.path}"`);
    }
    expect(sitemap).not.toContain('"/christmas/kids"');
    expect(sitemap).not.toContain("/christmas/tree/");

    const doc = readSrc("docs/TDG_CHRISTMAS_SPA_PAGEHEAD.md");
    expect(doc).toContain("CHRISTMAS-032");
    expect(doc).toContain("not SSR HTML");
    expect(doc).toContain("CHRISTMAS-033");
    expect(readSrc("src/components/PageHead.tsx")).toContain("not SSR HTML");
  });
});
