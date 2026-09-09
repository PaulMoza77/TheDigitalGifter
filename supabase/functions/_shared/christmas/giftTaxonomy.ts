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
  { key: "wife", labelEn: "Wife", labelRo: "Soție" },
  { key: "husband", labelEn: "Husband", labelRo: "Soț" },
  { key: "girlfriend", labelEn: "Girlfriend", labelRo: "Prietenă" },
  { key: "boyfriend", labelEn: "Boyfriend", labelRo: "Prieten" },
  { key: "partner", labelEn: "Partner", labelRo: "Partener(ă)" },
  { key: "daughter", labelEn: "Daughter", labelRo: "Fiică" },
  { key: "son", labelEn: "Son", labelRo: "Fiu" },
  { key: "teen", labelEn: "Teen", labelRo: "Adolescent" },
  { key: "child", labelEn: "Child", labelRo: "Copil" },
  { key: "grandma", labelEn: "Grandma", labelRo: "Bunică" },
  { key: "grandpa", labelEn: "Grandpa", labelRo: "Bunic" },
  { key: "friend", labelEn: "Friend", labelRo: "Prieten(ă)" },
  { key: "coworker", labelEn: "Coworker", labelRo: "Coleg(ă)" },
  { key: "teacher", labelEn: "Teacher", labelRo: "Profesor" },
  { key: "other", labelEn: "Someone else", labelRo: "Altcineva" },
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
  { key: "6_9", labelEn: "6–9", labelRo: "6–9" },
  { key: "10_12", labelEn: "10–12", labelRo: "10–12" },
  { key: "6_12", labelEn: "6–12", labelRo: "6–12" },
  { key: "13_17", labelEn: "13–17", labelRo: "13–17" },
  { key: "18_24", labelEn: "18–24", labelRo: "18–24" },
  { key: "25_34", labelEn: "25–34", labelRo: "25–34" },
  { key: "35_44", labelEn: "35–44", labelRo: "35–44" },
  { key: "45_54", labelEn: "45–54", labelRo: "45–54" },
  { key: "55_64", labelEn: "55–64", labelRo: "55–64" },
  { key: "65_plus", labelEn: "65+", labelRo: "65+" },
];

/** Preferred age chips shown in the wizard (excludes legacy 6_12). */
export const AGE_RANGE_WIZARD: Taxon[] = AGE_RANGES.filter((a) => a.key !== "6_12");

export const INTERESTS: Taxon[] = [
  { key: "tech", labelEn: "Tech", labelRo: "Tehnologie" },
  { key: "gaming", labelEn: "Gaming", labelRo: "Gaming" },
  { key: "cooking", labelEn: "Cooking", labelRo: "Gătit" },
  { key: "travel", labelEn: "Travel", labelRo: "Călătorii" },
  { key: "fitness", labelEn: "Fitness", labelRo: "Fitness" },
  { key: "fashion", labelEn: "Fashion", labelRo: "Modă" },
  { key: "beauty", labelEn: "Beauty", labelRo: "Beauty" },
  { key: "reading", labelEn: "Books", labelRo: "Cărți" },
  { key: "music", labelEn: "Music", labelRo: "Muzică" },
  { key: "photography", labelEn: "Photography", labelRo: "Fotografie" },
  { key: "home", labelEn: "Home", labelRo: "Casă" },
  { key: "coffee", labelEn: "Coffee", labelRo: "Cafea" },
  { key: "wine", labelEn: "Wine", labelRo: "Vin" },
  { key: "cars", labelEn: "Cars", labelRo: "Mașini" },
  { key: "outdoors", labelEn: "Outdoors", labelRo: "Aer liber" },
  { key: "art", labelEn: "Art", labelRo: "Artă" },
  { key: "pets", labelEn: "Pets", labelRo: "Animale" },
  { key: "sports", labelEn: "Sports", labelRo: "Sport" },
  { key: "luxury", labelEn: "Luxury", labelRo: "Lux" },
  { key: "diy", labelEn: "DIY", labelRo: "DIY" },
  { key: "gardening", labelEn: "Gardening", labelRo: "Grădinărit" },
  { key: "movies", labelEn: "Movies", labelRo: "Filme" },
  { key: "wellness", labelEn: "Wellness", labelRo: "Wellness" },
];

