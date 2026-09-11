/**
 * Shared Wave 1 Christmas generation locale contract (client).
 * Aligns URL prefix, htmlLang, and generation language names for prompts.
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

/** Human language name for LLM prompts (pt = European Portuguese). */
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

export function isWave1GenerationLocale(value: unknown): value is Wave1GenerationLocale {
  return typeof value === "string" && SET.has(value);
}

/** Normalize arbitrary client locale → Wave 1 code or en. */
export function normalizeWave1GenerationLocale(value: unknown): Wave1GenerationLocale {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace("_", "-");
  if (raw === "pt-pt" || raw === "pt_pt") return "pt";
  if (raw.startsWith("pt-")) return "pt"; // refuse pt-BR drift into BR generation
  const code = raw.split("-")[0];
  if (isWave1GenerationLocale(code)) return code;
  return "en";
}

export function generationLanguageName(locale: Wave1GenerationLocale): string {
  return GENERATION_LANGUAGE_NAME[locale];
}

/**
 * Preferred Santa TTS provider per locale (P3E QA).
 * Keep in sync with supabase/functions/_shared/christmas/wave1Locale.ts
 */
export const SANTA_PREFERRED_TTS: Record<Wave1GenerationLocale, "openai" | "replicate"> = {
  en: "openai",
  ro: "replicate",
  de: "replicate",
  fr: "replicate",
  es: "replicate",
  it: "replicate",
  pt: "replicate",
  nl: "replicate",
  pl: "replicate",
};

export function preferredSantaTtsProvider(
  locale: Wave1GenerationLocale,
): "openai" | "replicate" {
  return SANTA_PREFERRED_TTS[locale];
}
