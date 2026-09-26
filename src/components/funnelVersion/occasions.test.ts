import { describe, expect, it } from "vitest";
import {
  FUNNEL_OCCASIONS,
  funnelUploadSlugForKey,
  isFunnelOccasionKey,
  toFunnelOccasionKey,
  toFunnelUploadSlug,
} from "./occasions";

describe("funnel occasions", () => {
  it("maps thank-you to its own funnel key (not christmas)", () => {
    expect(toFunnelOccasionKey("thank-you")).toBe("thank-you");
    expect(toFunnelOccasionKey("thank_you")).toBe("thank-you");
    expect(toFunnelOccasionKey("thank-you")).not.toBe("christmas");
  });

  it("exposes thank-you specific hero copy and non-christmas hero assets", () => {
    const cfg = FUNNEL_OCCASIONS["thank-you"];
    expect(cfg.heroTitle.toLowerCase()).toContain("thank");
    expect(cfg.heroBeforeVariant).not.toContain("christmas");
    expect(cfg.heroAfterVariant).not.toContain("christmas");
  });

  it("returns null for unknown funnel slugs instead of defaulting to christmas", () => {
    expect(toFunnelOccasionKey("not-a-real-occasion")).toBeNull();
    expect(isFunnelOccasionKey("sorry")).toBe(false);
  });

  it("maps upload slugs for extended homepage categories", () => {
    expect(funnelUploadSlugForKey("thank-you")).toBe("thank_you");
    expect(toFunnelUploadSlug("name-cards")).toBe("name_cards");
    expect(toFunnelUploadSlug("bible-verses")).toBe("bible_verses");
  });

  it("keeps every funnel occasion key in FUNNEL_OCCASIONS", () => {
    for (const key of Object.values(FUNNEL_OCCASIONS).map((c) => c.key)) {
      expect(FUNNEL_OCCASIONS[key]).toBeDefined();
      expect(toFunnelOccasionKey(key)).toBe(key);
    }
  });
});
