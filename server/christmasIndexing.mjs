/**
 * Christmas P1 indexing / redirect / sitemap policy.
 * Complements server/christmasSeo.mjs (P0 SSR shells) without replacing it.
 *
 * Canonical host: https://www.thedigitalgifter.com
 * Path form: no trailing slash (except "/")
 */

import { SITE_ORIGIN, getChristmasSeo, normalizeSeoPath } from "./christmasSeo.mjs";
import {
  christmasPathForLocale,
  englishPrefixRedirectTarget,
  isKnownChristmasBasePath,
  parseChristmasLocalePath,
} from "./christmasI18n.mjs";
import {
  CHRISTMAS_I18N_ROUTE_BASES,
  isChristmasLocaleSeoIndexable,
  listEnabledChristmasLocales,
} from "./christmasLocale.mjs";

export { SITE_ORIGIN };

/** Primary organic Christmas URLs that should be index,follow + sitemap. */
export const CHRISTMAS_INDEXABLE_PATHS = [
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
 * Known Christmas SPA surfaces that must remain 200 (even if noindex),
 * plus related product aliases that are not primary SEO landings.
 */
export const CHRISTMAS_KNOWN_SPA_PATHS = [
  ...CHRISTMAS_INDEXABLE_PATHS,
  "/christmas/kids",
  "/christmas/suite",
  "/christmas/tree-gifts",
  "/christmas-ai-photos",
  "/christmas-ai-photos/order",
];

/** Permanent path redirects: source → target (query string preserved by caller). */
export const CHRISTMAS_PERMANENT_REDIRECTS = Object.freeze({
  "/christmas/gifts": "/christmas/gift-finder",
});

/**
 * Explicit noindex,follow routes (product still crawlable so engines see the directive).
 * Dynamic share patterns are handled separately.
 */
export const CHRISTMAS_NOINDEX_PATHS = Object.freeze([
  "/christmas/kids",
  "/christmas-ai-photos",
  "/christmas-ai-photos/order",
]);

const INDEXABLE_SET = new Set(CHRISTMAS_INDEXABLE_PATHS);
const KNOWN_SET = new Set(CHRISTMAS_KNOWN_SPA_PATHS);
const NOINDEX_SET = new Set(CHRISTMAS_NOINDEX_PATHS);

const ASSET_EXT =
  /\.(?:js|css|map|png|jpe?g|webp|gif|svg|ico|woff2?|mp4|webm|json|txt|xml|html)$/i;

export function isChristmasAssetPath(pathname) {
  return ASSET_EXT.test(String(pathname || ""));
}

export function isWishlistSharePath(pathname) {
  const path = normalizeSeoPath(pathname);
  return /^\/wishlist\/[^/]+$/.test(path);
}

export function isTreeSharePath(pathname) {
  const path = normalizeSeoPath(pathname);
  return /^\/christmas\/tree\/[^/]+$/.test(path);
}

export function isChristmasSharePath(pathname) {
  return isWishlistSharePath(pathname) || isTreeSharePath(pathname);
}

/** @returns {boolean} */
export function shouldNoindexChristmasPath(pathname) {
  const parsed = parseChristmasLocalePath(pathname);
  const path = normalizeSeoPath(parsed.publicPath);
  const base = parsed.basePath;

  if (NOINDEX_SET.has(base) || NOINDEX_SET.has(path)) return true;
  if (isChristmasSharePath(path) || isChristmasSharePath(base)) return true;

  // Prefixed locales incomplete for this route → noindex
  if (parsed.isPrefixed && parsed.locale !== "en") {
    if (!isChristmasLocaleSeoIndexable(parsed.locale, base)) return true;
  }

  const seo = getChristmasSeo(base);
  if (seo?.noindex) return true;
  return false;
}

/** @returns {boolean} */
export function isChristmasIndexablePath(pathname) {
  const parsed = parseChristmasLocalePath(pathname);
  if (parsed.isPrefixed && parsed.urlPrefix === "en") return false;
  if (!isChristmasLocaleSeoIndexable(parsed.locale, parsed.basePath)) return false;
  return !shouldNoindexChristmasPath(pathname);
}

/** @returns {string | null} target path without query */
export function getChristmasPermanentRedirectTarget(pathname) {
  const path = normalizeSeoPath(pathname);
  if (CHRISTMAS_PERMANENT_REDIRECTS[path]) return CHRISTMAS_PERMANENT_REDIRECTS[path];

  const enTarget = englishPrefixRedirectTarget(path);
  if (enTarget) return enTarget;

  return null;
}

/**
 * Build absolute Location for a permanent Christmas redirect, preserving query.
 * @param {string} pathname
 * @param {string} [search] including leading ? or empty
 */
export function buildChristmasRedirectLocation(pathname, search = "") {
  const target = getChristmasPermanentRedirectTarget(pathname);
  if (!target) return null;
  const q = String(search || "");
  const suffix = q && q !== "?" ? (q.startsWith("?") ? q : `?${q}`) : "";
  return `${SITE_ORIGIN}${target}${suffix}`;
}

/**
 * Apex → www host redirect Location, or null if already canonical / non-TDG.
 * @param {string} host header (may include port)
 * @param {string} pathname
 * @param {string} [search]
 */
export function buildApexToWwwLocation(host, pathname, search = "") {
  const hostname = String(host || "")
    .split(":")[0]
    .toLowerCase();
  if (hostname !== "thedigitalgifter.com") return null;
  const path = pathname || "/";
  const q = String(search || "");
  const suffix = q && q !== "?" ? (q.startsWith("?") ? q : `?${q}`) : "";
  return `${SITE_ORIGIN}${path}${suffix}`;
}

/**
 * Trailing-slash → no-slash Location (except "/").
 * @returns {string | null} path+search to redirect to (relative) or null
 */
export function buildTrailingSlashRedirect(pathname, search = "") {
  const raw = String(pathname || "/");
  if (raw === "/" || !raw.endsWith("/")) return null;
  if (isChristmasAssetPath(raw)) return null;
  const stripped = raw.replace(/\/+$/, "") || "/";
  const q = String(search || "");
  const suffix = q && q !== "?" ? (q.startsWith("?") ? q : `?${q}`) : "";
  return `${stripped}${suffix}`;
}

/**
 * True when a /christmas* (or /{locale}/christmas*) request should 404.
 */
export function should404UnknownChristmasPath(pathname) {
  const parsed = parseChristmasLocalePath(pathname);
  const path = normalizeSeoPath(pathname);
  const base = parsed.basePath;

  const looksChristmas =
    base.startsWith("/christmas") ||
    base === "/christmas-ai-photos" ||
    base.startsWith("/christmas-ai-photos/") ||
    path.startsWith("/christmas") ||
    path === "/christmas-ai-photos" ||
    path.startsWith("/christmas-ai-photos/");

  // Locale-prefixed non-christmas paths are not handled here
  if (parsed.isPrefixed && parsed.locale !== "en") {
    if (!base.startsWith("/christmas") && base !== "/christmas-ai-photos" && !base.startsWith("/christmas-ai-photos/")) {
      return false;
    }
  } else if (!looksChristmas) {
    return false;
  }

  if (isChristmasAssetPath(path) || isChristmasAssetPath(base)) return false;
  if (KNOWN_SET.has(base) || KNOWN_SET.has(path)) return false;
  if (isKnownChristmasBasePath(base)) return false;
  if (isTreeSharePath(base) || isTreeSharePath(path)) return false;
  return true;
}

/** Sitemap Christmas locs (www, no trailing slash) including complete locale pilots. */
export function christmasSitemapPaths() {
  /** @type {string[]} */
  const paths = [...CHRISTMAS_INDEXABLE_PATHS];
  for (const locale of listEnabledChristmasLocales()) {
    if (locale.isDefault) continue;
    for (const base of CHRISTMAS_I18N_ROUTE_BASES) {
      if (!isChristmasLocaleSeoIndexable(locale.code, base)) continue;
      paths.push(christmasPathForLocale(base, locale.code));
    }
  }
  return paths;
}

export function christmasSitemapLocs() {
  return christmasSitemapPaths().map((path) => `${SITE_ORIGIN}${path}`);
}

/**
 * Soft noindex HTML shell for dynamic share / order routes (SSR meta only).
 * Keeps OG-friendly defaults; client PageHead may refine titles for social.
 */
export function applyChristmasNoindexShell(html, pathname) {
  const path = normalizeSeoPath(pathname);
  if (!shouldNoindexChristmasPath(path)) return html;

  let next = html;
  const robotsRe = /<meta(\s+)name="robots"(\s+)content="[^"]*"/i;
  if (robotsRe.test(next)) {
    next = next.replace(robotsRe, `<meta$1name="robots"$2content="noindex,follow"`);
  } else {
    next = next.replace(
      /<\/head>/i,
      `    <meta name="robots" content="noindex,follow" />\n  </head>`,
    );
  }

  // Self-canonical without query/share noise where we have a product parent.
  let canonicalPath = path;
  if (isWishlistSharePath(path)) canonicalPath = "/christmas/wishlist";
  if (isTreeSharePath(path)) canonicalPath = "/christmas/tree";
  if (path === "/christmas-ai-photos/order") canonicalPath = "/christmas-ai-photos";

  const canonical = `${SITE_ORIGIN}${canonicalPath}`;
  const canonRe = /<link(\s+)rel="canonical"(\s+)href="[^"]*"/i;
  if (canonRe.test(next)) {
    next = next.replace(canonRe, `<link$1rel="canonical"$2href="${canonical}"`);
  }

  return next;
}
