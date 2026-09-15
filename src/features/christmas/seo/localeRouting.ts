/**
 * Client Christmas locale helpers (P3A/P3B Strategy A).
 * Mirrors server/christmasI18n.mjs for router + language switcher.
 */

export type ChristmasLocaleCode =
  | "en"
  | "ro"
  | "de"
  | "fr"
  | "es"
  | "it"
  | "pt"
  | "nl"
  | "pl";

export const CHRISTMAS_DEFAULT_LOCALE: ChristmasLocaleCode = "en";

export const CHRISTMAS_LOCALE_PREF_KEY = "tdg.christmas.locale.v1" as const;
export const CHRISTMAS_LOCALE_AUTO_KEY = "tdg.christmas.localeAuto.v1" as const;

const CHRISTMAS_LOCALE_SET = new Set<string>([
  "en",
  "ro",
  "de",
  "fr",
  "es",
  "it",
  "pt",
  "nl",
  "pl",
]);

export const CHRISTMAS_UI_LOCALES: Array<{
  code: ChristmasLocaleCode;
  label: string;
  nativeName: string;
  prefix: string | null;
}> = [
  { code: "en", label: "English", nativeName: "English", prefix: null },
  { code: "ro", label: "Romanian", nativeName: "Română", prefix: "ro" },
  { code: "de", label: "German", nativeName: "Deutsch", prefix: "de" },
  { code: "fr", label: "French", nativeName: "Français", prefix: "fr" },
  { code: "es", label: "Spanish", nativeName: "Español", prefix: "es" },
  { code: "it", label: "Italian", nativeName: "Italiano", prefix: "it" },
  { code: "pt", label: "Portuguese", nativeName: "Português", prefix: "pt" },
  { code: "nl", label: "Dutch", nativeName: "Nederlands", prefix: "nl" },
  { code: "pl", label: "Polish", nativeName: "Polski", prefix: "pl" },
];

/** Product-gated routes: only these locales have real generation support for SEO switcher. */
const PRODUCT_GATED_ROUTE_LOCALES: Record<string, ChristmasLocaleCode[]> = {
  // Santa: P3E live TTS QA PASS for all Wave 1 locales
  "/christmas/santa-video": ["en", "ro", "de", "fr", "es", "it", "pt", "nl", "pl"],
  // Messages + Gift Finder: all Wave 1 after P3C product-language enablement
  "/christmas/messages": ["en", "ro", "de", "fr", "es", "it", "pt", "nl", "pl"],
  "/christmas/gift-finder": ["en", "ro", "de", "fr", "es", "it", "pt", "nl", "pl"],
};

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
    return normalizeChristmasPath(pathname);
  }
  if (locale === "en") return basePath;
  const def = CHRISTMAS_UI_LOCALES.find((l) => l.code === locale);
  if (!def?.prefix) return basePath;
  return normalizeChristmasPath(`/${def.prefix}${basePath}`);
}

