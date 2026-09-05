import type { ChristmasLocale } from "../catalog";
import { christmasEn, type ChristmasEnKey } from "./en";
import { christmasRo } from "./ro";
import {
  persistChristmasLocale,
  resolveChristmasLocale,
  translateChristmas,
  type ChristmasDictionary,
} from "./resolveLocale";

export {
  CHRISTMAS_FALLBACK_LOCALE,
  CHRISTMAS_LOCALE_QUERY,
  CHRISTMAS_LOCALE_STORAGE_KEY,
  normalizeChristmasLocale,
  persistChristmasLocale,
  resolveChristmasLocale,
} from "./resolveLocale";
export type { ChristmasEnKey };

const dictionaries = {
  en: christmasEn as unknown as ChristmasDictionary,
  ro: christmasRo as unknown as ChristmasDictionary,
};

export function t(
  locale: ChristmasLocale,
  key: ChristmasEnKey | string,
  vars?: Record<string, string | number>,
): string {
  return translateChristmas(dictionaries, locale, key, vars);
}

export function productName(
  locale: ChristmasLocale,
  productKey: string,
  fallback: string,
): string {
  const key = `product.${productKey}.name`;
  const translated = t(locale, key);
  return translated === key ? fallback : translated;
}

export function productDescription(
  locale: ChristmasLocale,
  productKey: string,
  fallback: string,
): string {
  const key = `product.${productKey}.description`;
  const translated = t(locale, key);
  return translated === key ? fallback : translated;
}

export function setChristmasLocale(locale: ChristmasLocale): ChristmasLocale {
  persistChristmasLocale(locale);
  return locale;
}

/** Build localized delivery email copy (V2 packs). Locale must come from stored order/user — never webhook headers alone. */
export function christmasDeliveryEmailCopy(
  locale: ChristmasLocale,
  input: {
    packKey: "starter" | "magic" | "ultimate";
    packName: string;
    imageCount: number;
    videoCount: number;
  },
): { subject: string; body: string; cta: string; footer: string } {
  const subjectKey =
    input.packKey === "magic"
      ? "email.delivery.magicSubject"
      : input.packKey === "ultimate"
        ? "email.delivery.ultimateSubject"
        : "email.delivery.starterSubject";
  const videoClause =
    input.videoCount > 0
      ? t(locale, "email.delivery.videoClause", {
          videoCount: input.videoCount,
          videoPlural: input.videoCount > 1 ? (locale === "ro" ? "uri" : "s") : "",
        })
      : "";
  return {
    subject: t(locale, subjectKey),
    body: t(locale, "email.delivery.body", {
      packName: input.packName,
      imageCount: input.imageCount,
      videoClause,
    }),
    cta: t(locale, "email.delivery.cta"),
    footer: t(locale, "email.delivery.footer"),
  };
}
