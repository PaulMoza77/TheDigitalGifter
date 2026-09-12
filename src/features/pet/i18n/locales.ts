/**
 * Pet funnel UI locales. English is primary (unprefixed /pet/...).
 * Wave matches Christmas + Hungarian (maghiară).
 */

export const PET_UI_LOCALE_CODES = [
  "en",
  "ro",
  "hu",
  "de",
  "it",
  "fr",
  "es",
  "pt",
  "nl",
  "pl",
] as const;

export type PetUiLocale = (typeof PET_UI_LOCALE_CODES)[number];

export const PET_DEFAULT_LOCALE: PetUiLocale = "en";

export const PET_UI_LOCALES: Array<{
  code: PetUiLocale;
  label: string;
  nativeName: string;
  prefix: string | null;
}> = [
  { code: "en", label: "English", nativeName: "English", prefix: null },
  { code: "ro", label: "Romanian", nativeName: "Română", prefix: "ro" },
  { code: "hu", label: "Hungarian", nativeName: "Magyar", prefix: "hu" },
  { code: "de", label: "German", nativeName: "Deutsch", prefix: "de" },
  { code: "it", label: "Italian", nativeName: "Italiano", prefix: "it" },
  { code: "fr", label: "French", nativeName: "Français", prefix: "fr" },
  { code: "es", label: "Spanish", nativeName: "Español", prefix: "es" },
  { code: "pt", label: "Portuguese", nativeName: "Português", prefix: "pt" },
  { code: "nl", label: "Dutch", nativeName: "Nederlands", prefix: "nl" },
  { code: "pl", label: "Polish", nativeName: "Polski", prefix: "pl" },
];

const LOCALE_SET = new Set<string>(PET_UI_LOCALE_CODES);

export const PET_LOCALE_PREF_KEY = "tdg.pet.locale.v1" as const;
export const PET_LOCALE_AUTO_KEY = "tdg.pet.localeAuto.v1" as const;

export function isPetUiLocale(value: unknown): value is PetUiLocale {
  return typeof value === "string" && LOCALE_SET.has(value);
}

export function normalizePetUiLocale(value: unknown): PetUiLocale {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace("_", "-");
  if (raw === "pt-pt" || raw.startsWith("pt-")) return "pt";
  if (raw.startsWith("en-") || raw === "en") return "en";
  const code = raw.split("-")[0];
  if (isPetUiLocale(code)) return code;
  return PET_DEFAULT_LOCALE;
}

/** Map navigator.language / languages → supported pet locale (EN fallback). */
export function detectBrowserPetLocale(
  languages: readonly string[] | string | null | undefined = typeof navigator !== "undefined"
    ? navigator.languages?.length
      ? navigator.languages
      : navigator.language
    : null,
): PetUiLocale {
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
    if (isPetUiLocale(code)) return code;
  }
  return PET_DEFAULT_LOCALE;
}

export function readPetLocalePreference(): PetUiLocale | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PET_LOCALE_PREF_KEY);
    return isPetUiLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writePetLocalePreference(locale: PetUiLocale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PET_LOCALE_PREF_KEY, locale);
  } catch {
    /* ignore quota / private mode */
  }
}

export function readPetLocaleAutoFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(PET_LOCALE_AUTO_KEY) === "1";
  } catch {
    return false;
  }
}

export function writePetLocaleAutoFlag(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PET_LOCALE_AUTO_KEY, "1");
  } catch {
    /* ignore */
  }
}
