/**
 * P3D Wave 1 — missing translation key coverage + English leak detector
 * for Christmas client UI packs.
 */
import { describe, expect, it } from "vitest";
import {
  findEnglishLeaks,
  findMissingTranslationKeys,
  formatCoverageFailures,
  WAVE1_NON_EN_LOCALES,
  WAVE1_UI_EXACT_WHITELIST,
} from "@/features/christmas/i18n/wave1UiCoverage";
import {
  PACKS as MESSAGES_PACKS,
  REQUIRED_UI_KEYS as MESSAGES_KEYS,
} from "../messages/messagesCopy";
import {
  TABLES as CARDS_TABLES,
  REQUIRED_UI_KEYS as CARDS_KEYS,
} from "../cards/cardMakerCopy";
import {
  PACKS as GIFT_FINDER_PACKS,
  REQUIRED_UI_KEYS as GIFT_FINDER_KEYS,
} from "../giftFinder/copy";
import {
  PACKS as WISHLIST_PACKS,
  REQUIRED_UI_KEYS as WISHLIST_KEYS,
} from "../wishlist/copy";
import {
  PACKS as LANDING_PACKS,
  REQUIRED_UI_KEYS as LANDING_KEYS,
} from "../landing/copy";
import {
  PACKS as PHOTO_PACKS,
  REQUIRED_UI_KEYS as PHOTO_KEYS,
} from "../photoGenerator/copy";
import {
  PACKS as FAMILY_PACKS,
  REQUIRED_UI_KEYS as FAMILY_KEYS,
} from "../family/copy";
import {
  TABLES as TREE_TABLES,
  REQUIRED_UI_KEYS as TREE_KEYS,
} from "../tree/treeCopy";
import {
  TABLES as ADVENT_TABLES,
  REQUIRED_UI_KEYS as ADVENT_KEYS,
} from "../advent/adventCopy";

/** High-risk interactive keys for English-leak detection (generate/download/share/upload/recipient…). */
const HIGH_RISK_BY_PACK: Record<string, readonly string[]> = {
  messages: ["cta.generate", "cta.copy", "legend.recipient", "error.generate", "cta.useInCard"],
  cards: ["photo.upload", "result.download", "result.share", "message.generate", "nav.continue", "message.who"],
  giftFinder: [
    "nav.continue",
    "nav.find",
    "nav.openWishlist",
    "results.save",
    "error.retry",
    "step.recipient.title",
  ],
  wishlist: ["share.cta", "share.copyLink", "share.native", "hero.ctaCreate", "add.saveWish", "reserve.cta"],
  landing: ["hero.cta", "portraits.cta", "wishlist.cta", "cards.cta", "finder.cta"],
  photo: [
    "upload.choose",
    "result.download",
    "result.share",
    "funnel.download",
    "funnel.share",
    "funnel.upload",
    "subject.continue",
  ],
  tree: ["share.link", "gift.addCta", "editor.saveCreate", "share.enable"],
  advent: ["cta.openToday", "cta.comeBackTomorrow", "door.locked"],
  family: ["upload.choose", "result.download", "result.share", "preview.continue", "offer.pay"],
};

type PackCase = {
  name: string;
  packs: Partial<Record<string, Record<string, string>>>;
  requiredKeys: readonly string[];
  /** When true, only locales that already have a pack are asserted (family sibling). */
  onlyPresentLocales?: boolean;
};

const PACK_CASES: PackCase[] = [
  { name: "messages", packs: MESSAGES_PACKS, requiredKeys: MESSAGES_KEYS },
  { name: "cards", packs: CARDS_TABLES, requiredKeys: CARDS_KEYS },
  { name: "giftFinder", packs: GIFT_FINDER_PACKS, requiredKeys: GIFT_FINDER_KEYS },
  { name: "wishlist", packs: WISHLIST_PACKS, requiredKeys: WISHLIST_KEYS },
  { name: "landing", packs: LANDING_PACKS, requiredKeys: LANDING_KEYS },
  { name: "photo", packs: PHOTO_PACKS, requiredKeys: PHOTO_KEYS },
  { name: "tree", packs: TREE_TABLES, requiredKeys: TREE_KEYS },
  { name: "advent", packs: ADVENT_TABLES, requiredKeys: ADVENT_KEYS },
  {
    name: "family",
    packs: FAMILY_PACKS,
    requiredKeys: FAMILY_KEYS,
    onlyPresentLocales: true,
  },
];

