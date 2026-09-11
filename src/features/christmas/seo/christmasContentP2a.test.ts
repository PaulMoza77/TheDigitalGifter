import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyChristmasSeo } from "../../../../server/christmasSeo.mjs";
import {
  CONTENT_DEPTH_PATHS,
  getChristmasContentDepth,
} from "../../../../server/christmasContentDepth.mjs";

const MONEY = [
  "/christmas",
  "/christmas/gift-finder",
  "/christmas/photo-generator",
  "/christmas/santa-video",
  "/christmas/wishlist",
  "/christmas/cards",
] as const;

describe("christmas P2A content depth", () => {
  it("covers exactly the six money pages", () => {
    expect(CONTENT_DEPTH_PATHS.sort()).toEqual([...MONEY].sort());
  });

  it("injects GEO + FAQ into SSR HTML for each money page", () => {
    const template = readFileSync(join(process.cwd(), "index.html"), "utf8");
    for (const path of MONEY) {
      const depth = getChristmasContentDepth(path);
      expect(depth).toBeTruthy();
      const html = applyChristmasSeo(template, path);
      expect(html).toContain(depth!.geo.h2);
      expect(html).toContain("Frequently Asked Questions");
      expect(html).toContain('data-tdg-depth="p2a"');
      expect(html).toMatch(/FAQPage/);
      expect(depth!.faqs.length).toBeGreaterThanOrEqual(5);
      for (const marker of depth!.markers) {
        expect(html).toContain(marker);
      }
    }
  });

  it("keeps page intents semantically distinct", () => {
    const gift = getChristmasContentDepth("/christmas/gift-finder")!;
    const photo = getChristmasContentDepth("/christmas/photo-generator")!;
    const cards = getChristmasContentDepth("/christmas/cards")!;
    expect(gift.geo.h2).not.toEqual(photo.geo.h2);
    expect(photo.geo.h2).not.toEqual(cards.geo.h2);
    expect(gift.geo.body).not.toEqual(photo.geo.body);
  });

  it("wires hub Gift Finder scene + GEO scene", () => {
    const landing = readFileSync(
      join(process.cwd(), "src/features/christmas/landing/ChristmasLandingExperience.tsx"),
      "utf8",
    );
    expect(landing).toContain("GiftFinderScene");
    expect(landing).toContain("GeoScene");
  });

  it("aligns client money-page H2 markers with SSR depth", () => {
    const photoCopy = readFileSync(
      join(process.cwd(), "src/features/christmas/photoGenerator/copy.ts"),
      "utf8",
    );
    expect(photoCopy).toContain("Turn Your Photo Into a Christmas Portrait");
    expect(photoCopy).toContain("What Photos Work Best?");
    expect(photoCopy).toContain("Christmas Photos for Families, Couples and Pets");

    const santaCopy = readFileSync(
      join(process.cwd(), "src/features/christmas/santa/santaCopy.ts"),
      "utf8",
    );
    expect(santaCopy).toContain("A Personalized Message From Santa");
    expect(santaCopy).toContain("What Can Santa Mention?");
    expect(santaCopy).toContain("Personalized Santa Video Examples");
    expect(santaCopy).not.toContain("Founder review");
    expect(santaCopy).not.toContain("half a minute");

    const wishlistCopy = readFileSync(
      join(process.cwd(), "src/features/christmas/wishlist/copy.ts"),
      "utf8",
    );
    expect(wishlistCopy).toContain("Add Anything You Wish For");

    const cardsCopy = readFileSync(
      join(process.cwd(), "src/features/christmas/cards/cardMakerCopy.ts"),
      "utf8",
    );
    expect(cardsCopy).toContain("Use Your Christmas Portrait");
    expect(cardsCopy).toContain("What is an online Christmas card maker?");

    const photoSeo = readFileSync(
      join(process.cwd(), "src/features/christmas/photoGenerator/seo.ts"),
      "utf8",
    );
    expect(photoSeo).not.toContain('"@type": "Offer"');
    expect(photoSeo).not.toContain("SoftwareApplication");
  });
});
