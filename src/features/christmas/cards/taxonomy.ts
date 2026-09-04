/** Client message + card taxonomy — stable keys for UI, analytics, SEO. */

export type LocaleCode = "en" | "ro";

export {
  CARD_LAYOUTS,
  CARD_STYLES,
  CARD_STYLE_KEYS,
  CARD_LAYOUT_KEYS,
  getCardStyle,
  findCardStyle,
  getCardLayout,
  wrapTextLines,
  adaptiveFontSize,
  maxLinesForLayout,
  charsPerLineForLayout,
  type CardLayoutKey,
  type CardStyleKey,
  type CardStyleDef,
} from "./cardStyles";

export const RECIPIENTS = [
  { key: "mom", labelEn: "Mom", labelRo: "Mamă", en: "Mom", ro: "Mamă", seoSlug: "mom" },
  { key: "dad", labelEn: "Dad", labelRo: "Tată", en: "Dad", ro: "Tată", seoSlug: "dad" },
  { key: "wife", labelEn: "Wife", labelRo: "Soție", en: "Wife", ro: "Soție", seoSlug: "wife" },
  { key: "husband", labelEn: "Husband", labelRo: "Soț", en: "Husband", ro: "Soț", seoSlug: "husband" },
  { key: "girlfriend", labelEn: "Girlfriend", labelRo: "Iubită", en: "Girlfriend", ro: "Iubită", seoSlug: "girlfriend" },
  { key: "boyfriend", labelEn: "Boyfriend", labelRo: "Iubit", en: "Boyfriend", ro: "Iubit", seoSlug: "boyfriend" },
  { key: "partner", labelEn: "Partner", labelRo: "Partener(ă)", en: "Partner", ro: "Partener(ă)", seoSlug: "partner" },
  { key: "friend", labelEn: "Friend", labelRo: "Prieten(ă)", en: "Friend", ro: "Prieten(ă)", seoSlug: "friend" },
  { key: "child", labelEn: "Child", labelRo: "Copil", en: "Child", ro: "Copil", seoSlug: "child" },
  { key: "grandma", labelEn: "Grandma", labelRo: "Bunică", en: "Grandma", ro: "Bunică", seoSlug: "grandma" },
  { key: "grandpa", labelEn: "Grandpa", labelRo: "Bunic", en: "Grandpa", ro: "Bunic", seoSlug: "grandpa" },
  { key: "coworker", labelEn: "Coworker", labelRo: "Coleg(ă)", en: "Coworker", ro: "Coleg(ă)", seoSlug: "coworkers" },
  { key: "boss", labelEn: "Boss", labelRo: "Șef(ă)", en: "Boss", ro: "Șef(ă)", seoSlug: "boss" },
  { key: "customer", labelEn: "Customer", labelRo: "Client", en: "Customer", ro: "Client", seoSlug: "customers" },
  { key: "family", labelEn: "Family", labelRo: "Familie", en: "Family", ro: "Familie", seoSlug: "family" },
  { key: "other", labelEn: "Someone special", labelRo: "Cineva special", en: "Someone special", ro: "Cineva special", seoSlug: "someone-special" },
] as const;

export const TONES = [
  { key: "warm", labelEn: "Warm", labelRo: "Cald", en: "Warm", ro: "Cald" },
  { key: "funny", labelEn: "Funny", labelRo: "Amuzant", en: "Funny", ro: "Amuzant" },
  { key: "romantic", labelEn: "Romantic", labelRo: "Romantic", en: "Romantic", ro: "Romantic" },
  { key: "heartfelt", labelEn: "Heartfelt", labelRo: "Din suflet", en: "Heartfelt", ro: "Din suflet" },
  { key: "short_and_sweet", labelEn: "Short & sweet", labelRo: "Scurt și dulce", en: "Short & sweet", ro: "Scurt și dulce" },
  { key: "professional", labelEn: "Professional", labelRo: "Profesional", en: "Professional", ro: "Profesional" },
  { key: "religious", labelEn: "Religious", labelRo: "Religios", en: "Religious", ro: "Religios" },
] as const;

export const LENGTHS = [
  { key: "short", labelEn: "Short", labelRo: "Scurt", en: "Short", ro: "Scurt", maxChars: 140 },
  { key: "medium", labelEn: "Medium", labelRo: "Mediu", en: "Medium", ro: "Mediu", maxChars: 280 },
  { key: "long", labelEn: "Long", labelRo: "Lung", en: "Long", ro: "Lung", maxChars: 520 },
] as const;

export const MESSAGE_RELATIONSHIPS = [
  { key: "family", en: "Family", ro: "Familie", labelEn: "Family", labelRo: "Familie" },
  { key: "romantic", en: "Romantic", ro: "Romantic", labelEn: "Romantic", labelRo: "Romantic" },
  { key: "friendship", en: "Friendship", ro: "Prietenie", labelEn: "Friendship", labelRo: "Prietenie" },
  { key: "work", en: "Work", ro: "Serviciu", labelEn: "Work", labelRo: "Serviciu" },
  { key: "other", en: "Other", ro: "Altceva", labelEn: "Other", labelRo: "Altceva" },
] as const;

export const MESSAGE_RECIPIENTS = RECIPIENTS;
export const MESSAGE_TONES = TONES;
export const MESSAGE_LENGTHS = LENGTHS;

export const MAX_CARD_MESSAGE_CHARS = 800;
export const CUSTOM_DETAIL_MAX = 200;

export const SEO_MESSAGE_INTENT_SLUGS = {
  funny: "funny-christmas-messages",
  romantic: "romantic-christmas-messages",
  professional: "professional-christmas-messages",
  short: "short-christmas-wishes",
  family: "christmas-messages-for-family",
} as const;

/** Flat list for SEO factory seam / tests (factory NOT started here). */
export const MESSAGE_SEO_INTENT_SLUGS = [
  "messages-for-mom",
  "messages-for-dad",
  "messages-for-boyfriend",
  "messages-for-girlfriend",
  "messages-for-coworkers",
  "messages-for-customers",
  "funny-christmas-messages",
  "romantic-christmas-messages",
  "professional-christmas-messages",
  "short-christmas-wishes",
  "christmas-messages-for-family",
] as const;

export const SEO_MESSAGE_RECIPIENT_SLUGS: Record<string, string> = Object.fromEntries(
  RECIPIENTS.map((r) => [r.key, r.seoSlug]),
);

export const SEO_MESSAGE_SLUGS = [
  { path: "/christmas/messages-for-mom", slug: "mom" },
  { path: "/christmas/messages-for-dad", slug: "dad" },
  { path: "/christmas/messages-for-boyfriend", slug: "boyfriend" },
  { path: "/christmas/messages-for-girlfriend", slug: "girlfriend" },
  { path: "/christmas/messages-for-coworkers", slug: "coworkers" },
] as const;

export const SEO_INTENT_SLUGS = [
  { path: "/christmas/funny-christmas-messages", slug: "funny" },
  { path: "/christmas/romantic-christmas-messages", slug: "romantic" },
  { path: "/christmas/professional-christmas-messages", slug: "professional" },
] as const;

export function labelFor(
  list: readonly { key: string; en: string; ro: string }[],
  key: string,
  locale: LocaleCode,
): string {
  const row = list.find((x) => x.key === key);
  if (!row) return key;
  return locale === "ro" ? row.ro : row.en;
}

export const messageLabelFor = labelFor;
