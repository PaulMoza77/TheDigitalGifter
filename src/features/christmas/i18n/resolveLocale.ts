/**
 * Christmas EN/RO localization — secondary gap loop (577a).
 * Not a site-wide i18n framework. Query `?lang=ro|en` + localStorage.
 * Missing keys fall back to English; never throw.
 */

import type { ChristmasLocale } from "../catalog";

export type ChristmasI18nKey = keyof typeof import("./en").christmasEn;

export type ChristmasDictionary = Record<string, string>;

export const CHRISTMAS_LOCALE_STORAGE_KEY = "tdg.christmas.locale.v1";
export const CHRISTMAS_LOCALE_QUERY = "lang";
export const CHRISTMAS_FALLBACK_LOCALE: ChristmasLocale = "en";

export function normalizeChristmasLocale(
  value: string | null | undefined,
): ChristmasLocale {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace("_", "-");
  if (raw === "ro" || raw.startsWith("ro-")) return "ro";
  if (raw === "en" || raw.startsWith("en-")) return "en";
  return CHRISTMAS_FALLBACK_LOCALE;
}

/**
 * Authoritative client resolution order:
 * URL ?lang= → localStorage → navigator → en
 */
export function resolveChristmasLocale(input?: {
  search?: string | null;
  stored?: string | null;
  navigatorLanguage?: string | null;
}): ChristmasLocale {
  const params = new URLSearchParams(
    input?.search ??
      (typeof window !== "undefined" ? window.location.search : ""),
  );
  const fromQuery = params.get(CHRISTMAS_LOCALE_QUERY);
  if (fromQuery) return normalizeChristmasLocale(fromQuery);

  const stored =
    input?.stored ??
    (typeof window !== "undefined"
      ? window.localStorage.getItem(CHRISTMAS_LOCALE_STORAGE_KEY)
      : null);
  if (stored) return normalizeChristmasLocale(stored);

  const nav =
    input?.navigatorLanguage ??
    (typeof navigator !== "undefined" ? navigator.language : null);
  if (nav) {
    const n = normalizeChristmasLocale(nav);
    // Only auto-pick RO when browser is Romanian; otherwise stay EN.
    if (n === "ro") return "ro";
  }

  return CHRISTMAS_FALLBACK_LOCALE;
}

export function persistChristmasLocale(locale: ChristmasLocale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHRISTMAS_LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}

export function interpolate(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

export function translateChristmas(
  dictionaries: { en: ChristmasDictionary; ro: ChristmasDictionary },
  locale: ChristmasLocale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const primary = dictionaries[locale]?.[key];
  const fallback = dictionaries.en?.[key];
  const raw = primary || fallback || key;
  return interpolate(raw, vars);
}
