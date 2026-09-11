/**
 * Christmas international SEO locale registry (P3A).
 * Strategy A: English stays unprefixed; other locales use /{locale}/christmas/...
 *
 * Do NOT mark a locale/route indexable unless translation is genuinely complete.
 */

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
  // Wave 1 — registered, not enabled for SEO until P3B translations land
  de: {
    code: "de",
    hreflang: "de",
    htmlLang: "de",
    dir: "ltr",
    nameEn: "German",
    nativeName: "Deutsch",
    enabled: false,
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
    enabled: false,
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
    enabled: false,
    isDefault: false,
    urlPrefix: "es",
    wave: 1,
  },
  it: {
    code: "it",
    hreflang: "it",
    htmlLang: "it",
    dir: "ltr",
    nameEn: "Italian",
    nativeName: "Italiano",
    enabled: false,
    isDefault: false,
    urlPrefix: "it",
    wave: 1,
  },
  pt: {
    code: "pt",
    hreflang: "pt",
    htmlLang: "pt",
    dir: "ltr",
    nameEn: "Portuguese",
    nativeName: "Português",
    enabled: false,
    isDefault: false,
    urlPrefix: "pt",
    wave: 1,
  },
  nl: {
    code: "nl",
    hreflang: "nl",
    htmlLang: "nl",
    dir: "ltr",
    nameEn: "Dutch",
    nativeName: "Nederlands",
    enabled: false,
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
    enabled: false,
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

/**
 * Per-locale route translation completeness.
 * Only routes listed as complete may be indexable + appear in hreflang/sitemap.
 * EN is always complete for all i18n bases (source language).
 *
 * @type {Record<string, Partial<Record<string, { complete: boolean, notes?: string }>>>}
 */
export const CHRISTMAS_TRANSLATION_COMPLETENESS = {
  en: Object.fromEntries(
    CHRISTMAS_I18N_ROUTE_BASES.map((p) => [p, { complete: true }]),
  ),
  ro: {
    // P3A pilot — genuine RO SEO shells for these three only
    "/christmas": { complete: true, notes: "P3A pilot hub" },
    "/christmas/santa-video": { complete: true, notes: "P3A pilot santa" },
    "/christmas/cards": { complete: true, notes: "P3A pilot cards" },
    // Remaining RO Christmas surfaces: UI may fallback; SEO must stay noindex
  },
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

export function isChristmasLocaleSeoIndexable(localeCode, basePath) {
  const locale = getChristmasLocale(localeCode);
  if (!locale?.enabled) return false;
  if (!CHRISTMAS_I18N_ROUTE_BASES.includes(basePath)) return false;
  return isChristmasTranslationComplete(localeCode, basePath);
}
