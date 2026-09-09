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
import {
  CLASSIC_GENERATOR_HREF,
  GIFT_FINDER_PATH,
  HUB_OUTSIDE_SUITE,
  SHAREABLE_TREE_PATH,
  giftFinderCanonicalFromLegacy,
  hubSuiteByPriority,
  isPrematureCheckoutCta,
} from "./hubIa";
import { christmasLandingSeo, LANDING_FAQS, LANDING_INTERNAL_LINKS } from "./seo";

function readSrc(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("christmas landing copy + seo", () => {
  it("resolves required English keys", () => {
    expect(landingT("hero.h1")).toMatch(/remember/i);
    expect(landingT("santa.bubble")).toMatch(/Ho ho ho/i);
    expect(landingT("gifts.cta")).toBe("Find the Perfect Gift");
    expect(LANDING_COPY_KEYS).toContain("seo.title");
    expect(LANDING_FAQS).toHaveLength(6);
    expect(landingT("gifts.note")).toMatch(/not Send a Gift/i);
    expect(landingT("tree.note")).toMatch(/Not Gift Finder/i);
    expect(landingT("faq.6.a")).toMatch(/Send a Gift is a separate prepaid send/i);
    expect(landingT("nav.gifts")).toBe("Gift Finder");
    expect(landingT("nav.tree")).toBe("Christmas Tree");
    expect(landingT("tree.cta")).toBe("Decorate a Christmas Tree");
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
    expect(giftFinderUrl()).toBe("/christmas/gift-finder");
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
    expect(experience).toContain("CLASSIC_GENERATOR_HREF");
    expect(experience).toContain("HubPriorityNav");
    expect(readSrc("src/features/christmas/landing/hubIa.ts")).toContain(CLASSIC_GENERATOR_HREF);
    expect(readSrc("src/features/christmas/ChristmasSantaVideoPage.tsx")).toContain("consumeSantaNameHandoff");
    expect(readSrc("src/features/christmas/ChristmasGiftFinderPage.tsx")).toContain("parseGiftRecipient");
  });

  it("keeps Send a Gift, Gift Tree, and the suite distinct", () => {
    const suite = hubSuiteByPriority();
    expect(suite[0]?.key).toBe("portraits");
    expect(suite.map((item) => item.path)).toContain(GIFT_FINDER_PATH);
    expect(suite.map((item) => item.path)).toContain(SHAREABLE_TREE_PATH);
    expect(suite.map((item) => item.path)).not.toContain(HUB_OUTSIDE_SUITE.sendAGift.path);
    expect(suite.map((item) => item.path)).not.toContain(HUB_OUTSIDE_SUITE.giftTreeChance.path);
    expect(giftFinderCanonicalFromLegacy("?recipient=mom")).toBe(
      "/christmas/gift-finder?recipient=mom",
    );
    expect(LANDING_INTERNAL_LINKS.some((link) => link.href === "/christmas/gifts")).toBe(false);
    expect(LANDING_INTERNAL_LINKS.some((link) => link.href === "/send-a-gift")).toBe(false);
    for (const item of suite) {
      expect(isPrematureCheckoutCta(landingT(item.ctaKey))).toBe(false);
    }
    expect(isPrematureCheckoutCta(landingT("hero.cta"))).toBe(false);
    expect(isPrematureCheckoutCta("Buy now")).toBe(true);
  });

  it("does not invent testimonials or checkout on the hub", () => {
    const experience = readSrc("src/features/christmas/landing/ChristmasLandingExperience.tsx");
    const copy = readSrc("src/features/christmas/landing/copy.ts");
    expect(experience).not.toMatch(/testimonial/i);
    expect(copy).not.toMatch(/testimonial/i);
    expect(copy).not.toMatch(/\b(buy now|pay now|checkout|purchase now)\b/i);
    expect(readSrc("src/App.tsx")).toContain("GiftFinderLegacyRedirect");
    expect(readSrc("src/components/Header.tsx")).toContain('to: "/christmas"');
    expect(readSrc("src/components/Footer.tsx")).toContain('to="/christmas"');
  });

  it("origin injects /christmas meta for crawlers", () => {
    const origin = readSrc("server/origin.mjs");
    expect(origin).toContain("applyRouteMeta");
    expect(origin).toContain("Christmas Gifts, Portraits & Santa Messages");
    expect(origin).toContain('".webm": "video/webm"');
  });
});
