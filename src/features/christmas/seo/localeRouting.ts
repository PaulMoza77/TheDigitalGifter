/**
 * Client Christmas locale helpers (P3A Strategy A).
 * Mirrors server/christmasI18n.mjs for router + language switcher.
 */

export type ChristmasLocaleCode = "en" | "ro";

export const CHRISTMAS_UI_LOCALES: Array<{
  code: ChristmasLocaleCode;
  label: string;
  nativeName: string;
  prefix: string | null;
}> = [
  { code: "en", label: "English", nativeName: "English", prefix: null },
  { code: "ro", label: "Romanian", nativeName: "Română", prefix: "ro" },
];

const LOCALE_PREFIX_RE = /^\/([a-z]{2})(\/|$)/i;

export function normalizeChristmasPath(pathname: string): string {
  const raw = String(pathname || "").split("?")[0].split("#")[0];
  if (!raw || raw === "/") return "/";
  return raw.replace(/\/+$/, "") || "/";
}

export function parseChristmasLocalePath(pathname: string): {
  locale: ChristmasLocaleCode | string;
  basePath: string;
  publicPath: string;
  isPrefixed: boolean;
} {
  const raw = normalizeChristmasPath(pathname);
  const match = raw.match(LOCALE_PREFIX_RE);
  if (!match) {
    return { locale: "en", basePath: raw, publicPath: raw, isPrefixed: false };
  }
  const prefix = match[1].toLowerCase();
  if (prefix === "en") {
    const rest = normalizeChristmasPath(raw.slice(3) || "/");
    return { locale: "en", basePath: rest, publicPath: rest, isPrefixed: true };
  }
  const known = CHRISTMAS_UI_LOCALES.find((l) => l.prefix === prefix);
  if (!known) {
    return { locale: "en", basePath: raw, publicPath: raw, isPrefixed: false };
  }
  const rest = normalizeChristmasPath(raw.slice(prefix.length + 1) || "/");
  return {
    locale: known.code,
    basePath: rest,
    publicPath: raw,
    isPrefixed: true,
  };
}

/** Map current Christmas URL to the same conceptual page in another locale. */
export function christmasPathForLocale(
  pathname: string,
  locale: ChristmasLocaleCode,
): string {
  const { basePath } = parseChristmasLocalePath(pathname);
  if (!basePath.startsWith("/christmas") && basePath !== "/christmas-ai-photos") {
    // Non-christmas: stay put
    return normalizeChristmasPath(pathname);
  }
  if (locale === "en") return basePath;
  const def = CHRISTMAS_UI_LOCALES.find((l) => l.code === locale);
  if (!def?.prefix) return basePath;
  return normalizeChristmasPath(`/${def.prefix}${basePath}`);
}

/** Strip private query params from language-switch navigation. */
export function cleanChristmasSearchForLocaleSwitch(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  for (const key of ["name", "kid", "child", "email", "token", "share"]) {
    params.delete(key);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
