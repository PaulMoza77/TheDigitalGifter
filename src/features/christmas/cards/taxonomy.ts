/** Client message + card taxonomy — stable keys for UI, analytics, SEO. */

export type LocaleCode = "en" | "ro" | "de" | "fr" | "es" | "it" | "pt" | "nl" | "pl";

type Wave1LabelMap = Partial<Record<"de" | "fr" | "es" | "it" | "pt" | "nl" | "pl", string>>;

type LabeledTaxon = {
  key: string;
  en: string;
  ro: string;
  labels?: Wave1LabelMap;
};

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
  {
    key: "mom",
    labelEn: "Mom",
    labelRo: "Mamă",
    en: "Mom",
    ro: "Mamă",
    seoSlug: "mom",
    labels: { de: "Mama", fr: "Maman", es: "Mamá", it: "Mamma", pt: "Mãe", nl: "Mama", pl: "Mama" },
  },
  {
    key: "dad",
    labelEn: "Dad",
    labelRo: "Tată",
    en: "Dad",
    ro: "Tată",
    seoSlug: "dad",
    labels: { de: "Papa", fr: "Papa", es: "Papá", it: "Papà", pt: "Pai", nl: "Papa", pl: "Tata" },
  },
  {
    key: "wife",
    labelEn: "Wife",
    labelRo: "Soție",
    en: "Wife",
    ro: "Soție",
    seoSlug: "wife",
    labels: { de: "Ehefrau", fr: "Épouse", es: "Esposa", it: "Moglie", pt: "Esposa", nl: "Vrouw", pl: "Żona" },
  },
  {
    key: "husband",
    labelEn: "Husband",
    labelRo: "Soț",
    en: "Husband",
    ro: "Soț",
    seoSlug: "husband",
    labels: { de: "Ehemann", fr: "Mari", es: "Esposo", it: "Marito", pt: "Marido", nl: "Man", pl: "Mąż" },
  },
  {
    key: "girlfriend",
    labelEn: "Girlfriend",
    labelRo: "Iubită",
    en: "Girlfriend",
    ro: "Iubită",
    seoSlug: "girlfriend",
    labels: {
      de: "Freundin",
      fr: "Petite amie",
      es: "Novia",
      it: "Fidanzata",
      pt: "Namorada",
      nl: "Vriendin",
      pl: "Dziewczyna",
    },
  },
  {
    key: "boyfriend",
    labelEn: "Boyfriend",
    labelRo: "Iubit",
    en: "Boyfriend",
    ro: "Iubit",
    seoSlug: "boyfriend",
    labels: {
      de: "Freund",
      fr: "Petit ami",
      es: "Novio",
      it: "Fidanzato",
      pt: "Namorado",
      nl: "Vriend",
      pl: "Chłopak",
    },
  },
  {
    key: "partner",
    labelEn: "Partner",
    labelRo: "Partener(ă)",
    en: "Partner",
    ro: "Partener(ă)",
    seoSlug: "partner",
    labels: {
      de: "Partner(in)",
      fr: "Partenaire",
      es: "Pareja",
      it: "Partner",
      pt: "Parceiro(a)",
      nl: "Partner",
      pl: "Partner(ka)",
    },
  },
  {
    key: "friend",
    labelEn: "Friend",
    labelRo: "Prieten(ă)",
    en: "Friend",
    ro: "Prieten(ă)",
    seoSlug: "friend",
    labels: {
      de: "Freund(in)",
      fr: "Ami(e)",
      es: "Amigo/a",
      it: "Amico/a",
      pt: "Amigo(a)",
      nl: "Vriend(in)",
      pl: "Przyjaciel/przyjaciółka",
    },
  },
  {
    key: "child",
    labelEn: "Child",
    labelRo: "Copil",
    en: "Child",
    ro: "Copil",
    seoSlug: "child",
    labels: { de: "Kind", fr: "Enfant", es: "Hijo/a", it: "Figlio/a", pt: "Filho(a)", nl: "Kind", pl: "Dziecko" },
  },
  {
    key: "grandma",
    labelEn: "Grandma",
    labelRo: "Bunică",
    en: "Grandma",
    ro: "Bunică",
    seoSlug: "grandma",
    labels: { de: "Oma", fr: "Grand-mère", es: "Abuela", it: "Nonna", pt: "Avó", nl: "Oma", pl: "Babcia" },
  },
  {
    key: "grandpa",
    labelEn: "Grandpa",
    labelRo: "Bunic",
    en: "Grandpa",
    ro: "Bunic",
    seoSlug: "grandpa",
    labels: { de: "Opa", fr: "Grand-père", es: "Abuelo", it: "Nonno", pt: "Avô", nl: "Opa", pl: "Dziadek" },
  },
  {
    key: "coworker",
    labelEn: "Coworker",
    labelRo: "Coleg(ă)",
    en: "Coworker",
    ro: "Coleg(ă)",
    seoSlug: "coworkers",
    labels: {
      de: "Kollege/Kollegin",
      fr: "Collègue",
      es: "Compañero/a",
      it: "Collega",
      pt: "Colega",
      nl: "Collega",
      pl: "Współpracownik(czka)",
    },
  },
  {
    key: "boss",
    labelEn: "Boss",
    labelRo: "Șef(ă)",
    en: "Boss",
    ro: "Șef(ă)",
    seoSlug: "boss",
    labels: {
      de: "Chef(in)",
      fr: "Patron(ne)",
      es: "Jefe/a",
      it: "Capo/a",
      pt: "Chefe",
      nl: "Baas",
      pl: "Szef(owa)",
    },
  },
  {
    key: "customer",
    labelEn: "Customer",
    labelRo: "Client",
    en: "Customer",
    ro: "Client",
    seoSlug: "customers",
    labels: {
      de: "Kunde/Kundin",
      fr: "Client(e)",
      es: "Cliente",
      it: "Cliente",
      pt: "Cliente",
      nl: "Klant",
      pl: "Klient",
    },
  },
  {
    key: "family",
    labelEn: "Family",
    labelRo: "Familie",
    en: "Family",
    ro: "Familie",
    seoSlug: "family",
    labels: { de: "Familie", fr: "Famille", es: "Familia", it: "Famiglia", pt: "Família", nl: "Familie", pl: "Rodzina" },
  },
  {
    key: "other",
    labelEn: "Someone special",
    labelRo: "Cineva special",
    en: "Someone special",
    ro: "Cineva special",
    seoSlug: "someone-special",
    labels: {
      de: "Jemand Besonderes",
      fr: "Quelqu’un de spécial",
      es: "Alguien especial",
      it: "Qualcuno di speciale",
      pt: "Alguém especial",
      nl: "Iemand speciaals",
      pl: "Ktoś wyjątkowy",
    },
  },
] as const;

