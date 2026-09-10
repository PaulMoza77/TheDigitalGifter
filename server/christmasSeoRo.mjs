/**
 * Backward-compatible re-export shim.
 * Canonical Romanian Christmas SEO content now lives in `./i18n/seo/ro.mjs`,
 * which covers the full 14-route Christmas surface (not just the P3A pilot).
 */
export {
  CHRISTMAS_SEO_CONTENT as CHRISTMAS_SEO_CONTENT_RO,
  getChristmasSeoContent as getChristmasSeoContentRo,
} from "./i18n/seo/ro.mjs";
