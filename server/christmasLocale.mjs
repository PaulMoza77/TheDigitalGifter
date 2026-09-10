/**
 * Christmas international SEO locale registry (P3A/P3B).
 * Strategy A: English stays unprefixed; other locales use /{locale}/christmas/...
 *
 * Do NOT mark a locale/route indexable unless translation is genuinely complete
 * AND product-language readiness allows it (see christmasProductReadiness.mjs).
 */

import { isChristmasProductReadyForLocale } from "./christmasProductReadiness.mjs";

/** @typedef {{
 *   code: string,
 *   hreflang: string,
 *   htmlLang: string,
 *   dir: "ltr" | "rtl",
 *   nameEn: string,
 *   nativeName: string,
 *   enabled: boolean,
 *   isDefault: boolean,
 *   urlPrefix: string | null,
 *   wave: 1 | 2 | 3 | 4,
 *   variant?: string,
 * }} ChristmasLocaleDef */

/** @type {Record<string, ChristmasLocaleDef>} */
export const CHRISTMAS_LOCALE_REGISTRY = {
  en: {
    code: "en",
    hreflang: "en",
    htmlLang: "en",
    dir: "ltr",
    nameEn: "English",
    nativeName: "English",
    enabled: true,
    isDefault: true,
    urlPrefix: null,
    wave: 1,
  },
  ro: {
    code: "ro",
    hreflang: "ro",
    htmlLang: "ro",
    dir: "ltr",
    nameEn: "Romanian",
    nativeName: "Română",
    enabled: true,
    isDefault: false,
    urlPrefix: "ro",
    wave: 1,
  },
  de: {
    code: "de",
    hreflang: "de",
    htmlLang: "de",
    dir: "ltr",
    nameEn: "German",
    nativeName: "Deutsch",
    enabled: true,
    isDefault: false,
    urlPrefix: "de",
    wave: 1,
  },
  fr: {
    code: "fr",
    hreflang: "fr",
    htmlLang: "fr",
    dir: "ltr",
    nameEn: "French",
    nativeName: "Français",
    enabled: true,
    isDefault: false,
    urlPrefix: "fr",
    wave: 1,
  },
  es: {
    code: "es",
    hreflang: "es",
    htmlLang: "es",
    dir: "ltr",
    nameEn: "Spanish",
    nativeName: "Español",
    enabled: true,
    isDefault: false,
    urlPrefix: "es",
    wave: 1,
    variant: "neutral-international",
  },
  it: {
    code: "it",
    hreflang: "it",
    htmlLang: "it",
    dir: "ltr",
    nameEn: "Italian",
    nativeName: "Italiano",
    enabled: true,
    isDefault: false,
    urlPrefix: "it",
    wave: 1,
  },
  pt: {
    code: "pt",
    // Wave 1 European Portuguese (Portugal). Expandable to pt-BR later.
    hreflang: "pt-PT",
    htmlLang: "pt-PT",
    dir: "ltr",
    nameEn: "Portuguese (Portugal)",
    nativeName: "Português (Portugal)",
    enabled: true,
    isDefault: false,
    urlPrefix: "pt",
    wave: 1,
    variant: "pt-PT",
  },
  nl: {
    code: "nl",
    hreflang: "nl",
    htmlLang: "nl",
    dir: "ltr",
    nameEn: "Dutch",
    nativeName: "Nederlands",
    enabled: true,
    isDefault: false,
    urlPrefix: "nl",
    wave: 1,
  },
  pl: {
    code: "pl",
    hreflang: "pl",
    htmlLang: "pl",
    dir: "ltr",
    nameEn: "Polish",
    nativeName: "Polski",
    enabled: true,
    isDefault: false,
    urlPrefix: "pl",
    wave: 1,
  },
  // Wave 2 samples (disabled)
  sv: {
    code: "sv",
    hreflang: "sv",
    htmlLang: "sv",
    dir: "ltr",
    nameEn: "Swedish",
    nativeName: "Svenska",
    enabled: false,
    isDefault: false,
    urlPrefix: "sv",
    wave: 2,
  },
  // Wave 3 RTL sample (disabled) — architecture readiness
  ar: {
    code: "ar",
    hreflang: "ar",
    htmlLang: "ar",
    dir: "rtl",
    nameEn: "Arabic",
    nativeName: "العربية",
    enabled: false,
    isDefault: false,
    urlPrefix: "ar",
    wave: 3,
  },
};

export const DEFAULT_CHRISTMAS_LOCALE = "en";

/** English slug paths that participate in international organic SEO. */
export const CHRISTMAS_I18N_ROUTE_BASES = [
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
];

const WAVE1_SEO_LOCALES = ["ro", "de", "fr", "es", "it", "pt", "nl", "pl"];

/**
 * Per-locale route translation completeness (content packs).
 * Indexability also requires product readiness for gated routes.
 *
 * @type {Record<string, Partial<Record<string, { complete: boolean, notes?: string }>>>}
 */
export const CHRISTMAS_TRANSLATION_COMPLETENESS = {
  en: Object.fromEntries(
    CHRISTMAS_I18N_ROUTE_BASES.map((p) => [p, { complete: true }]),
  ),
  ...Object.fromEntries(
    WAVE1_SEO_LOCALES.map((code) => [
      code,
      Object.fromEntries(
        CHRISTMAS_I18N_ROUTE_BASES.map((p) => [
          p,
          {
            complete: true,
            notes:
              p === "/christmas/santa-video" || p === "/christmas/messages"
                ? "Content complete; indexability gated by product-language readiness"
                : "P3B Wave 1 SEO content",
          },
        ]),
      ),
    ]),
  ),
};

export function getChristmasLocale(code) {
  return CHRISTMAS_LOCALE_REGISTRY[code] || null;
}

export function listEnabledChristmasLocales() {
  return Object.values(CHRISTMAS_LOCALE_REGISTRY).filter((l) => l.enabled);
}

export function listRegisteredChristmasLocales() {
  return Object.values(CHRISTMAS_LOCALE_REGISTRY);
}

export function isChristmasTranslationComplete(localeCode, basePath) {
  if (localeCode === "en") return true;
  const row = CHRISTMAS_TRANSLATION_COMPLETENESS[localeCode]?.[basePath];
  return Boolean(row?.complete);
}

/**
 * Indexable only when locale enabled, translation complete, AND product-ready.
 */
export function isChristmasLocaleSeoIndexable(localeCode, basePath) {
  const locale = getChristmasLocale(localeCode);
  if (!locale?.enabled) return false;
  if (!CHRISTMAS_I18N_ROUTE_BASES.includes(basePath)) return false;
  if (!isChristmasTranslationComplete(localeCode, basePath)) return false;
  if (!isChristmasProductReadyForLocale(localeCode, basePath)) return false;
  return true;
}