export const TONES = [
  {
    key: "warm",
    labelEn: "Warm",
    labelRo: "Cald",
    en: "Warm",
    ro: "Cald",
    labels: { de: "Warm", fr: "Chaleureux", es: "Cálido", it: "Caloroso", pt: "Acolhedor", nl: "Warm", pl: "Ciepły" },
  },
  {
    key: "funny",
    labelEn: "Funny",
    labelRo: "Amuzant",
    en: "Funny",
    ro: "Amuzant",
    labels: { de: "Lustig", fr: "Drôle", es: "Divertido", it: "Divertente", pt: "Engraçado", nl: "Grappig", pl: "Zabawny" },
  },
  {
    key: "romantic",
    labelEn: "Romantic",
    labelRo: "Romantic",
    en: "Romantic",
    ro: "Romantic",
    labels: {
      de: "Romantisch",
      fr: "Romantique",
      es: "Romántico",
      it: "Romantico",
      pt: "Romântico",
      nl: "Romantisch",
      pl: "Romantyczny",
    },
  },
  {
    key: "heartfelt",
    labelEn: "Heartfelt",
    labelRo: "Din suflet",
    en: "Heartfelt",
    ro: "Din suflet",
    labels: {
      de: "Von Herzen",
      fr: "Sincère",
      es: "De corazón",
      it: "Di cuore",
      pt: "Do coração",
      nl: "Van harte",
      pl: "Z serca",
    },
  },
  {
    key: "short_and_sweet",
    labelEn: "Short & sweet",
    labelRo: "Scurt și dulce",
    en: "Short & sweet",
    ro: "Scurt și dulce",
    labels: {
      de: "Kurz & süß",
      fr: "Court et doux",
      es: "Corto y dulce",
      it: "Breve e dolce",
      pt: "Curto e doce",
      nl: "Kort & lief",
      pl: "Krótko i słodko",
    },
  },
  {
    key: "professional",
    labelEn: "Professional",
    labelRo: "Profesional",
    en: "Professional",
    ro: "Profesional",
    labels: {
      de: "Professionell",
      fr: "Professionnel",
      es: "Profesional",
      it: "Professionale",
      pt: "Profissional",
      nl: "Professioneel",
      pl: "Profesjonalny",
    },
  },
  {
    key: "religious",
    labelEn: "Religious",
    labelRo: "Religios",
    en: "Religious",
    ro: "Religios",
    labels: {
      de: "Religiös",
      fr: "Religieux",
      es: "Religioso",
      it: "Religioso",
      pt: "Religioso",
      nl: "Religieus",
      pl: "Religijny",
    },
  },
] as const;