describe("christmas P3D Wave 1 UI missing-key coverage", () => {
  it("documents a small brand / universal whitelist", () => {
    expect(WAVE1_UI_EXACT_WHITELIST.has("TheDigitalGifter")).toBe(true);
    expect(WAVE1_UI_EXACT_WHITELIST.has("The Digital Gifter")).toBe(true);
    expect(WAVE1_UI_EXACT_WHITELIST.has("WhatsApp")).toBe(true);
    expect(WAVE1_UI_EXACT_WHITELIST.has("JPEG")).toBe(true);
    expect(WAVE1_UI_EXACT_WHITELIST.has("PNG")).toBe(true);
    expect(WAVE1_UI_EXACT_WHITELIST.has("WebP")).toBe(true);
    expect(WAVE1_UI_EXACT_WHITELIST.has("MB")).toBe(true);
    // Keep whitelist intentionally small
    expect(WAVE1_UI_EXACT_WHITELIST.size).toBeLessThanOrEqual(20);
  });

  it.each(PACK_CASES)(
    "$name required UI keys exist and do not fall back to EN",
    ({ name, packs, requiredKeys, onlyPresentLocales }) => {
      expect(packs.en).toBeTruthy();
      for (const key of requiredKeys) {
        expect(packs.en![key], `${name} EN missing ${key}`).toBeTruthy();
      }

      const locales = onlyPresentLocales
        ? WAVE1_NON_EN_LOCALES.filter((locale) => Boolean(packs[locale]))
        : WAVE1_NON_EN_LOCALES;

      const failures = findMissingTranslationKeys(name, packs, requiredKeys, locales);
      expect(failures, formatCoverageFailures(failures)).toEqual([]);
    },
  );

  it("family interactive key list is wired for sibling pack expansion", () => {
    expect(FAMILY_KEYS.length).toBeGreaterThan(5);
    for (const key of FAMILY_KEYS) {
      expect(FAMILY_PACKS.en?.[key], `family EN missing interactive key ${key}`).toBeTruthy();
    }
    // When sibling lands non-EN packs, the it.each coverage case above covers them automatically.
    const present = WAVE1_NON_EN_LOCALES.filter((locale) => Boolean(FAMILY_PACKS[locale]));
    expect(Array.isArray(present)).toBe(true);
  });
});

describe("christmas P3D Wave 1 English leak detector", () => {
  it.each(PACK_CASES)(
    "$name high-risk UI keys are not unintended English",
    ({ name, packs, onlyPresentLocales }) => {
      const riskKeys = HIGH_RISK_BY_PACK[name] ?? [];
      expect(riskKeys.length).toBeGreaterThan(0);

      const locales = onlyPresentLocales
        ? WAVE1_NON_EN_LOCALES.filter((locale) => Boolean(packs[locale]))
        : WAVE1_NON_EN_LOCALES;

      const failures = findEnglishLeaks(name, packs, riskKeys, locales);
      expect(failures, formatCoverageFailures(failures)).toEqual([]);
    },
  );

  it("does not naive-flag brand, WhatsApp, or URL tokens as leaks", () => {
    const sample = {
      en: {
        brand: "TheDigitalGifter",
        hint: "https://example.com/path",
        share: "Share via WhatsApp",
      },
      de: {
        brand: "TheDigitalGifter",
        hint: "https://example.com/path",
        share: "Via WhatsApp teilen",
      },
    };
    const failures = findEnglishLeaks("sample", sample, ["brand", "hint", "share"], ["de"]);
    expect(failures).toEqual([]);
  });
});
