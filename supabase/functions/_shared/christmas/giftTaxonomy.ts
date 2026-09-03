/**
 * Central Christmas Gift Finder / Wishlist taxonomy.
 * Stable keys for analytics, SEO factory later, and i18n.
 * Display copy is separate from identifiers.
 */

export type LocaleCode = "en" | "ro";

export type Taxon = { key: string; labelEn: string; labelRo: string };

export const RECIPIENTS: Taxon[] = [
  { key: "mom", labelEn: "Mom", labelRo: "Mama" },
  { key: "dad", labelEn: "Dad", labelRo: "Tata" },
  { key: "partner", labelEn: "Partner", labelRo: "Partener(ă)" },
  { key: "friend", labelEn: "Friend", labelRo: "Prieten(ă)" },
  { key: "child", labelEn: "Child", labelRo: "Copil" },
  { key: "coworker", labelEn: "Coworker", labelRo: "Coleg(ă)" },
  { key: "grandparent", labelEn: "Grandparent", labelRo: "Bunic/Bunică" },
  { key: "other", labelEn: "Other", labelRo: "Altceva" },
];

export const RELATIONSHIPS: Taxon[] = [
  { key: "close_family", labelEn: "Close family", labelRo: "Familie apropiată" },
  { key: "partner", labelEn: "Romantic partner", labelRo: "Partener romantic" },
  { key: "friend", labelEn: "Friend", labelRo: "Prieten" },
  { key: "colleague", labelEn: "Colleague", labelRo: "Coleg" },
  { key: "acquaintance", labelEn: "Acquaintance", labelRo: "Cunoscut" },
];

export const AGE_RANGES: Taxon[] = [
  { key: "0_5", labelEn: "0–5", labelRo: "0–5" },
  { key: "6_12", labelEn: "6–12", labelRo: "6–12" },
  { key: "13_17", labelEn: "13–17", labelRo: "13–17" },
  { key: "18_24", labelEn: "18–24", labelRo: "18–24" },
  { key: "25_34", labelEn: "25–34", labelRo: "25–34" },
  { key: "35_44", labelEn: "35–44", labelRo: "35–44" },
  { key: "45_54", labelEn: "45–54", labelRo: "45–54" },
  { key: "55_64", labelEn: "55–64", labelRo: "55–64" },
  { key: "65_plus", labelEn: "65+", labelRo: "65+" },
];

export const INTERESTS: Taxon[] = [
  { key: "cooking", labelEn: "Cooking", labelRo: "Gătit" },
  { key: "gardening", labelEn: "Gardening", labelRo: "Grădinărit" },
  { key: "reading", labelEn: "Reading", labelRo: "Citit" },
  { key: "tech", labelEn: "Tech", labelRo: "Tehnologie" },
  { key: "sports", labelEn: "Sports", labelRo: "Sport" },
  { key: "music", labelEn: "Music", labelRo: "Muzică" },
  { key: "art", labelEn: "Art", labelRo: "Artă" },
  { key: "travel", labelEn: "Travel", labelRo: "Călătorii" },
  { key: "pets", labelEn: "Pets", labelRo: "Animale" },
  { key: "fashion", labelEn: "Fashion", labelRo: "Modă" },
  { key: "gaming", labelEn: "Gaming", labelRo: "Gaming" },
  { key: "outdoors", labelEn: "Outdoors", labelRo: "Aer liber" },
  { key: "coffee", labelEn: "Coffee", labelRo: "Cafea" },
  { key: "wellness", labelEn: "Wellness", labelRo: "Wellness" },
];

export const BUDGETS: Taxon[] = [
  { key: "under_25", labelEn: "Under $25", labelRo: "Sub 100 RON" },
  { key: "25_50", labelEn: "$25–50", labelRo: "100–250 RON" },
  { key: "50_100", labelEn: "$50–100", labelRo: "250–500 RON" },
  { key: "100_250", labelEn: "$100–250", labelRo: "500–1250 RON" },
  { key: "250_plus", labelEn: "$250+", labelRo: "1250+ RON" },
];

export const GIFT_TYPES: Taxon[] = [
  { key: "physical", labelEn: "Physical", labelRo: "Fizic" },
  { key: "digital", labelEn: "Digital", labelRo: "Digital" },
  { key: "experience", labelEn: "Experience", labelRo: "Experiență" },
  { key: "either", labelEn: "Either", labelRo: "Oricare" },
];

export const VIBES: Taxon[] = [
  { key: "cozy", labelEn: "Cozy", labelRo: "Cald / cozy" },
  { key: "practical", labelEn: "Practical", labelRo: "Practic" },
  { key: "sentimental", labelEn: "Sentimental", labelRo: "Sentimental" },
  { key: "fun", labelEn: "Fun", labelRo: "Distractiv" },
  { key: "luxurious", labelEn: "A little luxurious", labelRo: "Un pic de lux" },
];

export const WISHLIST_PRIORITIES: Taxon[] = [
  { key: "would_love", labelEn: "Would love", labelRo: "Mi-ar plăcea mult" },
  { key: "nice_to_have", labelEn: "Nice to have", labelRo: "Ar fi drăguț" },
  { key: "surprise_me", labelEn: "Surprise me", labelRo: "Surprinde-mă" },
];

const keySet = (items: Taxon[]) => new Set(items.map((i) => i.key));

export const RECIPIENT_KEYS = keySet(RECIPIENTS);
export const RELATIONSHIP_KEYS = keySet(RELATIONSHIPS);
export const AGE_RANGE_KEYS = keySet(AGE_RANGES);
export const INTEREST_KEYS = keySet(INTERESTS);
export const BUDGET_KEYS = keySet(BUDGETS);
export const GIFT_TYPE_KEYS = keySet(GIFT_TYPES);
export const VIBE_KEYS = keySet(VIBES);
export const PRIORITY_KEYS = keySet(WISHLIST_PRIORITIES);

export function labelFor(items: Taxon[], key: string, locale: LocaleCode): string {
  const hit = items.find((i) => i.key === key);
  if (!hit) return key;
  return locale === "ro" ? hit.labelRo : hit.labelEn;
}

export function budgetRangeUsd(key: string): { min: number; max: number | null } {
  switch (key) {
    case "under_25":
      return { min: 0, max: 25 };
    case "25_50":
      return { min: 25, max: 50 };
    case "50_100":
      return { min: 50, max: 100 };
    case "100_250":
      return { min: 100, max: 250 };
    case "250_plus":
      return { min: 250, max: null };
    default:
      return { min: 0, max: null };
  }
}

/** SEO factory can later map these keys to /christmas/gifts-for-{slug}. */
export const SEO_RECIPIENT_SLUGS: Record<string, string> = {
  mom: "mom",
  dad: "dad",
  partner: "partner",
  friend: "friend",
  child: "kids",
  coworker: "coworkers",
  grandparent: "grandparents",
};
