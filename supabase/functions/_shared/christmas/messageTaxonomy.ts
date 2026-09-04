/** Server-owned Christmas Message Generator taxonomy (stable keys). */

export type LocaleCode = "en" | "ro";

export const MESSAGE_RECIPIENTS = [
  { key: "mom", en: "Mom", ro: "Mamă", seoSlug: "mom" },
  { key: "dad", en: "Dad", ro: "Tată", seoSlug: "dad" },
  { key: "wife", en: "Wife", ro: "Soție", seoSlug: "wife" },
  { key: "husband", en: "Husband", ro: "Soț", seoSlug: "husband" },
  { key: "girlfriend", en: "Girlfriend", ro: "Iubită", seoSlug: "girlfriend" },
  { key: "boyfriend", en: "Boyfriend", ro: "Iubit", seoSlug: "boyfriend" },
  { key: "partner", en: "Partner", ro: "Partener(ă)", seoSlug: "partner" },
  { key: "friend", en: "Friend", ro: "Prieten(ă)", seoSlug: "friend" },
  { key: "child", en: "Child", ro: "Copil", seoSlug: "child" },
  { key: "grandma", en: "Grandma", ro: "Bunică", seoSlug: "grandma" },
  { key: "grandpa", en: "Grandpa", ro: "Bunic", seoSlug: "grandpa" },
  { key: "coworker", en: "Coworker", ro: "Coleg(ă)", seoSlug: "coworkers" },
  { key: "boss", en: "Boss", ro: "Șef(ă)", seoSlug: "boss" },
  { key: "customer", en: "Customer", ro: "Client", seoSlug: "customers" },
  { key: "family", en: "Family", ro: "Familie", seoSlug: "family" },
  { key: "other", en: "Someone special", ro: "Cineva special", seoSlug: "someone-special" },
] as const;

export const MESSAGE_TONES = [
  { key: "warm", en: "Warm", ro: "Cald" },
  { key: "funny", en: "Funny", ro: "Amuzant" },
  { key: "romantic", en: "Romantic", ro: "Romantic" },
  { key: "heartfelt", en: "Heartfelt", ro: "Din suflet" },
  { key: "short_and_sweet", en: "Short & sweet", ro: "Scurt și dulce" },
  { key: "professional", en: "Professional", ro: "Profesional" },
  { key: "religious", en: "Religious", ro: "Religios" },
] as const;

export const MESSAGE_LENGTHS = [
  { key: "short", en: "Short", ro: "Scurt", maxChars: 140 },
  { key: "medium", en: "Medium", ro: "Mediu", maxChars: 280 },
  { key: "long", en: "Long", ro: "Lung", maxChars: 520 },
] as const;

export const MESSAGE_RELATIONSHIPS = [
  { key: "family", en: "Family", ro: "Familie" },
  { key: "romantic", en: "Romantic", ro: "Romantic" },
  { key: "friendship", en: "Friendship", ro: "Prietenie" },
  { key: "work", en: "Work", ro: "Serviciu" },
  { key: "other", en: "Other", ro: "Altceva" },
] as const;

/** Future SEO seam: /christmas/messages-for-{slug} — factory NOT built here. */
export const SEO_MESSAGE_RECIPIENT_SLUGS: Record<string, string> = Object.fromEntries(
  MESSAGE_RECIPIENTS.map((r) => [r.key, r.seoSlug]),
);

export const SEO_MESSAGE_INTENT_SLUGS = {
  funny: "funny-christmas-messages",
  romantic: "romantic-christmas-messages",
  professional: "professional-christmas-messages",
  short: "short-christmas-wishes",
  family: "christmas-messages-for-family",
} as const;

export const RECIPIENT_KEYS = new Set(MESSAGE_RECIPIENTS.map((r) => r.key));
export const TONE_KEYS = new Set(MESSAGE_TONES.map((t) => t.key));
export const LENGTH_KEYS = new Set(MESSAGE_LENGTHS.map((l) => l.key));
export const RELATIONSHIP_KEYS = new Set(MESSAGE_RELATIONSHIPS.map((r) => r.key));

export function labelFor(
  list: readonly { key: string; en: string; ro: string }[],
  key: string,
  locale: LocaleCode,
): string {
  const row = list.find((x) => x.key === key);
  if (!row) return key;
  return locale === "ro" ? row.ro : row.en;
}
