/**
 * P3C product-language readiness for Christmas Wave 1.
 * SEO content alone does NOT make a locale indexable when the product cannot
 * deliver that language (Santa TTS/script, etc.).
 */

/** @typedef {"ready" | "partial" | "not-language-dependent" | "not-ready"} ProductReady */

/**
 * @type {Record<string, Record<string, ProductReady>>}
 */
export const CHRISTMAS_PRODUCT_LANGUAGE_READY = {
  santa_script_tts: {
    // P3E: live MiniMax TTS + Whisper language/term/name evidence PASS for Wave 1.
    en: "ready",
    ro: "ready",
    de: "ready",
    fr: "ready",
    es: "ready",
    it: "ready",
    pt: "ready",
    nl: "ready",
    pl: "ready",
  },
  messages_generator: {
    en: "ready",
    ro: "ready",
    de: "ready",
    fr: "ready",
    es: "ready",
    it: "ready",
    pt: "ready",
    nl: "ready",
    pl: "ready",
  },
  cards_message_assistant: {
    en: "ready",
    ro: "ready",
    de: "ready",
    fr: "ready",
    es: "ready",
    it: "ready",
    pt: "ready",
    nl: "ready",
    pl: "ready",
  },
  gift_finder_recommendations: {
    en: "ready",
    ro: "ready",
    de: "ready",
    fr: "ready",
    es: "ready",
    it: "ready",
    pt: "ready",
    nl: "ready",
    pl: "ready",
  },
};

/** Routes that require a product-language gate before SEO indexability. */
export const CHRISTMAS_PRODUCT_GATED_ROUTES = {
  "/christmas/santa-video": "santa_script_tts",
  "/christmas/messages": "messages_generator",
  "/christmas/gift-finder": "gift_finder_recommendations",
};

/**
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
 * @param {string} localeCode
 */
export function canClaimCardsMessageAssistant(localeCode) {
  return CHRISTMAS_PRODUCT_LANGUAGE_READY.cards_message_assistant[localeCode] === "ready";
}
