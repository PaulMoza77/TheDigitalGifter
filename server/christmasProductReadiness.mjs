/**
 * P3B product-language readiness for Christmas Wave 1.
 * SEO content alone does NOT make a locale indexable when the product cannot
 * deliver that language (Santa TTS/script, Messages generator, etc.).
 */

/** @typedef {"ready" | "partial" | "not-language-dependent" | "not-ready"} ProductReady */

/**
 * @type {Record<string, Record<string, ProductReady>>}
 * Outer key = capability, inner = locale code.
 */
export const CHRISTMAS_PRODUCT_LANGUAGE_READY = {
  santa_script_tts: {
    en: "ready",
    ro: "ready",
    de: "not-ready",
    fr: "not-ready",
    es: "not-ready",
    it: "not-ready",
    pt: "not-ready",
    nl: "not-ready",
    pl: "not-ready",
  },
  messages_generator: {
    en: "ready",
    ro: "ready",
    de: "not-ready",
    fr: "not-ready",
    es: "not-ready",
    it: "not-ready",
    pt: "not-ready",
    nl: "not-ready",
    pl: "not-ready",
  },
  cards_message_assistant: {
    en: "ready",
    ro: "ready",
    de: "not-ready",
    fr: "not-ready",
    es: "not-ready",
    it: "not-ready",
    pt: "not-ready",
    nl: "not-ready",
    pl: "not-ready",
  },
  gift_finder_recommendations: {
    en: "ready",
    // RO LLM prompt exists but UI locale is forced EN; curated fallbacks mostly EN
    ro: "partial",
    de: "not-ready",
    fr: "not-ready",
    es: "not-ready",
    it: "not-ready",
    pt: "not-ready",
    nl: "not-ready",
    pl: "not-ready",
  },
};

/** Routes that require a product-language gate before SEO indexability. */
export const CHRISTMAS_PRODUCT_GATED_ROUTES = {
  "/christmas/santa-video": "santa_script_tts",
  "/christmas/messages": "messages_generator",
};

/**
 * True when the product can honestly support this locale for the route.
 * Non-gated routes are treated as not-language-dependent (image/date/wishlist UX).
 * @param {string} localeCode
 * @param {string} basePath
 */
export function isChristmasProductReadyForLocale(localeCode, basePath) {
  const capability = CHRISTMAS_PRODUCT_GATED_ROUTES[basePath];
  if (!capability) return true;
  const state = CHRISTMAS_PRODUCT_LANGUAGE_READY[capability]?.[localeCode];
  return state === "ready";
}

/**
 * Whether cards SEO may claim in-locale message assistance.
 * @param {string} localeCode
 */
export function canClaimCardsMessageAssistant(localeCode) {
  return CHRISTMAS_PRODUCT_LANGUAGE_READY.cards_message_assistant[localeCode] === "ready";
}
