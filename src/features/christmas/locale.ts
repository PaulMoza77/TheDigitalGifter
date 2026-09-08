import { CHRISTMAS_LOCALES, type ChristmasLocale } from "./catalog";

export function normalizeChristmasLocale(
  value: string | null | undefined,
): ChristmasLocale {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (raw === "ro" || raw.startsWith("ro-") || raw.startsWith("ro_")) return "ro";
  return "en";
}

export function isChristmasLocale(value: string | null | undefined): value is ChristmasLocale {
  return (CHRISTMAS_LOCALES as readonly string[]).includes(String(value || ""));
}

/**
 * Checkout locale is captured from explicit hints (URL / html lang / navigator).
 * Never inferred from Stripe or Accept-Language on the webhook path.
 */
export function resolveCheckoutLocaleFromHints(
  hints: Array<string | null | undefined>,
): ChristmasLocale {
  for (const hint of hints) {
    if (!hint) continue;
    const raw = String(hint).trim().toLowerCase();
    if (
      raw === "ro" ||
      raw.startsWith("ro-") ||
      raw.startsWith("ro_") ||
      /(?:^|[?&])(?:locale|lang)=ro(?:-|_|&|$)/i.test(raw)
    ) {
      return "ro";
    }
  }
  return "en";
}

export function checkoutLocaleFromBrowser(): ChristmasLocale {
  if (typeof window === "undefined") return "en";
  const params = new URLSearchParams(window.location.search);
  return resolveCheckoutLocaleFromHints([
    params.get("locale"),
    params.get("lang"),
    document.documentElement.lang,
    navigator.language,
  ]);
}