export const PERSONALITIES: Taxon[] = [
  { key: "practical", labelEn: "Practical", labelRo: "Practic" },
  { key: "sentimental", labelEn: "Sentimental", labelRo: "Sentimental" },
  { key: "funny", labelEn: "Funny", labelRo: "Amuzant" },
  { key: "minimalist", labelEn: "Minimalist", labelRo: "Minimalist" },
  { key: "adventurous", labelEn: "Adventurous", labelRo: "Aventuros" },
  { key: "creative", labelEn: "Creative", labelRo: "Creativ" },
  { key: "tech_loving", labelEn: "Tech-loving", labelRo: "Iubește tech" },
  { key: "hard_to_buy", labelEn: "Hard to buy for", labelRo: "Greu de cumpărat" },
  { key: "has_everything", labelEn: "Has everything", labelRo: "Are de toate" },
  { key: "loves_experiences", labelEn: "Loves experiences", labelRo: "Iubește experiențele" },
  { key: "loves_personalized", labelEn: "Loves personalized gifts", labelRo: "Iubește personalizatul" },
  { key: "luxury_minded", labelEn: "Luxury-minded", labelRo: "Orientat spre lux" },
];

export const BUDGETS: Taxon[] = [
  { key: "under_25", labelEn: "Under $25", labelRo: "Sub 100 RON" },
  { key: "25_50", labelEn: "$25–$50", labelRo: "100–250 RON" },
  { key: "50_100", labelEn: "$50–$100", labelRo: "250–500 RON" },
  { key: "100_200", labelEn: "$100–$200", labelRo: "500–1000 RON" },
  { key: "100_250", labelEn: "$100–$250", labelRo: "500–1250 RON" },
  { key: "200_plus", labelEn: "$200+", labelRo: "1000+ RON" },
  { key: "250_plus", labelEn: "$250+", labelRo: "1250+ RON" },
  { key: "flexible", labelEn: "No strict budget", labelRo: "Fără buget strict" },
];

/** Budget chips shown in the wizard (preferred bands). */
export const BUDGET_WIZARD: Taxon[] = BUDGETS.filter((b) =>
  ["under_25", "25_50", "50_100", "100_200", "200_plus", "flexible"].includes(b.key),
);

export const GIFT_TYPES: Taxon[] = [
  { key: "physical", labelEn: "Physical", labelRo: "Fizic" },
  { key: "digital", labelEn: "Digital", labelRo: "Digital" },
  { key: "experience", labelEn: "Experience", labelRo: "Experiență" },
  { key: "either", labelEn: "Either", labelRo: "Oricare" },
];

/** Legacy vibe keys — still validated for older sessions. */
export const VIBES: Taxon[] = [
  { key: "cozy", labelEn: "Cozy", labelRo: "Cald / cozy" },
  { key: "practical", labelEn: "Practical", labelRo: "Practic" },
  { key: "sentimental", labelEn: "Sentimental", labelRo: "Sentimental" },
  { key: "fun", labelEn: "Fun", labelRo: "Distractiv" },
  { key: "luxurious", labelEn: "A little luxurious", labelRo: "Un pic de lux" },
];

export const RANKING_ROLES: Taxon[] = [
  { key: "best_match", labelEn: "Best Match", labelRo: "Cea mai potrivită" },
  { key: "safe_choice", labelEn: "Safe Choice", labelRo: "Alegere sigură" },
  { key: "meaningful", labelEn: "Meaningful Choice", labelRo: "Alegere cu sens" },
  { key: "experience", labelEn: "Experience Choice", labelRo: "Experiență" },
  { key: "unexpected", labelEn: "Unexpected Choice", labelRo: "Surpriză" },
];

export const REFINEMENT_OPTIONS: Taxon[] = [
  { key: "more_personal", labelEn: "More personal", labelRo: "Mai personal" },
  { key: "more_practical", labelEn: "More practical", labelRo: "Mai practic" },
  { key: "more_unique", labelEn: "More unique", labelRo: "Mai unic" },
  { key: "cheaper", labelEn: "Cheaper", labelRo: "Mai ieftin" },
  { key: "more_premium", labelEn: "More premium", labelRo: "Mai premium" },
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
export const PERSONALITY_KEYS = keySet(PERSONALITIES);
export const BUDGET_KEYS = keySet(BUDGETS);
export const GIFT_TYPE_KEYS = keySet(GIFT_TYPES);
export const VIBE_KEYS = keySet(VIBES);
export const RANKING_ROLE_KEYS = keySet(RANKING_ROLES);
export const REFINEMENT_KEYS = keySet(REFINEMENT_OPTIONS);
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
    case "100_200":
      return { min: 100, max: 200 };
    case "100_250":
      return { min: 100, max: 250 };
    case "200_plus":
      return { min: 200, max: null };
    case "250_plus":
      return { min: 250, max: null };
    case "flexible":
      return { min: 0, max: null };
    default:
      return { min: 0, max: null };
  }
}

