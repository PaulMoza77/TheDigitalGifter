import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  GIFT_BROWSE_CLEAR_FILTERS_CTA,
  GIFT_BROWSE_EMPTY_CTA_HREF,
  GIFT_BROWSE_EMPTY_CTA_LABEL,
  GIFT_BROWSE_EMPTY_TITLE,
  formatGiftBrowseCategoryLabel,
  giftBrowseEmptyStateCopy,
} from "./giftBrowseEmptyState";

function readSrc(relative: string) {
  return readFileSync(resolve(process.cwd(), relative), "utf8");
}

describe("gift browse empty-state copy", () => {
  it("gives a clear title, next-step guidance, and explore-categories CTA", () => {
    const copy = giftBrowseEmptyStateCopy();

    expect(copy.title).toBe(GIFT_BROWSE_EMPTY_TITLE);
    expect(copy.description).toMatch(/Explore categories/i);
    expect(copy.description).toMatch(/keep going/i);
    expect(copy.primaryCtaLabel).toBe("Explore categories");
    expect(copy.primaryCtaTo).toBe("/categories/occasions");
    expect(copy.secondaryCtaLabel).toBeNull();
    expect(GIFT_BROWSE_EMPTY_CTA_LABEL).toBe("Explore categories");
    expect(GIFT_BROWSE_EMPTY_CTA_HREF).toBe("/categories/occasions");
  });

  it("names the occasion or category and points to a next step", () => {
    expect(formatGiftBrowseCategoryLabel("pets")).toBe("Pets");
    expect(formatGiftBrowseCategoryLabel("all")).toBeNull();

    const occasion = giftBrowseEmptyStateCopy({
      subjectLabel: "Birthday",
      hasActiveFilters: true,
    });
    expect(occasion.title).toBe("No matching gifts for Birthday");
    expect(occasion.description).toMatch(/Birthday/);
    expect(occasion.description).toMatch(/clear filters/i);
    expect(occasion.primaryCtaLabel).toBe("Explore categories");
    expect(occasion.secondaryCtaLabel).toBe(GIFT_BROWSE_CLEAR_FILTERS_CTA);
  });

  it("falls back to a safe phrase instead of a blank label", () => {
    const copy = giftBrowseEmptyStateCopy({ subjectLabel: "   " });

    expect(copy.title).toBe("No matching gifts");
    expect(copy.description).toContain("this browse");
    expect(copy.primaryCtaTo).toBe("/categories/occasions");
  });
});

describe("gift browse empty-state wiring", () => {
  it("renders the empty state with a visible primary CTA on browse and generator lists", () => {
    const browse = readSrc("src/components/TemplatesGrid.tsx");
    const generator = readSrc("src/domains/generator/components/TemplatesGrid.tsx");
    const emptyUi = readSrc("src/components/GiftBrowseEmptyState.tsx");
    const app = readSrc("src/App.tsx");

    expect(browse).toContain("GiftBrowseEmptyState");
    expect(browse).toContain("giftBrowseEmptyStateCopy");
    expect(generator).toContain("GiftBrowseEmptyState");
    expect(emptyUi).toContain('data-testid="gift-browse-empty-state"');
    expect(emptyUi).toContain("GIFT_BROWSE_EMPTY_CTA_LABEL");
    expect(emptyUi).toContain("GIFT_BROWSE_EMPTY_CTA_HREF");
    expect(emptyUi).toContain('role="status"');
    expect(emptyUi).not.toContain("console.");
    expect(browse).not.toContain("No Templates Found");
    expect(generator).not.toContain("No templates found");
    expect(app).toContain(
      'import("@/features/christmas/ChristmasPortraitFunnelPage")'
    );
  });
});
