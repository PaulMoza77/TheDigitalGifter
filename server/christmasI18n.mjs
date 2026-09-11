/**
 * Christmas P3A locale path helpers + hreflang builders.
 * Strategy A: EN unprefixed; other locales /{prefix}/christmas/...
 */

import {
  CHRISTMAS_I18N_ROUTE_BASES,
  CHRISTMAS_LOCALE_REGISTRY,
  DEFAULT_CHRISTMAS_LOCALE,
  getChristmasLocale,
  isChristmasLocaleSeoIndexable,
  listEnabledChristmasLocales,
} from "./christmasLocale.mjs";

export const SITE_ORIGIN = "https://www.thedigitalgifter.com";

const LOCALE_PREFIX_RE = /^\/([a-z]{2}(?:-[a-z]{2})?)(\/|$)/i;

function normalizeSeoPath(pathname) {
  const raw = String(pathname || "").split("?")[0].split("#")[0];
  if (!raw || raw === "/") return "/";
  return raw.replace(/\/+$/, "") || "/";
}

/**
 * @typedef {{
 *   locale: string,
 *   basePath: string,
 *   publicPath: string,
 *   urlPrefix: string | null,
 *   isPrefixed: boolean,
 * }} ParsedChristmasLocalePath
 */

/** @returns {string[]} */
export function listChristmasLocaleUrlPrefixes() {
  return Object.values(CHRISTMAS_LOCALE_REGISTRY)
    .map((l) => l.urlPrefix)
    .filter(Boolean);
}

/**
 * Strip a known locale prefix from a path. Unknown prefixes are left alone
 * (so /en/... can still be detected via registry as English alias).
 * @param {string} pathname
 * @returns {ParsedChristmasLocalePath}
 */
export function parseChristmasLocalePath(pathname) {
  const raw = normalizeSeoPath(pathname);
  const match = raw.match(LOCALE_PREFIX_RE);
  if (!match) {
    return {
      locale: DEFAULT_CHRISTMAS_LOCALE,
      basePath: raw,
      publicPath: raw,
      urlPrefix: null,
      isPrefixed: false,
    };
  }

  const prefix = match[1].toLowerCase();
  const localeDef = Object.values(CHRISTMAS_LOCALE_REGISTRY).find(
    (l) => l.urlPrefix === prefix || (l.code === prefix && l.urlPrefix === null),
  );

  // /en/... is an English alias prefix (not used as canonical)
  if (prefix === "en") {
    const rest = raw.slice(("/en").length) || "/";
    const basePath = normalizeSeoPath(rest);
    return {
      locale: "en",
      basePath,
      publicPath: basePath, // canonical public form is unprefixed
      urlPrefix: "en",
      isPrefixed: true,
    };
  }

  if (!localeDef || !localeDef.urlPrefix) {
    return {
      locale: DEFAULT_CHRISTMAS_LOCALE,
      basePath: raw,
      publicPath: raw,
      urlPrefix: null,
      isPrefixed: false,
    };
  }

  const rest = raw.slice((`/${localeDef.urlPrefix}`).length) || "/";
  const basePath = normalizeSeoPath(rest);
  return {
    locale: localeDef.code,
    basePath,
    publicPath: raw,
    urlPrefix: localeDef.urlPrefix,
    isPrefixed: true,
  };
}

/**
 * Build the public SEO path for a base Christmas route in a locale.
 * @param {string} basePath e.g. /christmas/cards
 * @param {string} localeCode
 */
export function christmasPathForLocale(basePath, localeCode = DEFAULT_CHRISTMAS_LOCALE) {
  const base = normalizeSeoPath(basePath);
  const locale = getChristmasLocale(localeCode) || getChristmasLocale(DEFAULT_CHRISTMAS_LOCALE);
  if (!locale || locale.isDefault || !locale.urlPrefix) return base;
  return normalizeSeoPath(`/${locale.urlPrefix}${base}`);
}

/**
 * Absolute canonical URL for a locale + base path (Strategy A).
 */
export function christmasCanonicalUrl(basePath, localeCode = DEFAULT_CHRISTMAS_LOCALE) {
  return `${SITE_ORIGIN}${christmasPathForLocale(basePath, localeCode)}`;
}

/**
 * If pathname is /en/christmas..., return redirect target (unprefixed).
 * @returns {string | null}
 */
export function englishPrefixRedirectTarget(pathname) {
  const parsed = parseChristmasLocalePath(pathname);
  if (parsed.isPrefixed && parsed.urlPrefix === "en") {
    return parsed.basePath;
  }
  return null;
}

/**
 * Build reciprocal hreflang cluster for a base route.
 * Only includes locales where that route is SEO-complete + enabled.
 * Always includes self + x-default (English).
 *
 * @param {string} basePath
 * @returns {Array<{ hreflang: string, href: string }>}
 */
export function buildChristmasHreflangAlternates(basePath) {
  const base = normalizeSeoPath(basePath);
  if (!CHRISTMAS_I18N_ROUTE_BASES.includes(base)) return [];

  /** @type {Array<{ hreflang: string, href: string }>} */
  const out = [];
  const seen = new Set();

  for (const locale of listEnabledChristmasLocales()) {
    if (!isChristmasLocaleSeoIndexable(locale.code, base)) continue;
    const href = christmasCanonicalUrl(base, locale.code);
    const key = `${locale.hreflang}|${href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ hreflang: locale.hreflang, href });
  }

  // x-default → English/global unprefixed
  if (isChristmasLocaleSeoIndexable("en", base)) {
    const href = christmasCanonicalUrl(base, "en");
    out.push({ hreflang: "x-default", href });
  }

  return out;
}

/**
 * HTML link tags for hreflang cluster.
 * @param {string} basePath
 */
export function buildChristmasHreflangHtml(basePath) {
  const alts = buildChristmasHreflangAlternates(basePath);
  if (!alts.length) return "";
  return alts
    .map(
      (a) =>
        `<link rel="alternate" hreflang="${escapeAttr(a.hreflang)}" href="${escapeAttr(a.href)}" />`,
    )
    .join("\n    ");
}

/**
 * List all public paths that should be prerendered for Christmas SEO shells,
 * including complete localized pilots.
 * @returns {string[]}
 */
export function listChristmasPrerenderPaths() {
  /** @type {string[]} */
  const paths = [];
  // Base English paths come from SEO registry separately; add localized complete ones
  for (const locale of listEnabledChristmasLocales()) {
    if (locale.isDefault) continue;
    for (const base of CHRISTMAS_I18N_ROUTE_BASES) {
      if (!isChristmasLocaleSeoIndexable(locale.code, base)) continue;
      paths.push(christmasPathForLocale(base, locale.code));
    }
  }
  return paths;
}

/**
 * Known SPA bases that should 200 under a locale prefix (even if noindex),
 * so language switcher does not 404.
 */
export function isKnownChristmasBasePath(basePath) {
  const path = normalizeSeoPath(basePath);
  return (
    CHRISTMAS_I18N_ROUTE_BASES.includes(path) ||
    path === "/christmas/kids" ||
    path === "/christmas/suite" ||
    path === "/christmas/tree-gifts" ||
    path.startsWith("/christmas/tree/") ||
    path.startsWith("/wishlist/")
  );
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
