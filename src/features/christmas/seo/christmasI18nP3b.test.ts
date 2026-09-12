import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyChristmasSeo } from "../../../../server/christmasSeo.mjs";
import {
  buildChristmasHreflangAlternates,
  christmasPathForLocale,
} from "../../../../server/christmasI18n.mjs";
import {
  isChristmasLocaleSeoIndexable,
  listEnabledChristmasLocales,
} from "../../../../server/christmasLocale.mjs";
import { christmasSitemapPaths } from "../../../../server/christmasIndexing.mjs";
import { getChristmasLocalizedSeoContent } from "../../../../server/i18n/seo/index.mjs";
import {
  CHRISTMAS_PRODUCT_LANGUAGE_READY,
  isChristmasProductReadyForLocale,
} from "../../../../server/christmasProductReadiness.mjs";
import {
  christmasPathForLocale as clientPath,
  switchableChristmasLocales,
} from "./localeRouting";

const template = () => readFileSync(join(process.cwd(), "index.html"), "utf8");

const WAVE1 = ["ro", "de", "fr", "es", "it", "pt", "nl", "pl"] as const;
const ALL_ROUTES = [
  "/christmas",
  "/christmas/gift-finder",
  "/christmas/wishlist",
  "/christmas/photo-generator",
  "/christmas/family",
  "/christmas/couples",
  "/christmas/pets",
  "/christmas/dogs",
  "/christmas/cats",
  "/christmas/santa-video",
  "/christmas/tree",
  "/christmas/advent",
  "/christmas/cards",
  "/christmas/messages",
] as const;

const ENGLISH_MARKERS = [
  "What can you create with TheDigitalGifter for Christmas?",
  "What is a Christmas Gift Finder?",
  "What is an AI Christmas photo generator?",
  "What is a personalized Santa video?",
  "Frequently Asked Questions",
];