/** Strip private personalization query params from language-switch navigation. */
export function cleanChristmasSearchForLocaleSwitch(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  for (const key of ["name", "kid", "child", "email", "token", "share"]) {
    params.delete(key);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Locales offered in the language switcher for the current conceptual page.
 * Product-gated routes (Santa / Messages) only list locales with real generation.
 */
export function switchableChristmasLocales(pathname: string) {
  const { basePath } = parseChristmasLocalePath(pathname);
  const gated = PRODUCT_GATED_ROUTE_LOCALES[basePath];
  if (!gated) return CHRISTMAS_UI_LOCALES;
  return CHRISTMAS_UI_LOCALES.filter((l) => gated.includes(l.code));
}

export function isChristmasUiLocale(value: unknown): value is ChristmasLocaleCode {
  return typeof value === "string" && CHRISTMAS_LOCALE_SET.has(value);
}

export function christmasHtmlLang(locale: ChristmasLocaleCode): string {
  return locale === "pt" ? "pt-PT" : locale;
}

export function isChristmasAppPath(pathname: string): boolean {
  const { basePath } = parseChristmasLocalePath(pathname);
  return (
    basePath === "/christmas" ||
    basePath.startsWith("/christmas/") ||
    basePath === "/christmas-ai-photos"
  );
}

export function normalizeChristmasUiLocale(value: unknown): ChristmasLocaleCode {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace("_", "-");
  if (raw === "pt-pt" || raw.startsWith("pt-")) return "pt";
  if (raw.startsWith("en-") || raw === "en") return "en";
  const code = raw.split("-")[0];
  if (isChristmasUiLocale(code)) return code;
  return CHRISTMAS_DEFAULT_LOCALE;
}

/** Map navigator.language / languages → supported Christmas locale (EN fallback). */
export function detectBrowserChristmasLocale(
  languages: readonly string[] | string | null | undefined = typeof navigator !== "undefined"
    ? navigator.languages?.length
      ? navigator.languages
      : navigator.language
    : null,
): ChristmasLocaleCode {
  const list = Array.isArray(languages)
    ? languages
    : typeof languages === "string" && languages
      ? [languages]
      : [];
  for (const entry of list) {
    const raw = String(entry || "")
      .trim()
      .toLowerCase()
      .replace("_", "-");
    if (!raw) continue;
    if (raw === "pt-pt" || raw.startsWith("pt-")) return "pt";
    const code = raw.split("-")[0];
    if (isChristmasUiLocale(code)) return code;
  }
  return CHRISTMAS_DEFAULT_LOCALE;
}

export function readChristmasLocalePreference(): ChristmasLocaleCode | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CHRISTMAS_LOCALE_PREF_KEY);
    return isChristmasUiLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeChristmasLocalePreference(locale: ChristmasLocaleCode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHRISTMAS_LOCALE_PREF_KEY, locale);
  } catch {
    /* ignore quota / private mode */
  }
}

export function readChristmasLocaleAutoFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(CHRISTMAS_LOCALE_AUTO_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeChristmasLocaleAutoFlag(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CHRISTMAS_LOCALE_AUTO_KEY, "1");
  } catch {
    /* ignore */
  }
}

export type ChristmasLocaleRedirectPlan =
  | { kind: "stay"; locale: ChristmasLocaleCode }
  | { kind: "redirect"; locale: ChristmasLocaleCode; path: string };

/**
 * Decide whether an unprefixed Christmas URL should immediately apply a
 * stored preference or a one-shot browser-language detection.
 */
export function planChristmasBrowserLocaleRedirect(input: {
  pathname: string;
  search?: string;
  preference: ChristmasLocaleCode | null;
  autoAlreadyRan: boolean;
  detected: ChristmasLocaleCode;
}): ChristmasLocaleRedirectPlan {
  const parsed = parseChristmasLocalePath(input.pathname);
  const switchable = new Set(switchableChristmasLocales(input.pathname).map((l) => l.code));
  const search = input.search && input.search !== "?" ? input.search : "";

  if (!isChristmasAppPath(input.pathname)) {
    return { kind: "stay", locale: CHRISTMAS_DEFAULT_LOCALE };
  }

  if (parsed.isPrefixed) {
    const locale = isChristmasUiLocale(parsed.locale) ? parsed.locale : CHRISTMAS_DEFAULT_LOCALE;
    return { kind: "stay", locale };
  }

  const allowed = (candidate: ChristmasLocaleCode): ChristmasLocaleCode =>
    switchable.has(candidate) ? candidate : CHRISTMAS_DEFAULT_LOCALE;

  if (input.preference === "en") {
    return { kind: "stay", locale: CHRISTMAS_DEFAULT_LOCALE };
  }

  if (input.preference) {
    const locale = allowed(input.preference);
    if (locale === CHRISTMAS_DEFAULT_LOCALE) {
      return { kind: "stay", locale };
    }
    const path = `${christmasPathForLocale(input.pathname, locale)}${search}`;
    return { kind: "redirect", locale, path };
  }

  if (input.autoAlreadyRan) {
    return { kind: "stay", locale: CHRISTMAS_DEFAULT_LOCALE };
  }

  const locale = allowed(input.detected);
  if (locale === CHRISTMAS_DEFAULT_LOCALE) {
    return { kind: "stay", locale };
  }
  const path = `${christmasPathForLocale(input.pathname, locale)}${search}`;
  return { kind: "redirect", locale, path };
}
