import { describe, expect, it } from "vitest";
import { detectBrowserPetLocale, normalizePetUiLocale, petT } from "./index";
import { parsePetLocalePath, petPathForLocale, isPetAppPath } from "./localeRouting";
import { PET_COPY_EN } from "./copy/en";
import { PET_COPY_PACKS } from "./copy";

describe("pet i18n locales", () => {
  it("keeps English as the default normalize fallback", () => {
    expect(normalizePetUiLocale("xx")).toBe("en");
    expect(normalizePetUiLocale("RO")).toBe("ro");
    expect(normalizePetUiLocale("pt-PT")).toBe("pt");
    expect(normalizePetUiLocale("hu-HU")).toBe("hu");
  });

  it("detects browser languages in preference order", () => {
    expect(detectBrowserPetLocale(["ro-RO", "en-US"])).toBe("ro");
    expect(detectBrowserPetLocale(["de"])).toBe("de");
    expect(detectBrowserPetLocale(["it-IT"])).toBe("it");
    expect(detectBrowserPetLocale(["hu"])).toBe("hu");
    expect(detectBrowserPetLocale(["sv-SE"])).toBe("en");
  });

  it("parses prefixed pet paths without stealing christmas prefixes", () => {
    expect(parsePetLocalePath("/pet/dog-v2")).toEqual({
      locale: "en",
      basePath: "/pet/dog-v2",
      publicPath: "/pet/dog-v2",
      isPrefixed: false,
    });
    expect(parsePetLocalePath("/ro/pet/cat-v2").locale).toBe("ro");
    expect(parsePetLocalePath("/ro/pet/cat-v2").basePath).toBe("/pet/cat-v2");
    expect(parsePetLocalePath("/hu/pet/dog").locale).toBe("hu");
    expect(parsePetLocalePath("/ro/christmas").isPrefixed).toBe(false);
    expect(isPetAppPath("/de/pet/other-v2")).toBe(true);
    expect(isPetAppPath("/de/christmas")).toBe(false);
  });

  it("builds locale paths with English unprefixed (primary)", () => {
    expect(petPathForLocale("/pet/dog-v2", "en")).toBe("/pet/dog-v2");
    expect(petPathForLocale("/pet/dog-v2", "ro")).toBe("/ro/pet/dog-v2");
    expect(petPathForLocale("/ro/pet/dog-v2", "it")).toBe("/it/pet/dog-v2");
    expect(petPathForLocale("/ro/pet/dog-v2", "en")).toBe("/pet/dog-v2");
  });

  it("has matching keys across all locale packs", () => {
    const keys = Object.keys(PET_COPY_EN).sort();
    for (const [locale, pack] of Object.entries(PET_COPY_PACKS)) {
      expect(Object.keys(pack).sort(), locale).toEqual(keys);
    }
  });

  it("returns Romanian copy for core v2 funnel strings", () => {
    expect(petT("v2.landing.eyebrow", "ro")).toMatch(/gratuit/i);
    expect(petT("species.dog", "ro")).toBe("Câine");
    expect(petT("species.cat", "ro")).toBe("Pisică");
    expect(petT("v2.teaser.h1.dog", "ro")).toMatch(/câinelui/i);
    expect(petT("v2.landing.cta", "de")).toBeTruthy();
    expect(petT("v2.landing.cta", "it")).toBeTruthy();
    expect(petT("v2.landing.cta", "hu")).toBeTruthy();
  });

  it("interpolates variables and falls back to English", () => {
    expect(petT("v2.landing.bullet.price", "en", { price: "$2.99" })).toContain("$2.99");
    expect(petT("missing.key.xyz", "ro")).toBe("missing.key.xyz");
  });
});
