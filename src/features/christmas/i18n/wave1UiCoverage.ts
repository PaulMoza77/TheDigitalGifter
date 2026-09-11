/**
 * Wave 1 Christmas UI translation coverage helpers (P3D).
 *
 * Used by missing-key / English-leak tests for client copy packs.
 * Keep whitelists small — prefer fixing packs over expanding exceptions.
 */

import { WAVE1_GENERATION_LOCALES, type Wave1GenerationLocale } from "./wave1Locale";

/** Wave 1 locales that must not silently fall back to English product UI. */
export const WAVE1_NON_EN_LOCALES = WAVE1_GENERATION_LOCALES.filter(
  (l): l is Exclude<Wave1GenerationLocale, "en"> => l !== "en",
);

/**
 * Exact string values allowed to match English across locales.
 * Brand names, product names, and universal format/unit tokens only.
 */
export const WAVE1_UI_EXACT_WHITELIST = new Set<string>([
  "TheDigitalGifter",
  "The Digital Gifter",
  "WhatsApp",
  "https://…",
  "English",
  "Română",
  // Format / unit tokens (may appear alone or dominate short hints)
  "JPEG",
  "PNG",
  "WebP",
  "MB",
  // Short universal labels that several locales intentionally keep
  "Original",
  "Couple",
  "Couples",
  "Style",
]);

/**
 * Tokens that may appear inside translated strings without counting as an English leak.
 * Do not naive-flag URLs, brand, or these product/format names.
 */
export const WAVE1_UI_TOKEN_WHITELIST = [
  "TheDigitalGifter",
  "The Digital Gifter",
  "WhatsApp",
  "JPEG",
  "PNG",
  "WebP",
  "https://",
  "http://",
] as const;

/**
 * High-risk English UI phrases — whole-string matches indicate an unintended leak
 * on localized product controls (generate / download / share / upload / recipient, etc.).
 */
export const HIGH_RISK_ENGLISH_UI_PHRASES = [
  "Generate messages",
  "Generate different ideas",
  "Download",
  "Share",
  "Upload your photo",
  "Upload Photo",
  "Upload a family photo",
  "Continue",
  "Copy",
  "Copy link",
  "Try again",
  "Save to Wishlist",
  "Find Their Gift",
  "Create My Wishlist",
  "Create My Card",
  "Open Today’s Door",
  "Who is it for?",
  "Who are you shopping for?",
  "Share My Wishlist",
  "Add gift",
  "Save my Christmas Tree",
] as const;

export type CopyBag = Record<string, string>;

/** True when an identical-to-EN value is an intentional brand/universal label. */
export function isAllowedIdenticalFallback(value: string): boolean {
  const trimmed = value.trim();
  if (WAVE1_UI_EXACT_WHITELIST.has(trimmed)) return true;

  // URLs / URL placeholders are not product copy — do not flag as EN leak.
  if (/^https?:\/\//i.test(trimmed)) return true;

  // Placeholders-only / emoji templates (e.g. "{name} 🎄")
  const withoutPlaceholders = trimmed
    .replace(/\{[a-zA-Z0-9_]+\}/g, "")
    .replace(/[\s🎄❤️🎁…·|]/g, "")
    .trim();
  if (withoutPlaceholders.length === 0) return true;

  return false;
}

/** Strip brand / URL / format tokens before English-leak phrase checks. */
export function stripWhitelistedTokens(value: string): string {
  let out = value;
  for (const token of WAVE1_UI_TOKEN_WHITELIST) {
    out = out.split(token).join(" ");
  }
  return out.replace(/\s+/g, " ").trim();
}

export type MissingKeyFailure = {
  pack: string;
  locale: string;
  key: string;
  reason: "missing_pack" | "missing_key" | "en_fallback";
  enValue?: string;
};

/**
 * FAIL when a required product UI key is missing or resolves to unintended EN fallback.
 * Brand / universal whitelist values that intentionally match EN are skipped.
 */
export function findMissingTranslationKeys(
  packName: string,
  packs: Partial<Record<string, CopyBag>>,
  requiredKeys: readonly string[],
  locales: readonly string[] = WAVE1_NON_EN_LOCALES,
): MissingKeyFailure[] {
  const en = packs.en;
  if (!en) {
    return [{ pack: packName, locale: "en", key: "*", reason: "missing_pack" }];
  }

  const failures: MissingKeyFailure[] = [];
  for (const locale of locales) {
    const pack = packs[locale];
    if (!pack) {
      failures.push({ pack: packName, locale, key: "*", reason: "missing_pack" });
      continue;
    }
    for (const key of requiredKeys) {
      const enValue = en[key];
      const value = pack[key];
      if (value == null || value === "") {
        failures.push({ pack: packName, locale, key, reason: "missing_key", enValue });
        continue;
      }
      if (value === enValue && !isAllowedIdenticalFallback(value)) {
        failures.push({ pack: packName, locale, key, reason: "en_fallback", enValue });
      }
    }
  }
  return failures;
}

export type EnglishLeakFailure = {
  pack: string;
  locale: string;
  key: string;
  value: string;
  reason: "equals_en" | "high_risk_phrase";
};

/**
 * Detect high-risk unintended English on known UI keys.
 * Skips URLs, brand tokens, and exact whitelist labels — does not naive-flag CSS ids or names.
 */
export function findEnglishLeaks(
  packName: string,
  packs: Partial<Record<string, CopyBag>>,
  highRiskKeys: readonly string[],
  locales: readonly string[] = WAVE1_NON_EN_LOCALES,
): EnglishLeakFailure[] {
  const en = packs.en;
  if (!en) return [];

  const failures: EnglishLeakFailure[] = [];
  const phraseSet = new Set<string>(HIGH_RISK_ENGLISH_UI_PHRASES.map((p) => p.toLowerCase()));

  for (const locale of locales) {
    const pack = packs[locale];
    if (!pack) continue;

    for (const key of highRiskKeys) {
      const enValue = en[key];
      const value = pack[key];
      if (value == null || value === "" || enValue == null) continue;
      if (isAllowedIdenticalFallback(value)) continue;

      if (value === enValue) {
        failures.push({ pack: packName, locale, key, value, reason: "equals_en" });
        continue;
      }

      const stripped = stripWhitelistedTokens(value);
      if (phraseSet.has(stripped.toLowerCase()) || phraseSet.has(value.trim().toLowerCase())) {
        failures.push({ pack: packName, locale, key, value, reason: "high_risk_phrase" });
      }
    }
  }
  return failures;
}

export function formatCoverageFailures(
  failures: Array<MissingKeyFailure | EnglishLeakFailure>,
): string {
  return failures
    .slice(0, 40)
    .map((f) => {
      if ("reason" in f && (f.reason === "equals_en" || f.reason === "high_risk_phrase")) {
        const leak = f as EnglishLeakFailure;
        return `${leak.pack}/${leak.locale} ${leak.key}: ${leak.reason} → ${JSON.stringify(leak.value)}`;
      }
      const miss = f as MissingKeyFailure;
      return `${miss.pack}/${miss.locale} ${miss.key}: ${miss.reason}${
        miss.enValue != null ? ` (en=${JSON.stringify(miss.enValue).slice(0, 60)})` : ""
      }`;
    })
    .join("\n");
}
