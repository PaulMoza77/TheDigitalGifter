import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  GIFT_BROWSE_CATEGORIES_CTA,
  GIFT_BROWSE_CATEGORIES_HREF,
  GIFT_BROWSE_CLEAR_FILTERS_CTA,
  GIFT_BROWSE_EMPTY_TITLE,
  giftBrowseEmptyStateCopy,
} from "@/components/giftBrowseEmptyState";

function readSrc(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("gift browse empty-state copy", () => {
  it("gives a clear title and category CTA when a category has no gifts", () => {
    const copy = giftBrowseEmptyStateCopy({ label: "Pets" });

    expect(copy.title).toBe(GIFT_BROWSE_EMPTY_TITLE);
    expect(copy.description).toContain("Pets");
    expect(copy.description.toLowerCase()).toContain("explore other categories");
    expect(copy.primaryCtaLabel).toBe(GIFT_BROWSE_CATEGORIES_CTA);
    expect(copy.primaryCtaHref).toBe(GIFT_BROWSE_CATEGORIES_HREF);
    expect(copy.secondaryCtaLabel).toBeNull();
  });

  it("adds a clear-filters secondary CTA when local filters caused the empty list", () => {
    const copy = giftBrowseEmptyStateCopy({
      label: "Birthday",
      hasActiveFilters: true,
    });

    expect(copy.title).toBe(GIFT_BROWSE_EMPTY_TITLE);
    expect(copy.description).toContain("Birthday");
    expect(copy.description.toLowerCase()).toContain("filters");
    expect(copy.primaryCtaLabel).toBe(GIFT_BROWSE_CATEGORIES_CTA);
    expect(copy.primaryCtaHref).toBe("/templates");
    expect(copy.secondaryCtaLabel).toBe(GIFT_BROWSE_CLEAR_FILTERS_CTA);
  });

  it("falls back to a safe label instead of a blank phrase", () => {
    const copy = giftBrowseEmptyStateCopy({ label: "   " });

    expect(copy.description).toContain("this selection");
    expect(copy.primaryCtaHref).toBe("/templates");
  });
});

describe("lint script", () => {
  it("does not shell out to a PATH tsc binary", () => {
    const packageJson = JSON.parse(readSrc("package.json"));
    const runner = readSrc("scripts/run-lint.mjs");

    expect(packageJson.scripts.lint).toBe("node scripts/run-lint.mjs");
    expect(packageJson.scripts.lint).not.toMatch(/(^|[\s;&|])tsc(\s|$)/);
    expect(runner).toContain("node_modules/typescript/bin/tsc");
    expect(runner).toContain("process.execPath");
  });
});

describe("gift browse empty-state wiring", () => {
  it("renders the shared empty state with a visible explore-categories CTA", () => {
    const browseGrid = readSrc("src/components/TemplatesGrid.tsx");
    const generatorGrid = readSrc("src/domains/generator/components/TemplatesGrid.tsx");
    const emptyUi = readSrc("src/components/GiftBrowseEmptyState.tsx");

    expect(browseGrid).toContain("GiftBrowseEmptyState");
    expect(generatorGrid).toContain("GiftBrowseEmptyState");
    expect(emptyUi).toContain("giftBrowseEmptyStateCopy");
    expect(emptyUi).toContain("to={copy.primaryCtaHref}");
    expect(emptyUi).toContain("{copy.primaryCtaLabel}");
    expect(emptyUi).not.toMatch(/console\.(log|error|warn)/);
    expect(browseGrid).not.toMatch(/console\.(log|error|warn)/);
    expect(generatorGrid).not.toMatch(/console\.(log|error|warn)/);
  });
});
