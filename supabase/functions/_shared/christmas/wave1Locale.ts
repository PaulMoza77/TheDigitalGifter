/**
 * Shared Wave 1 Christmas generation locale contract (edge / Deno).
 * Keep in sync with src/features/christmas/i18n/wave1Locale.ts
 */

export const WAVE1_GENERATION_LOCALES = [
  "en",
  "ro",
  "de",
  "fr",
  "es",
  "it",
  "pt",
  "nl",
  "pl",
] as const;

export type Wave1GenerationLocale = (typeof WAVE1_GENERATION_LOCALES)[number];

const SET = new Set<string>(WAVE1_GENERATION_LOCALES);

export const GENERATION_LANGUAGE_NAME: Record<Wave1GenerationLocale, string> = {
  en: "English",
  ro: "Romanian",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  pt: "European Portuguese (Portugal) — Português de Portugal, not Brazilian",
  nl: "Dutch",
  pl: "Polish",
};

/** MiniMax speech-02-hd language_boost values (provider enum). */
export const MINIMAX_LANGUAGE_BOOST: Record<Wave1GenerationLocale, string> = {
  en: "English",
  ro: "Romanian",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  pl: "Polish",
};

export function isWave1GenerationLocale(value: unknown): value is Wave1GenerationLocale {
  return typeof value === "string" && SET.has(value);
}

export function normalizeWave1GenerationLocale(value: unknown): Wave1GenerationLocale {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace("_", "-");
  if (raw === "pt-pt" || raw === "pt_pt") return "pt";
  if (raw.startsWith("pt-")) return "pt";
  const code = raw.split("-")[0];
  if (isWave1GenerationLocale(code)) return code;
  return "en";
}

export function generationLanguageName(locale: Wave1GenerationLocale): string {
  return GENERATION_LANGUAGE_NAME[locale];
}

export function minimaxLanguageBoost(locale: Wave1GenerationLocale): string {
  return MINIMAX_LANGUAGE_BOOST[locale];
}