export const LENGTHS = [
  {
    key: "short",
    labelEn: "Short",
    labelRo: "Scurt",
    en: "Short",
    ro: "Scurt",
    maxChars: 140,
    labels: { de: "Kurz", fr: "Court", es: "Corto", it: "Breve", pt: "Curto", nl: "Kort", pl: "Krótki" },
  },
  {
    key: "medium",
    labelEn: "Medium",
    labelRo: "Mediu",
    en: "Medium",
    ro: "Mediu",
    maxChars: 280,
    labels: { de: "Mittel", fr: "Moyen", es: "Medio", it: "Medio", pt: "Médio", nl: "Gemiddeld", pl: "Średni" },
  },
  {
    key: "long",
    labelEn: "Long",
    labelRo: "Lung",
    en: "Long",
    ro: "Lung",
    maxChars: 520,
    labels: { de: "Lang", fr: "Long", es: "Largo", it: "Lungo", pt: "Longo", nl: "Lang", pl: "Długi" },
  },
] as const;

export const MESSAGE_RELATIONSHIPS = [
  {
    key: "family",
    en: "Family",
    ro: "Familie",
    labelEn: "Family",
    labelRo: "Familie",
    labels: { de: "Familie", fr: "Famille", es: "Familia", it: "Famiglia", pt: "Família", nl: "Familie", pl: "Rodzina" },
  },
  {
    key: "romantic",
    en: "Romantic",
    ro: "Romantic",
    labelEn: "Romantic",
    labelRo: "Romantic",
    labels: {
      de: "Romantisch",
      fr: "Romantique",
      es: "Romántico",
      it: "Romantico",
      pt: "Romântico",
      nl: "Romantisch",
      pl: "Romantyczny",
    },
  },
  {
    key: "friendship",
    en: "Friendship",
    ro: "Prietenie",
    labelEn: "Friendship",
    labelRo: "Prietenie",
    labels: {
      de: "Freundschaft",
      fr: "Amitié",
      es: "Amistad",
      it: "Amicizia",
      pt: "Amizade",
      nl: "Vriendschap",
      pl: "Przyjaźń",
    },
  },
  {
    key: "work",
    en: "Work",
    ro: "Serviciu",
    labelEn: "Work",
    labelRo: "Serviciu",
    labels: { de: "Arbeit", fr: "Travail", es: "Trabajo", it: "Lavoro", pt: "Trabalho", nl: "Werk", pl: "Praca" },
  },
  {
    key: "other",
    en: "Other",
    ro: "Altceva",
    labelEn: "Other",
    labelRo: "Altceva",
    labels: { de: "Sonstiges", fr: "Autre", es: "Otro", it: "Altro", pt: "Outro", nl: "Overig", pl: "Inne" },
  },
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

export function labelFor(list: readonly LabeledTaxon[], key: string, locale: LocaleCode): string {
  const row = list.find((x) => x.key === key);
  if (!row) return key;
  if (locale === "en") return row.en;
  if (locale === "ro") return row.ro;
  return row.labels?.[locale] || row.en;
}

export const messageLabelFor = labelFor;
