import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyChristmasSeo } from "../../../../server/christmasSeo.mjs";
import { getChristmasContentDepth } from "../../../../server/christmasContentDepth.mjs";

const ADJACENT = [
  "/christmas/family",
  "/christmas/couples",
  "/christmas/pets",
  "/christmas/dogs",
  "/christmas/cats",
  "/christmas/tree",
  "/christmas/advent",
  "/christmas/messages",
] as const;

describe("christmas P2B adjacent content depth", () => {
  it("covers eight adjacent indexable pages as p2b", () => {
    for (const path of ADJACENT) {
      const depth = getChristmasContentDepth(path);
      expect(depth?.wave).toBe("p2b");
      expect(depth!.faqs.length).toBeGreaterThanOrEqual(5);
      expect(depth!.markers.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("injects GEO + FAQ into SSR HTML for each adjacent page", () => {
    const template = readFileSync(join(process.cwd(), "index.html"), "utf8");
    for (const path of ADJACENT) {
      const depth = getChristmasContentDepth(path)!;
      const html = applyChristmasSeo(template, path);
      expect(html).toContain(depth.geo.h2);
      expect(html).toContain("Frequently Asked Questions");
      expect(html).toContain('data-tdg-depth="p2b"');
      expect(html).toMatch(/FAQPage/);
      for (const marker of depth.markers) {
        expect(html).toContain(marker);
      }
    }
  });

  it("keeps portrait vertical intents distinct", () => {
    const family = getChristmasContentDepth("/christmas/family")!;
    const couples = getChristmasContentDepth("/christmas/couples")!;
    const pets = getChristmasContentDepth("/christmas/pets")!;
    const dogs = getChristmasContentDepth("/christmas/dogs")!;
    const cats = getChristmasContentDepth("/christmas/cats")!;
    const photo = getChristmasContentDepth("/christmas/photo-generator")!;

    expect(family.geo.h2).not.toEqual(photo.geo.h2);
    expect(couples.geo.h2).not.toEqual(family.geo.h2);
    expect(pets.geo.h2).not.toEqual(dogs.geo.h2);
    expect(dogs.geo.h2).not.toEqual(cats.geo.h2);
    expect(dogs.geo.body).not.toEqual(cats.geo.body);
    expect(family.faqs[0].q).not.toEqual(couples.faqs[0].q);
  });

  it("keeps tree / advent / messages product intents distinct", () => {
    const tree = getChristmasContentDepth("/christmas/tree")!;
    const advent = getChristmasContentDepth("/christmas/advent")!;
    const messages = getChristmasContentDepth("/christmas/messages")!;
    expect(tree.geo.h2).toMatch(/digital Christmas tree/i);
    expect(advent.geo.h2).toMatch(/Advent calendar/i);
    expect(messages.geo.h2).toMatch(/message generator/i);
    expect(tree.geo.body).not.toEqual(advent.geo.body);
  });

  it("wires client SEO depth for verticals and product pages", () => {
    const funnel = readFileSync(
      join(process.cwd(), "src/features/christmas/ChristmasPortraitFunnelPage.tsx"),
      "utf8",
    );
    expect(funnel).toContain("PortraitVerticalSeoSections");

    const family = readFileSync(
      join(process.cwd(), "src/features/christmas/family/copy.ts"),
      "utf8",
    );
    expect(family).toContain("Create a Family Christmas Portrait");
    expect(family).toContain("What is a family Christmas photo generator?");
    expect(family).toContain("What Family Photos Work Best?");

    const tree = readFileSync(
      join(process.cwd(), "src/features/christmas/ChristmasTreePage.tsx"),
      "utf8",
    );
    expect(tree).toContain("TREE_SEO_DEPTH");

    const advent = readFileSync(
      join(process.cwd(), "src/features/christmas/ChristmasAdventPage.tsx"),
      "utf8",
    );
    expect(advent).toContain("ADVENT_SEO_DEPTH");

    const messages = readFileSync(
      join(process.cwd(), "src/features/christmas/ChristmasMessagesPage.tsx"),
      "utf8",
    );
    expect(messages).toContain("MESSAGES_SEO_DEPTH");
  });

  it("does not invent fake Offer schema on family page", () => {
    const familySeo = readFileSync(
      join(process.cwd(), "src/features/christmas/family/seo.ts"),
      "utf8",
    );
    expect(familySeo).not.toContain("SoftwareApplication");
    expect(familySeo).not.toContain('"@type": "Offer"');
  });
});
