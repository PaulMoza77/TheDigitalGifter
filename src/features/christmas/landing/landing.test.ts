import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHRISTMAS_FUNNEL_ALLOWED_EVENTS } from "../funnelEventContract";
import {
  CHRISTMAS_LANDING_LOCALES,
  LANDING_COPY_KEYS,
  landingHasSpokenSanta,
  landingT,
  PACKS,
  resolveChristmasLandingLocale,
} from "./copy";
import {
  CARD_THEME_TO_STYLE,
  cardsUrl,
  giftFinderUrl,
  isLikelyKidName,
  messagesUrl,
  parseCardTheme,
  parseGiftRecipient,
  portraitUrl,
  sanitizeKidName,
  santaExperienceUrl,
} from "./handoff";
import { christmasLandingSeo, LANDING_FAQS } from "./seo";
import {
  CHRISTMAS_COUNTDOWN_YEAR,
  padCountdownValue,
  remainingUntilChristmas,
} from "./countdown";

function readSrc(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("christmas landing copy + seo", () => {
  it("resolves required English keys", () => {
    expect(landingT("hero.h1")).toMatch(/remember/i);
    expect(landingT("hero.countdown.eyebrow")).toMatch(/coming/i);
    expect(landingT("santa.bubble")).toMatch(/Ho ho ho/i);
    expect(landingT("gifts.cta")).toBe("Find the Perfect Gift");
    expect(landingT("gifts.h2")).toMatch(/tree/i);
    expect(landingT("finder.h2")).toMatch(/Perfect Christmas Gift/i);
    expect(landingT("geo.h2")).toMatch(/What can you create/i);
    expect(LANDING_COPY_KEYS).toContain("seo.title");
    expect(LANDING_COPY_KEYS).toContain("nav.finder");
    expect(LANDING_COPY_KEYS).toContain("finder.cta");
    expect(LANDING_FAQS).toHaveLength(5);
  });

  it("ships Wave 1 UI packs with CTA coverage and soft Santa for non-en/ro", () => {
    expect([...CHRISTMAS_LANDING_LOCALES]).toEqual([
      "en",
      "ro",
      "de",
      "fr",
      "es",
      "it",
      "pt",
      "nl",
      "pl",
    ]);
    expect(resolveChristmasLandingLocale("pt-PT")).toBe("pt");
    expect(landingHasSpokenSanta("en")).toBe(true);
    expect(landingHasSpokenSanta("ro")).toBe(true);
    expect(landingHasSpokenSanta("de")).toBe(false);

    const ctaKeys = [
      "hero.cta",
      "finder.cta",
      "portraits.cta",
      "santa.cta",
      "wishlist.cta",
      "tree.cta",
      "advent.cta",
      "cards.cta",
      "messages.cta",
      "finale.cta",
      "hero.countdown.days",
      "hero.countdown.hours",
      "hero.countdown.minutes",
      "hero.countdown.seconds",
    ];

    for (const locale of CHRISTMAS_LANDING_LOCALES) {
      expect(PACKS[locale]).toBeTruthy();
      for (const key of ctaKeys) {
        expect(landingT(key, locale).length).toBeGreaterThan(1);
        expect(landingT(key, locale)).not.toBe(key);
      }
    }

    expect(landingT("hero.h1", "de")).not.toBe(landingT("hero.h1", "en"));
    expect(landingT("finder.cta", "fr")).not.toBe(landingT("finder.cta", "en"));
    expect(landingT("santa.cta", "en")).toMatch(/personalized Santa video/i);
    expect(landingT("santa.cta", "ro")).toMatch(/video|Moș/i);
    for (const locale of ["de", "fr", "es", "it", "pt", "nl", "pl"] as const) {
      const cta = landingT("santa.cta", locale);
      const lede = landingT("santa.lede", locale);
      expect(cta.toLowerCase()).not.toMatch(/personalized santa video|vídeo personalizado de santa que dice/i);
      expect(cta).not.toMatch(/Create a personalized/i);
      expect(lede.toLowerCase()).not.toMatch(/says their name|diga o nome|sage ihren namen im video/i);
      expect(landingT("faq.2.a", locale)).not.toMatch(/^Yes\./);
    }
  });

  it("has unique title and description for GEO/SEO", () => {
    const seo = christmasLandingSeo("en");
    expect(seo.title).toContain("Christmas");
    expect(seo.description.length).toBeGreaterThan(80);
    expect(seo.url).toContain("/christmas");
    expect(christmasLandingSeo("de").url).toContain("/de/christmas");
  });
});

describe("christmas landing handoff", () => {
  it("builds santa URL without leaking the child's name", () => {
    expect(santaExperienceUrl("Emma")).toBe("/christmas/santa-video");
    expect(isLikelyKidName("Emma")).toBe(true);
    expect(isLikelyKidName("José")).toBe(true);
    expect(isLikelyKidName("Łukasz")).toBe(true);
    expect(isLikelyKidName("محمد")).toBe(true);
    expect(isLikelyKidName("")).toBe(false);
    expect(isLikelyKidName("Emma<script>")).toBe(false);
    expect(sanitizeKidName("  Emma  ")).toBe("Emma");
  });

  it("maps scenes onto real product routes", () => {
    expect(giftFinderUrl("mom")).toBe("/christmas/gift-finder?recipient=mom");
    expect(parseGiftRecipient("kids")).toBe("child");
    expect(portraitUrl("family")).toBe("/christmas/family");
    expect(portraitUrl("pets")).toBe("/christmas/pets");
    expect(cardsUrl("elegant")).toBe("/christmas/cards?theme=elegant");
    expect(CARD_THEME_TO_STYLE.funny).toBe("playful_christmas");
    expect(parseCardTheme("romantic")).toBe("romantic");
    expect(messagesUrl("dad", "warm")).toBe("/christmas/messages?for=dad&tone=warm");
  });
});

describe("christmas landing wiring", () => {
  it("keeps hub analytics events on the allowlist", () => {
    expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain("christmas_page_view");
    expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain("christmas_hub_cta");
    expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain("christmas_hub_interact");
    expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain("santa_form_started");
    expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain("santa_form_completed");
  });

  it("is a storytelling landing, not a catalog card grid", () => {
    const page = readSrc("src/pages/website/ChristmasPage.tsx");
    const experience = readSrc("src/features/christmas/landing/ChristmasLandingExperience.tsx");
    expect(page).not.toContain("Christmas product suite");
    expect(page).not.toContain("hubProducts");
    expect(experience).toContain("SantaScene");
    expect(experience).toContain("GiftTreeLandingScene");
    expect(experience).toContain("GiftFinderScene");
    expect(experience).toContain("GeoScene");
    expect(experience).toContain("StoryErrorBoundary");
    expect(experience).toContain("giftFinderUrl");
    expect(experience).toContain("parseChristmasLocalePath");
    expect(experience).toContain("resolveChristmasLandingLocale");
    expect(experience).toContain("christmasPathForLocale");
    expect(experience).not.toContain("WorldTransition");
    expect(experience).not.toContain('const LOCALE = CHRISTMAS_LANDING_DEFAULT_LOCALE');
    expect(readSrc("src/features/christmas/landing/assets.ts")).toContain("santa-alpha.webm");
    expect(readSrc("src/features/christmas/landing/assets.ts")).toContain("santa-static.png");
    expect(readSrc("src/features/christmas/landing/assets.ts")).toContain("cabin-hero-loop.mp4");
    expect(readSrc("src/features/christmas/landing/assets.ts")).toContain("advent-loop.mp4");
    expect(readSrc("src/features/christmas/landing/assets.ts")).toContain("cover-elegant.webp");
    expect(readSrc("src/features/christmas/landing/assets.ts")).toContain("message-letter.webp");
    expect(readSrc("src/features/christmas/landing/assets.ts")).toContain("finder-still.webp");
    expect(readSrc("src/features/christmas/landing/scenes/AdventScene.tsx")).toContain("adventLoop");
    expect(readSrc("src/features/christmas/landing/scenes/CardsScene.tsx")).toContain("xmas-card-desk");
    expect(readSrc("src/features/christmas/landing/scenes/MessagesScene.tsx")).toContain("xmas-message-letter");
    expect(readSrc("src/features/christmas/landing/scenes/GiftFinderScene.tsx")).toContain("xmas-finder-stage");
    expect(readSrc("src/features/christmas/landing/scenes/GiftFinderScene.tsx")).not.toContain("xmas-gifts__tree");
    expect(experience).toContain("/generator?occasion=christmas");
    expect(readSrc("src/features/christmas/landing/scenes/SantaScene.tsx")).toContain(
      "santa.h2Personalized",
    );
    expect(readSrc("src/features/christmas/ChristmasSantaVideoPage.tsx")).toContain("consumeSantaNameHandoff");
    expect(readSrc("src/features/christmas/ChristmasGiftFinderPage.tsx")).toContain("parseGiftRecipient");
    expect(readSrc("src/App.tsx")).toContain("/christmas/tree-gifts");
    expect(readSrc("src/features/christmas/gifts/ChristmasGiftsPage.tsx")).toContain("ChristmasGiftsExperience");
  });

  it("keeps an alive cabin hero with editorial countdown wiring", () => {
    const hero = readSrc("src/features/christmas/landing/scenes/ImmersiveHero.tsx");
    expect(hero).toContain("CabinHeroScene");
    expect(hero).toContain("HeroCountdown");
    expect(hero).toContain('t("hero.h1")');
    expect(readSrc("src/features/christmas/landing/CabinHeroScene.tsx")).toContain("cabinLoop");
    expect(readSrc("src/features/christmas/landing/assets.ts")).toContain("cabin-hero-1920.webp");
    expect(readSrc("src/features/christmas/landing/HeroCountdown.tsx")).not.toContain("cc-unit");
  });

  it("origin injects /christmas meta for crawlers", () => {
    const origin = readSrc("server/origin.mjs");
    const seo = readSrc("server/christmasSeo.mjs");
    expect(origin).toContain("applyRouteMeta");
    expect(origin).toContain("applyChristmasSeo");
    expect(seo).toContain("Christmas at TheDigitalGifter");
    expect(seo).toContain("Christmas Gift Finder");
    expect(seo).toContain("Family Christmas Photo Generator");
    expect(seo).toContain("id=\"tdg-christmas-seo\"");
    expect(origin).toContain('".webm": "video/webm"');
    expect(origin).toContain('".mp4": "video/mp4"');
  });
});

describe("christmas landing countdown", () => {
  it("computes remaining parts from a live now", () => {
    const now = new Date(CHRISTMAS_COUNTDOWN_YEAR, 11, 1, 1, 2, 3, 0);
    const remaining = remainingUntilChristmas(now);
    expect(remaining.expired).toBe(false);
    expect(remaining.days).toBe(23);
    expect(remaining.hours).toBe(22);
    expect(remaining.minutes).toBe(57);
    expect(remaining.seconds).toBe(57);
  });

  it("transitions to Christmas state instead of negative numbers", () => {
    const christmas = new Date(CHRISTMAS_COUNTDOWN_YEAR, 11, 25, 0, 0, 0, 0);
    expect(remainingUntilChristmas(christmas).expired).toBe(true);
    expect(remainingUntilChristmas(new Date(christmas.getTime() - 1000)).seconds).toBe(1);
  });

  it("pads compact countdown units", () => {
    expect(padCountdownValue(4)).toBe("04");
    expect(padCountdownValue(24)).toBe("24");
    expect(padCountdownValue(108)).toBe("108");
  });
});
