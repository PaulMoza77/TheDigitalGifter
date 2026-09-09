import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHRISTMAS_FUNNEL_ALLOWED_EVENTS } from "../funnelEventContract";
import { LANDING_COPY_KEYS, landingT } from "./copy";
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
    expect(LANDING_COPY_KEYS).toContain("seo.title");
    expect(LANDING_FAQS).toHaveLength(5);
  });

  it("has unique title and description for GEO/SEO", () => {
    const seo = christmasLandingSeo("en");
    expect(seo.title).toContain("Christmas");
    expect(seo.description.length).toBeGreaterThan(80);
    expect(seo.url).toContain("/christmas");
  });
});

describe("christmas landing handoff", () => {
  it("builds santa URL with preserved name", () => {
    expect(santaExperienceUrl("Emma")).toBe("/christmas/santa-video?name=Emma");
    expect(isLikelyKidName("Emma")).toBe(true);
    expect(isLikelyKidName("")).toBe(false);
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
    expect(readSrc("src/features/christmas/landing/assets.ts")).toContain("santa-alpha.webm");
    expect(experience).toContain("/generator?occasion=christmas");
    expect(readSrc("src/features/christmas/ChristmasSantaVideoPage.tsx")).toContain("consumeSantaNameHandoff");
    expect(readSrc("src/features/christmas/ChristmasGiftFinderPage.tsx")).toContain("parseGiftRecipient");
  });

  it("keeps an alive cabin hero with editorial countdown wiring", () => {
    const hero = readSrc("src/features/christmas/landing/scenes/ImmersiveHero.tsx");
    expect(hero).toContain("CabinHeroScene");
    expect(hero).toContain("HeroCountdown");
    expect(hero).toContain('t("hero.h1")');
    expect(readSrc("src/features/christmas/landing/CabinHeroScene.tsx")).toContain("cabinLoop");
    expect(readSrc("src/features/christmas/landing/assets.ts")).toContain("cabin-hero-loop.mp4");
    expect(readSrc("src/features/christmas/landing/assets.ts")).toContain("cabin-hero-1920.webp");
    expect(readSrc("src/features/christmas/landing/HeroCountdown.tsx")).not.toContain("cc-unit");
  });

  it("origin injects /christmas meta for crawlers", () => {
    const origin = readSrc("server/origin.mjs");
    expect(origin).toContain("applyRouteMeta");
    expect(origin).toContain("Christmas Gifts, Portraits & Santa Messages");
    expect(origin).toContain('".webm": "video/webm"');
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