describe("christmas P3B Wave 1 localization", () => {
  it("enables all Wave 1 locales", () => {
    const enabled = listEnabledChristmasLocales().map((l) => l.code).sort();
    expect(enabled).toEqual(["de", "en", "es", "fr", "it", "nl", "pl", "pt", "ro"]);
  });

  it("uses pt-PT language tags for Portuguese", () => {
    const pt = listEnabledChristmasLocales().find((l) => l.code === "pt");
    expect(pt?.htmlLang).toBe("pt-PT");
    expect(pt?.hreflang).toBe("pt-PT");
    expect(pt?.variant).toBe("pt-PT");
  });

  it("has full SEO content packs for every Wave 1 locale × route", () => {
    for (const locale of WAVE1) {
      for (const route of ALL_ROUTES) {
        const page = getChristmasLocalizedSeoContent(locale, route);
        expect(page, `${locale} ${route}`).toBeTruthy();
        expect(page!.title).toBeTruthy();
        expect(page!.description).toBeTruthy();
        expect(page!.h1).toBeTruthy();
        expect(page!.geo?.h2).toBeTruthy();
        expect(page!.faqs?.length ?? 0).toBeGreaterThanOrEqual(5);
        expect(page!.title.toLowerCase()).not.toContain("thedigitalgifter — custom ai holiday");
      }
    }
  });

  it("keeps Messages ready in Wave 1; Santa product-ready for Wave 1 after P3E", () => {
    expect(isChristmasProductReadyForLocale("ro", "/christmas/santa-video")).toBe(true);
    expect(isChristmasProductReadyForLocale("de", "/christmas/santa-video")).toBe(true);
    expect(isChristmasLocaleSeoIndexable("de", "/christmas/santa-video")).toBe(true);
    expect(isChristmasLocaleSeoIndexable("fr", "/christmas/messages")).toBe(true);
    expect(isChristmasLocaleSeoIndexable("ro", "/christmas/messages")).toBe(true);
    expect(isChristmasLocaleSeoIndexable("de", "/christmas/cards")).toBe(true);
  });

  it("SSR DE cards is localized, self-canonical, reciprocal hreflang", () => {
    const html = applyChristmasSeo(template(), "/de/christmas/cards");
    expect(html).toMatch(/lang="de"/);
    expect(html).toContain('rel="canonical" href="https://www.thedigitalgifter.com/de/christmas/cards"');
    expect(html).toContain('hreflang="en"');
    expect(html).toContain('hreflang="de"');
    expect(html).toContain('hreflang="x-default"');
    expect(html).toMatch(/name="robots"[^>]*content="index,follow"/);
    for (const marker of ENGLISH_MARKERS) {
      expect(html).not.toContain(marker);
    }
  });

  it("SSR DE santa is localized, indexable, and included in reciprocal hreflang", () => {
    const html = applyChristmasSeo(template(), "/de/christmas/santa-video");
    expect(html).toMatch(/lang="de"/);
    expect(html).toMatch(/name="robots"[^>]*content="index,follow"/);
    expect(html).toContain('hreflang="de"');
    expect(html).toContain('hreflang="en"');
    expect(html).toContain('hreflang="ro"');
    const alts = buildChristmasHreflangAlternates("/christmas/santa-video");
    const langs = alts.map((a) => a.hreflang);
    expect(langs).toContain("en");
    expect(langs).toContain("ro");
    expect(langs).toContain("de");
  });

  it("SSR FR hub differs from English and includes localized internal links", () => {
    const html = applyChristmasSeo(template(), "/fr/christmas");
    expect(html).toMatch(/lang="fr"/);
    expect(html).toContain("/fr/christmas/cards");
    expect(html).toContain("/fr/christmas/gift-finder");
    expect(html).not.toContain("Create Something They’ll Remember This Christmas");
  });

  it("SSR PT uses pt-PT lang and Portugal terminology and is indexable after P3E", () => {
    const html = applyChristmasSeo(template(), "/pt/christmas/santa-video");
    expect(html).toMatch(/lang="pt-PT"/);
    expect(html).toMatch(/Pai Natal/);
    expect(html).toMatch(/name="robots"[^>]*content="index,follow"/);
  });

  it("SSR PL includes Polish diacritics and self-canonical", () => {
    const html = applyChristmasSeo(template(), "/pl/christmas/wishlist");
    expect(html).toMatch(/lang="pl"/);
    expect(html).toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/);
    expect(html).toContain('rel="canonical" href="https://www.thedigitalgifter.com/pl/christmas/wishlist"');
  });

  it("SSR RO messages is indexable with Romanian generation claims allowed", () => {
    const html = applyChristmasSeo(template(), "/ro/christmas/messages");
    expect(html).toMatch(/lang="ro"/);
    expect(html).toMatch(/name="robots"[^>]*content="index,follow"/);
    expect(html).toMatch(/[ăâîșțĂÂÎȘȚ]/);
  });

  it("sitemap includes indexable Wave 1 paths and excludes gated incomplete ones", () => {
    const paths = christmasSitemapPaths();
    expect(paths).toContain("/de/christmas/cards");
    expect(paths).toContain("/fr/christmas");
    expect(paths).toContain("/ro/christmas/messages");
    expect(paths).toContain("/ro/christmas/santa-video");
    expect(paths).toContain("/de/christmas/santa-video");
    expect(paths).toContain("/nl/christmas/messages");
    expect(paths).not.toContain("/en/christmas");
  });

  it("hreflang cluster for cards includes all Wave 1 locales + x-default", () => {
    const alts = buildChristmasHreflangAlternates("/christmas/cards");
    const by = Object.fromEntries(alts.map((a) => [a.hreflang, a.href]));
    expect(by.en).toContain("/christmas/cards");
    expect(by.de).toContain("/de/christmas/cards");
    expect(by["pt-PT"]).toContain("/pt/christmas/cards");
    expect(by["x-default"]).toBe(by.en);
    expect(alts.length).toBe(WAVE1.length + 2); // en + wave1 + x-default
  });

  it("language switcher preserves route and gates Santa locales", () => {
    expect(clientPath("/christmas/cards", "de")).toBe("/de/christmas/cards");
    expect(clientPath("/de/christmas/family", "pl")).toBe("/pl/christmas/family");
    const santaLocales = switchableChristmasLocales("/christmas/santa-video").map((l) => l.code);
    expect(santaLocales).toEqual(["en", "ro", "de", "fr", "es", "it", "pt", "nl", "pl"]);
    const cardsLocales = switchableChristmasLocales("/christmas/cards").map((l) => l.code);
    expect(cardsLocales).toContain("de");
    expect(cardsLocales).toContain("pl");
  });

  it("records product readiness matrix for Santa and Messages", () => {
    expect(CHRISTMAS_PRODUCT_LANGUAGE_READY.santa_script_tts.de).toBe("ready");
    expect(CHRISTMAS_PRODUCT_LANGUAGE_READY.messages_generator.ro).toBe("ready");
    expect(CHRISTMAS_PRODUCT_LANGUAGE_READY.cards_message_assistant.fr).toBe("ready");
  });

  it("path helpers stay deterministic across locales", () => {
    for (const locale of WAVE1) {
      expect(christmasPathForLocale("/christmas/dogs", locale)).toBe(`/${locale}/christmas/dogs`);
    }
  });
});
