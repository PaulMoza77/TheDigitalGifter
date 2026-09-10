/**
 * Client mirror of server Christmas SEO registry (same module, no Node APIs).
 * Keeps SPA PageHead titles/descriptions aligned with SSR HTML injection.
 */
export {
  SITE_ORIGIN,
  CHRISTMAS_SEO_ROUTES,
  getChristmasSeo,
  listChristmasSeoPaths,
  normalizeSeoPath,
} from "../../../../server/christmasSeo.mjs";