/** Map multi-select personality → legacy single vibe for DB compatibility. */
export function primaryVibeFromPersonalities(keys: string[]): string | null {
  if (keys.includes("sentimental") || keys.includes("loves_personalized")) return "sentimental";
  if (keys.includes("practical") || keys.includes("minimalist")) return "practical";
  if (keys.includes("funny")) return "fun";
  if (keys.includes("luxury_minded")) return "luxurious";
  if (keys.includes("adventurous") || keys.includes("loves_experiences")) return "cozy";
  if (keys.length) return "cozy";
  return null;
}

/** Future programmatic SEO routes — do not mass-generate pages yet. */
export const SEO_TAXONOMY_LINKS = {
  byRecipient: [
    { slug: "for-mom", recipientKey: "mom", labelEn: "Gifts for Mom", labelRo: "Cadouri pentru mama" },
    { slug: "for-dad", recipientKey: "dad", labelEn: "Gifts for Dad", labelRo: "Cadouri pentru tata" },
    { slug: "for-wife", recipientKey: "wife", labelEn: "Gifts for Wife", labelRo: "Cadouri pentru soție" },
    { slug: "for-husband", recipientKey: "husband", labelEn: "Gifts for Husband", labelRo: "Cadouri pentru soț" },
    { slug: "for-girlfriend", recipientKey: "girlfriend", labelEn: "Gifts for Girlfriend", labelRo: "Cadouri pentru prietenă" },
    { slug: "for-boyfriend", recipientKey: "boyfriend", labelEn: "Gifts for Boyfriend", labelRo: "Cadouri pentru prieten" },
    { slug: "for-kids", recipientKey: "child", labelEn: "Gifts for Kids", labelRo: "Cadouri pentru copii" },
    { slug: "for-teens", recipientKey: "teen", labelEn: "Gifts for Teens", labelRo: "Cadouri pentru adolescenți" },
    { slug: "for-grandparents", recipientKey: "grandma", labelEn: "Gifts for Grandparents", labelRo: "Cadouri pentru bunici" },
    { slug: "for-coworkers", recipientKey: "coworker", labelEn: "Gifts for Coworkers", labelRo: "Cadouri pentru colegi" },
  ],
  byBudget: [
    { slug: "under-25", budgetKey: "under_25", labelEn: "Under $25", labelRo: "Sub 100 RON" },
    { slug: "under-50", budgetKey: "25_50", labelEn: "Under $50", labelRo: "Sub 250 RON" },
    { slug: "under-100", budgetKey: "50_100", labelEn: "Under $100", labelRo: "Sub 500 RON" },
    { slug: "luxury", budgetKey: "200_plus", labelEn: "Luxury Christmas Gifts", labelRo: "Cadouri de lux" },
  ],
  byPersonality: [
    {
      slug: "for-someone-who-has-everything",
      personalityKey: "has_everything",
      labelEn: "For someone who has everything",
      labelRo: "Pentru cine are de toate",
    },
    {
      slug: "for-sentimental-people",
      personalityKey: "sentimental",
      labelEn: "For sentimental people",
      labelRo: "Pentru oameni sentimentali",
    },
    {
      slug: "for-practical-people",
      personalityKey: "practical",
      labelEn: "For practical people",
      labelRo: "Pentru oameni practici",
    },
    { slug: "for-travelers", interestKey: "travel", labelEn: "For travelers", labelRo: "Pentru călători" },
    { slug: "for-gamers", interestKey: "gaming", labelEn: "For gamers", labelRo: "Pentru gameri" },
    { slug: "for-pet-lovers", interestKey: "pets", labelEn: "For pet lovers", labelRo: "Pentru iubitorii de animale" },
  ],
} as const;

export function seoGiftPath(slug: string): string {
  return `/christmas/gifts/${slug}`;
}

/** SEO factory can later map these keys to /christmas/gifts/for-{slug}. */
export const SEO_RECIPIENT_SLUGS: Record<string, string> = {
  mom: "for-mom",
  dad: "for-dad",
  wife: "for-wife",
  husband: "for-husband",
  girlfriend: "for-girlfriend",
  boyfriend: "for-boyfriend",
  partner: "for-partner",
  friend: "for-friend",
  child: "for-kids",
  teen: "for-teens",
  daughter: "for-kids",
  son: "for-kids",
  coworker: "for-coworkers",
  grandma: "for-grandparents",
  grandpa: "for-grandparents",
  teacher: "for-teacher",
};
