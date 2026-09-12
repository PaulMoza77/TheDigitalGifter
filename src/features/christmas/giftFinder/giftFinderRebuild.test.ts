import { describe, expect, it } from "vitest";
import { EXAMPLE_SETS, findExampleForProfile, HERO_DEMO } from "./examples";
import { giftFinderSeo, GIFT_FINDER_FAQS } from "./seo";
import { gfT } from "./copy";
import {
  PERSONALITY_KEYS,
  primaryVibeFromPersonalities,
  SEO_TAXONOMY_LINKS,
  seoGiftPath,
} from "../wishlist/taxonomy";

describe("gift finder examples", () => {
  it("ships at least four curated example profiles", () => {
    expect(EXAMPLE_SETS.length).toBeGreaterThanOrEqual(4);
    expect(HERO_DEMO.ideas[0]?.title).toMatch(/Recipe Book/i);
  });

  it("matches mom cooking sentimental scenario", () => {
    const hit = findExampleForProfile({
      recipientKey: "mom",
      interestKeys: ["cooking", "travel"],
      personalityKeys: ["sentimental"],
    });
    expect(hit?.id).toBe("mom_sentimental");
    expect(hit?.ideas).toHaveLength(5);
    expect(hit?.ideas.every((i) => i.reason.length > 20)).toBe(true);
    expect(new Set(hit?.ideas.map((i) => i.ranking_role)).size).toBe(5);
  });

  it("biases dad has-everything away from generic clutter", () => {
    const hit = findExampleForProfile({
      recipientKey: "dad",
      interestKeys: ["cars", "coffee"],
      personalityKeys: ["has_everything"],
    });
    expect(hit?.id).toBe("dad_has_everything");
    const blob = hit!.ideas.map((i) => i.title.toLowerCase()).join(" ");
    expect(blob).not.toMatch(/\b(socks|mug|wallet)\b/);
    expect(hit!.ideas.some((i) => i.ranking_role === "experience" || i.category === "experience")).toBe(
      true,
    );
  });
});

describe("gift finder seo + i18n readiness", () => {
  it("exposes crawlable FAQ and taxonomy paths", () => {
    const seo = giftFinderSeo("en");
    expect(seo.title).toContain("Christmas Gift Finder");
    expect(seo.description.length).toBeGreaterThan(60);
    expect(GIFT_FINDER_FAQS.length).toBeGreaterThanOrEqual(8);
    expect(seoGiftPath("for-mom")).toBe("/christmas/gifts/for-mom");
    expect(SEO_TAXONOMY_LINKS.byRecipient.length).toBeGreaterThanOrEqual(8);
  });

  it("keeps copy keys free of English-only concatenation", () => {
    expect(gfT("results.title", "en", { recipient: "Mom" })).toBe("Best Matches for Mom");
    expect(PERSONALITY_KEYS.has("has_everything")).toBe(true);
    expect(primaryVibeFromPersonalities(["sentimental"])).toBe("sentimental");
  });
});
