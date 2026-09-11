import { describe, expect, it } from "vitest";
import {
  generationLanguageName,
  normalizeWave1GenerationLocale,
  WAVE1_GENERATION_LOCALES,
} from "@/features/christmas/i18n/wave1Locale";
import {
  CHRISTMAS_PRODUCT_LANGUAGE_READY,
  isChristmasProductReadyForLocale,
} from "../../../../server/christmasProductReadiness.mjs";
import { isChristmasLocaleSeoIndexable } from "../../../../server/christmasLocale.mjs";
import { buildChristmasHreflangAlternates } from "../../../../server/christmasI18n.mjs";
import { christmasSitemapPaths } from "../../../../server/christmasIndexing.mjs";
import { PACKS, gfT, type GiftFinderLocale } from "../giftFinder/copy";
import { labelFor, RECIPIENTS } from "../wishlist/taxonomy";
import { switchableChristmasLocales } from "./localeRouting";

describe("christmas P3C product-language enablement", () => {
  it("normalizes Wave 1 locales including pt-PT → pt", () => {
    expect(normalizeWave1GenerationLocale("de")).toBe("de");
    expect(normalizeWave1GenerationLocale("pt-PT")).toBe("pt");
    expect(normalizeWave1GenerationLocale("pt-BR")).toBe("pt");
    expect(normalizeWave1GenerationLocale("xx")).toBe("en");
    expect(generationLanguageName("pt")).toMatch(/European Portuguese/);
  });

  it("Gift Finder UI packs cover all Wave 1 locales", () => {
    for (const locale of WAVE1_GENERATION_LOCALES) {
      expect(PACKS[locale as GiftFinderLocale]).toBeTruthy();
      expect(gfT("hero.h1", locale as GiftFinderLocale)).toBeTruthy();
      expect(gfT("error.generic", locale as GiftFinderLocale)).not.toBe("error.generic");
    }
    expect(gfT("hero.h1", "de")).not.toBe(gfT("hero.h1", "en"));
    expect(gfT("nav.continue", "pl")).toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]|Dalej|Kontynuuj/i);
  });

  it("Gift Finder taxonomy chips localize for Wave 1", () => {
    expect(labelFor(RECIPIENTS, "mom", "de")).not.toBe("Mom");
    expect(labelFor(RECIPIENTS, "mom", "fr")).toMatch(/Maman|Mère/i);
    expect(labelFor(RECIPIENTS, "mom", "pt")).toBeTruthy();
  });

  it("marks Gift Finder + Messages ready for Wave 1; Santa gated except en/ro", () => {
    for (const locale of WAVE1_GENERATION_LOCALES) {
      expect(CHRISTMAS_PRODUCT_LANGUAGE_READY.gift_finder_recommendations[locale]).toBe("ready");
      expect(CHRISTMAS_PRODUCT_LANGUAGE_READY.messages_generator[locale]).toBe("ready");
      expect(CHRISTMAS_PRODUCT_LANGUAGE_READY.cards_message_assistant[locale]).toBe("ready");
      expect(isChristmasProductReadyForLocale(locale, "/christmas/gift-finder")).toBe(true);
      expect(isChristmasProductReadyForLocale(locale, "/christmas/messages")).toBe(true);
    }
    expect(isChristmasProductReadyForLocale("de", "/christmas/santa-video")).toBe(false);
    expect(isChristmasProductReadyForLocale("ro", "/christmas/santa-video")).toBe(true);
  });

  it("SEO indexability follows product readiness for gated routes", () => {
    expect(isChristmasLocaleSeoIndexable("de", "/christmas/gift-finder")).toBe(true);
    expect(isChristmasLocaleSeoIndexable("de", "/christmas/messages")).toBe(true);
    expect(isChristmasLocaleSeoIndexable("de", "/christmas/santa-video")).toBe(false);
    expect(isChristmasLocaleSeoIndexable("fr", "/christmas/messages")).toBe(true);
    expect(isChristmasLocaleSeoIndexable("pl", "/christmas/santa-video")).toBe(false);
  });

  it("hreflang/sitemap include Wave 1 messages but exclude unverified Santa locales", () => {
    const msgAlts = buildChristmasHreflangAlternates("/christmas/messages");
    const langs = msgAlts.map((a) => a.hreflang);
    expect(langs).toContain("de");
    expect(langs).toContain("pt-PT");
    expect(langs).toContain("x-default");

    const santaAlts = buildChristmasHreflangAlternates("/christmas/santa-video");
    const santaLangs = santaAlts.map((a) => a.hreflang);
    expect(santaLangs).toContain("en");
    expect(santaLangs).toContain("ro");
    expect(santaLangs).not.toContain("de");

    const paths = christmasSitemapPaths();
    expect(paths).toContain("/de/christmas/messages");
    expect(paths).toContain("/de/christmas/gift-finder");
    expect(paths).not.toContain("/de/christmas/santa-video");
  });

  it("language switcher exposes Wave 1 for Gift Finder and Messages; Santa stays en/ro", () => {
    expect(switchableChristmasLocales("/christmas/gift-finder").map((l) => l.code)).toContain("de");
    expect(switchableChristmasLocales("/christmas/messages").map((l) => l.code)).toContain("pl");
    expect(switchableChristmasLocales("/christmas/santa-video").map((l) => l.code)).toEqual([
      "en",
      "ro",
    ]);
  });
});
