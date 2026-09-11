import { describe, expect, it } from "vitest";
import {
  normalizeWave1GenerationLocale,
  preferredSantaTtsProvider,
  SANTA_PREFERRED_TTS,
  WAVE1_GENERATION_LOCALES,
} from "@/features/christmas/i18n/wave1Locale";
import {
  CHRISTMAS_PRODUCT_LANGUAGE_READY,
  isChristmasProductReadyForLocale,
} from "../../../../server/christmasProductReadiness.mjs";
import { isChristmasLocaleSeoIndexable } from "../../../../server/christmasLocale.mjs";
import { applyChristmasSeo } from "../../../../server/christmasSeo.mjs";
import { buildChristmasHreflangAlternates } from "../../../../server/christmasI18n.mjs";
import { christmasSitemapPaths } from "../../../../server/christmasIndexing.mjs";
import { switchableChristmasLocales } from "./localeRouting";
import p3eQa from "../../../../server/i18n/christmasP3eSantaAudioQa.json";

const WAVE1_SANTA = ["en", "ro", "de", "fr", "es", "it", "pt", "nl", "pl"] as const;
const NEW_PASS = ["de", "fr", "es", "it", "pt", "nl", "pl"] as const;

const template = () =>
  `<!doctype html><html><head><title>t</title></head><body></body></html>`;

describe("christmas P3E Santa live TTS QA + indexability", () => {
  it("maps locale → preferred TTS provider (pt preserved as European Portuguese)", () => {
    expect(normalizeWave1GenerationLocale("pt-PT")).toBe("pt");
    expect(preferredSantaTtsProvider("en")).toBe("openai");
    expect(preferredSantaTtsProvider("pt")).toBe("replicate");
    for (const locale of NEW_PASS) {
      expect(SANTA_PREFERRED_TTS[locale]).toBe("replicate");
    }
    expect(WAVE1_GENERATION_LOCALES).toContain("pt");
  });

  it("marks all Wave 1 Santa locales product-ready after P3E QA", () => {
    for (const locale of WAVE1_SANTA) {
      expect(CHRISTMAS_PRODUCT_LANGUAGE_READY.santa_script_tts[locale]).toBe("ready");
      expect(isChristmasProductReadyForLocale(locale, "/christmas/santa-video")).toBe(true);
      expect(isChristmasLocaleSeoIndexable(locale, "/christmas/santa-video")).toBe(true);
    }
  });

  it("SSR newly ready Santa locales are index,follow with reciprocal hreflang", () => {
    for (const locale of NEW_PASS) {
      const path = `/${locale}/christmas/santa-video`;
      const html = applyChristmasSeo(template(), path);
      expect(html).toMatch(/name="robots"[^>]*content="index,follow"/);
      expect(html).toContain('hreflang="en"');
      expect(html).toContain(`hreflang="${locale === "pt" ? "pt-PT" : locale}"`);
      expect(html).toContain('hreflang="x-default"');
      for (const other of WAVE1_SANTA) {
        const hl = other === "pt" ? "pt-PT" : other;
        expect(html).toContain(`hreflang="${hl}"`);
      }
    }
  });

  it("hreflang cluster for Santa includes all Wave 1 + x-default", () => {
    const alts = buildChristmasHreflangAlternates("/christmas/santa-video");
    const langs = alts.map((a) => a.hreflang);
    expect(langs).toContain("en");
    expect(langs).toContain("ro");
    expect(langs).toContain("de");
    expect(langs).toContain("fr");
    expect(langs).toContain("es");
    expect(langs).toContain("it");
    expect(langs).toContain("pt-PT");
    expect(langs).toContain("nl");
    expect(langs).toContain("pl");
    expect(langs).toContain("x-default");
    expect(alts.length).toBe(WAVE1_SANTA.length + 1);
  });

  it("sitemap includes all Wave 1 Santa routes", () => {
    const paths = christmasSitemapPaths();
    expect(paths).toContain("/christmas/santa-video");
    expect(paths).toContain("/ro/christmas/santa-video");
    for (const locale of NEW_PASS) {
      expect(paths).toContain(`/${locale}/christmas/santa-video`);
    }
  });

  it("language switcher exposes all Wave 1 Santa locales", () => {
    const codes = switchableChristmasLocales("/christmas/santa-video").map((l) => l.code);
    expect(codes).toEqual([...WAVE1_SANTA]);
  });

  it("records P3E QA privacy + cost metadata without inventing USD", () => {
    expect(p3eQa.fictionalTestDataOnly).toBe(true);
    expect(p3eQa.piiLogged).toBe(false);
    expect(p3eQa.cost.openai_tts_calls).toBe(0);
    expect(p3eQa.cost.minimax_calls).toBe(14);
    expect(p3eQa.cost.full_video_calls).toBe(0);
    expect(p3eQa.cost.estimated_total_usd).toBeNull();
    expect(p3eQa.fullVideoSmoke.performed).toBe(false);
    for (const locale of ["de", "fr", "es", "it", "pt-PT", "nl", "pl"] as const) {
      expect(p3eQa.productReadyAfterQa[locale]).toBe("YES");
      expect(p3eQa.standardSamples[locale].technical).toBe("TECHNICAL_PASS");
      expect(p3eQa.standardSamples[locale].language).toBe("LANGUAGE_VALIDATED");
    }
  });
});
