/**
 * Central Christmas Gift Finder / Wishlist taxonomy.
 * Stable keys for analytics, SEO factory later, and i18n.
 * Display copy is separate from identifiers.
 */

export type LocaleCode = "en" | "ro" | "de" | "fr" | "es" | "it" | "pt" | "nl" | "pl";

export type Taxon = {
  key: string;
  labelEn: string;
  labelRo: string;
  labels?: Partial<Record<"de" | "fr" | "es" | "it" | "pt" | "nl" | "pl", string>>;
};

export const RECIPIENTS: Taxon[] = [
  {
    key: "mom",
    labelEn: "Mom",
    labelRo: "Mama",
    labels: { de: "Mama", fr: "Maman", es: "Mamá", it: "Mamma", pt: "Mãe", nl: "Mama", pl: "Mama" },
  },
  {
    key: "dad",
    labelEn: "Dad",
    labelRo: "Tata",
    labels: { de: "Papa", fr: "Papa", es: "Papá", it: "Papà", pt: "Pai", nl: "Papa", pl: "Tata" },
  },
  {
    key: "wife",
    labelEn: "Wife",
    labelRo: "Soție",
    labels: { de: "Ehefrau", fr: "Épouse", es: "Esposa", it: "Moglie", pt: "Esposa", nl: "Vrouw", pl: "Żona" },
  },
  {
    key: "husband",
    labelEn: "Husband",
    labelRo: "Soț",
    labels: { de: "Ehemann", fr: "Mari", es: "Esposo", it: "Marito", pt: "Marido", nl: "Man", pl: "Mąż" },
  },
  {
    key: "girlfriend",
    labelEn: "Girlfriend",
    labelRo: "Prietenă",
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
    labelRo: "Prieten",
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
    key: "daughter",
    labelEn: "Daughter",
    labelRo: "Fiică",
    labels: { de: "Tochter", fr: "Fille", es: "Hija", it: "Figlia", pt: "Filha", nl: "Dochter", pl: "Córka" },
  },
  {
    key: "son",
    labelEn: "Son",
    labelRo: "Fiu",
    labels: { de: "Sohn", fr: "Fils", es: "Hijo", it: "Figlio", pt: "Filho", nl: "Zoon", pl: "Syn" },
  },
  {
    key: "teen",
    labelEn: "Teen",
    labelRo: "Adolescent",
    labels: {
      de: "Teenager",
      fr: "Adolescent(e)",
      es: "Adolescente",
      it: "Adolescente",
      pt: "Adolescente",
      nl: "Tiener",
      pl: "Nastolatek",
    },
  },
  {
    key: "child",
    labelEn: "Child",
    labelRo: "Copil",
    labels: {
      de: "Kind",
      fr: "Enfant",
      es: "Niño/a",
      it: "Bambino/a",
      pt: "Criança",
      nl: "Kind",
      pl: "Dziecko",
    },
  },
  {
    key: "grandma",
    labelEn: "Grandma",
    labelRo: "Bunică",
    labels: { de: "Oma", fr: "Grand-mère", es: "Abuela", it: "Nonna", pt: "Avó", nl: "Oma", pl: "Babcia" },
  },
  {
    key: "grandpa",
    labelEn: "Grandpa",
    labelRo: "Bunic",
    labels: { de: "Opa", fr: "Grand-père", es: "Abuelo", it: "Nonno", pt: "Avô", nl: "Opa", pl: "Dziadek" },
  },
  {
    key: "friend",
    labelEn: "Friend",
    labelRo: "Prieten(ă)",
    labels: {
      de: "Freund(in)",
      fr: "Ami(e)",
      es: "Amigo/a",
      it: "Amico/a",
      pt: "Amigo(a)",
      nl: "Vriend(in)",
      pl: "Przyjaciel/Przyjaciółka",
    },
  },
  {
    key: "coworker",
    labelEn: "Coworker",
    labelRo: "Coleg(ă)",
    labels: {
      de: "Kollege/Kollegin",
      fr: "Collègue",
      es: "Compañero/a de trabajo",
      it: "Collega",
      pt: "Colega de trabalho",
      nl: "Collega",
      pl: "Kolega/Koleżanka z pracy",
    },
  },
  {
    key: "teacher",
    labelEn: "Teacher",
    labelRo: "Profesor",
    labels: {
      de: "Lehrer(in)",
      fr: "Enseignant(e)",
      es: "Profesor/a",
      it: "Insegnante",
      pt: "Professor(a)",
      nl: "Leraar/Lerares",
      pl: "Nauczyciel",
    },
  },
  {
    key: "other",
    labelEn: "Someone else",
    labelRo: "Altcineva",
    labels: {
      de: "Jemand anderes",
      fr: "Quelqu'un d'autre",
      es: "Alguien más",
      it: "Qualcun altro",
      pt: "Outra pessoa",
      nl: "Iemand anders",
      pl: "Kto inny",
    },
  },
];

export const RELATIONSHIPS: Taxon[] = [
  {
    key: "close_family",
    labelEn: "Close family",
    labelRo: "Familie apropiată",
    labels: {
      de: "Enge Familie",
      fr: "Famille proche",
      es: "Familia cercana",
      it: "Famiglia stretta",
      pt: "Família próxima",
      nl: "Naaste familie",
      pl: "Najbliższa rodzina",
    },
  },
  {
    key: "partner",
    labelEn: "Romantic partner",
    labelRo: "Partener romantic",
    labels: {
      de: "Romantischer Partner",
      fr: "Partenaire romantique",
      es: "Pareja sentimental",
      it: "Partner romantico",
      pt: "Parceiro romântico",
      nl: "Romantische partner",
      pl: "Partner romantyczny",
    },
  },
  {
    key: "friend",
    labelEn: "Friend",
    labelRo: "Prieten",
    labels: {
      de: "Freund(in)",
      fr: "Ami(e)",
      es: "Amigo/a",
      it: "Amico/a",
      pt: "Amigo(a)",
      nl: "Vriend(in)",
      pl: "Przyjaciel",
    },
  },
  {
    key: "colleague",
    labelEn: "Colleague",
    labelRo: "Coleg",
    labels: {
      de: "Kollege/Kollegin",
      fr: "Collègue",
      es: "Compañero/a",
      it: "Collega",
      pt: "Colega",
      nl: "Collega",
      pl: "Kolega/Koleżanka",
    },
  },
  {
    key: "acquaintance",
    labelEn: "Acquaintance",
    labelRo: "Cunoscut",
    labels: {
      de: "Bekannte(r)",
      fr: "Connaissance",
      es: "Conocido/a",
      it: "Conoscente",
      pt: "Conhecido(a)",
      nl: "Kennis",
      pl: "Znajomy",
    },
  },
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
  {
    key: "tech",
    labelEn: "Tech",
    labelRo: "Tehnologie",
    labels: { de: "Technik", fr: "Technologie", es: "Tecnología", it: "Tecnologia", pt: "Tecnologia", nl: "Technologie", pl: "Technologia" },
  },
  {
    key: "gaming",
    labelEn: "Gaming",
    labelRo: "Gaming",
    labels: { de: "Gaming", fr: "Jeux vidéo", es: "Videojuegos", it: "Videogiochi", pt: "Jogos", nl: "Gaming", pl: "Gry" },
  },
  {
    key: "cooking",
    labelEn: "Cooking",
    labelRo: "Gătit",
    labels: { de: "Kochen", fr: "Cuisine", es: "Cocina", it: "Cucina", pt: "Cozinha", nl: "Koken", pl: "Kuchnia" },
  },
  {
    key: "travel",
    labelEn: "Travel",
    labelRo: "Călătorii",
    labels: { de: "Reisen", fr: "Voyage", es: "Viajes", it: "Viaggi", pt: "Viagens", nl: "Reizen", pl: "Podróże" },
  },
  {
    key: "fitness",
    labelEn: "Fitness",
    labelRo: "Fitness",
    labels: { de: "Fitness", fr: "Fitness", es: "Fitness", it: "Fitness", pt: "Fitness", nl: "Fitness", pl: "Fitness" },
  },
  {
    key: "fashion",
    labelEn: "Fashion",
    labelRo: "Modă",
    labels: { de: "Mode", fr: "Mode", es: "Moda", it: "Moda", pt: "Moda", nl: "Mode", pl: "Moda" },
  },
  {
    key: "beauty",
    labelEn: "Beauty",
    labelRo: "Beauty",
    labels: { de: "Beauty", fr: "Beauté", es: "Belleza", it: "Bellezza", pt: "Beleza", nl: "Beauty", pl: "Uroda" },
  },
  {
    key: "reading",
    labelEn: "Books",
    labelRo: "Cărți",
    labels: { de: "Bücher", fr: "Livres", es: "Libros", it: "Libri", pt: "Livros", nl: "Boeken", pl: "Książki" },
  },
  {
    key: "music",
    labelEn: "Music",
    labelRo: "Muzică",
    labels: { de: "Musik", fr: "Musique", es: "Música", it: "Musica", pt: "Música", nl: "Muziek", pl: "Muzyka" },
  },
  {
    key: "photography",
    labelEn: "Photography",
    labelRo: "Fotografie",
    labels: {
      de: "Fotografie",
      fr: "Photographie",
      es: "Fotografía",
      it: "Fotografia",
      pt: "Fotografia",
      nl: "Fotografie",
      pl: "Fotografia",
    },
  },
  {
    key: "home",
    labelEn: "Home",
    labelRo: "Casă",
    labels: { de: "Zuhause", fr: "Maison", es: "Hogar", it: "Casa", pt: "Casa", nl: "Huis", pl: "Dom" },
  },
  {
    key: "coffee",
    labelEn: "Coffee",
    labelRo: "Cafea",
    labels: { de: "Kaffee", fr: "Café", es: "Café", it: "Caffè", pt: "Café", nl: "Koffie", pl: "Kawa" },
  },
  {
    key: "wine",
    labelEn: "Wine",
    labelRo: "Vin",
    labels: { de: "Wein", fr: "Vin", es: "Vino", it: "Vino", pt: "Vinho", nl: "Wijn", pl: "Wino" },
  },
  {
    key: "cars",
    labelEn: "Cars",
    labelRo: "Mașini",
    labels: { de: "Autos", fr: "Voitures", es: "Coches", it: "Auto", pt: "Carros", nl: "Auto's", pl: "Samochody" },
  },
  {
    key: "outdoors",
    labelEn: "Outdoors",
    labelRo: "Aer liber",
    labels: {
      de: "Outdoor",
      fr: "Plein air",
      es: "Aire libre",
      it: "All'aperto",
      pt: "Ar livre",
      nl: "Buitenleven",
      pl: "Aktywność na świeżym powietrzu",
    },
  },
  {
    key: "art",
    labelEn: "Art",
    labelRo: "Artă",
    labels: { de: "Kunst", fr: "Art", es: "Arte", it: "Arte", pt: "Arte", nl: "Kunst", pl: "Sztuka" },
  },
  {
    key: "pets",
    labelEn: "Pets",
    labelRo: "Animale",
    labels: {
      de: "Haustiere",
      fr: "Animaux de compagnie",
      es: "Mascotas",
      it: "Animali domestici",
      pt: "Animais de estimação",
      nl: "Huisdieren",
      pl: "Zwierzęta domowe",
    },
  },
  {
    key: "sports",
    labelEn: "Sports",
    labelRo: "Sport",
    labels: { de: "Sport", fr: "Sport", es: "Deportes", it: "Sport", pt: "Desporto", nl: "Sport", pl: "Sport" },
  },
  {
    key: "luxury",
    labelEn: "Luxury",
    labelRo: "Lux",
    labels: { de: "Luxus", fr: "Luxe", es: "Lujo", it: "Lusso", pt: "Luxo", nl: "Luxe", pl: "Luksus" },
  },
  {
    key: "diy",
    labelEn: "DIY",
    labelRo: "DIY",
    labels: {
      de: "Heimwerken",
      fr: "Bricolage",
      es: "Manualidades",
      it: "Fai da te",
      pt: "Faça você próprio",
      nl: "Doe-het-zelf",
      pl: "Zrób to sam",
    },
  },
  {
    key: "gardening",
    labelEn: "Gardening",
    labelRo: "Grădinărit",
    labels: {
      de: "Gartenarbeit",
      fr: "Jardinage",
      es: "Jardinería",
      it: "Giardinaggio",
      pt: "Jardinagem",
      nl: "Tuinieren",
      pl: "Ogrodnictwo",
    },
  },
  {
    key: "movies",
    labelEn: "Movies",
    labelRo: "Filme",
    labels: { de: "Filme", fr: "Films", es: "Películas", it: "Film", pt: "Filmes", nl: "Films", pl: "Filmy" },
  },
  {
    key: "wellness",
    labelEn: "Wellness",
    labelRo: "Wellness",
    labels: {
      de: "Wellness",
      fr: "Bien-être",
      es: "Bienestar",
      it: "Benessere",
      pt: "Bem-estar",
      nl: "Wellness",
      pl: "Wellness",
    },
  },
];

export const PERSONALITIES: Taxon[] = [
  {
    key: "practical",
    labelEn: "Practical",
    labelRo: "Practic",
    labels: { de: "Praktisch", fr: "Pratique", es: "Práctico", it: "Pratico", pt: "Prático", nl: "Praktisch", pl: "Praktyczny" },
  },
  {
    key: "sentimental",
    labelEn: "Sentimental",
    labelRo: "Sentimental",
    labels: {
      de: "Sentimental",
      fr: "Sentimental(e)",
      es: "Sentimental",
      it: "Sentimentale",
      pt: "Sentimental",
      nl: "Sentimenteel",
      pl: "Sentymentalny",
    },
  },
  {
    key: "funny",
    labelEn: "Funny",
    labelRo: "Amuzant",
    labels: { de: "Lustig", fr: "Drôle", es: "Divertido", it: "Divertente", pt: "Divertido", nl: "Grappig", pl: "Zabawny" },
  },
  {
    key: "minimalist",
    labelEn: "Minimalist",
    labelRo: "Minimalist",
    labels: {
      de: "Minimalistisch",
      fr: "Minimaliste",
      es: "Minimalista",
      it: "Minimalista",
      pt: "Minimalista",
      nl: "Minimalistisch",
      pl: "Minimalistyczny",
    },
  },
  {
    key: "adventurous",
    labelEn: "Adventurous",
    labelRo: "Aventuros",
    labels: {
      de: "Abenteuerlustig",
      fr: "Aventureux",
      es: "Aventurero",
      it: "Avventuroso",
      pt: "Aventureiro",
      nl: "Avontuurlijk",
      pl: "Lubiący przygody",
    },
  },
  {
    key: "creative",
    labelEn: "Creative",
    labelRo: "Creativ",
    labels: { de: "Kreativ", fr: "Créatif", es: "Creativo", it: "Creativo", pt: "Criativo", nl: "Creatief", pl: "Kreatywny" },
  },
  {
    key: "tech_loving",
    labelEn: "Tech-loving",
    labelRo: "Iubește tech",
    labels: {
      de: "Technikbegeistert",
      fr: "Passionné de technologie",
      es: "Amante de la tecnología",
      it: "Amante della tecnologia",
      pt: "Apaixonado por tecnologia",
      nl: "Houdt van technologie",
      pl: "Kochający technologię",
    },
  },
  {
    key: "hard_to_buy",
    labelEn: "Hard to buy for",
    labelRo: "Greu de cumpărat",
    labels: {
      de: "Schwer zu beschenken",
      fr: "Difficile à satisfaire",
      es: "Difícil de complacer",
      it: "Difficile da accontentare",
      pt: "Difícil de agradar",
      nl: "Moeilijk om voor te winkelen",
      pl: "Trudny do obdarowania",
    },
  },
  {
    key: "has_everything",
    labelEn: "Has everything",
    labelRo: "Are de toate",
    labels: {
      de: "Hat schon alles",
      fr: "A déjà tout",
      es: "Lo tiene todo",
      it: "Ha già tutto",
      pt: "Já tem tudo",
      nl: "Heeft alles al",
      pl: "Ma już wszystko",
    },
  },
  {
    key: "loves_experiences",
    labelEn: "Loves experiences",
    labelRo: "Iubește experiențele",
    labels: {
      de: "Liebt Erlebnisse",
      fr: "Aime les expériences",
      es: "Ama las experiencias",
      it: "Ama le esperienze",
      pt: "Adora experiências",
      nl: "Houdt van ervaringen",
      pl: "Kocha przeżycia",
    },
  },
  {
    key: "loves_personalized",
    labelEn: "Loves personalized gifts",
    labelRo: "Iubește personalizatul",
    labels: {
      de: "Liebt personalisierte Geschenke",
      fr: "Aime les cadeaux personnalisés",
      es: "Ama los regalos personalizados",
      it: "Ama i regali personalizzati",
      pt: "Adora presentes personalizados",
      nl: "Houdt van gepersonaliseerde cadeaus",
      pl: "Kocha spersonalizowane prezenty",
    },
  },
  {
    key: "luxury_minded",
    labelEn: "Luxury-minded",
    labelRo: "Orientat spre lux",
    labels: {
      de: "Luxusorientiert",
      fr: "Attiré par le luxe",
      es: "Con mentalidad de lujo",
      it: "Orientato al lusso",
      pt: "Com gosto por luxo",
      nl: "Op luxe gericht",
      pl: "Ceniący luksus",
    },
  },
];

export const BUDGETS: Taxon[] = [
  {
    key: "under_25",
    labelEn: "Under $25",
    labelRo: "Sub 100 RON",
    labels: {
      de: "Unter 25 $",
      fr: "Moins de 25 $",
      es: "Menos de 25 $",
      it: "Meno di 25 $",
      pt: "Menos de 25 $",
      nl: "Onder 25 $",
      pl: "Poniżej 25 $",
    },
  },
  {
    key: "25_50",
    labelEn: "$25–$50",
    labelRo: "100–250 RON",
    labels: { de: "25–50 $", fr: "25–50 $", es: "25–50 $", it: "25–50 $", pt: "25–50 $", nl: "25–50 $", pl: "25–50 $" },
  },
  {
    key: "50_100",
    labelEn: "$50–$100",
    labelRo: "250–500 RON",
    labels: { de: "50–100 $", fr: "50–100 $", es: "50–100 $", it: "50–100 $", pt: "50–100 $", nl: "50–100 $", pl: "50–100 $" },
  },
  {
    key: "100_200",
    labelEn: "$100–$200",
    labelRo: "500–1000 RON",
    labels: {
      de: "100–200 $",
      fr: "100–200 $",
      es: "100–200 $",
      it: "100–200 $",
      pt: "100–200 $",
      nl: "100–200 $",
      pl: "100–200 $",
    },
  },
  {
    key: "100_250",
    labelEn: "$100–$250",
    labelRo: "500–1250 RON",
    labels: {
      de: "100–250 $",
      fr: "100–250 $",
      es: "100–250 $",
      it: "100–250 $",
      pt: "100–250 $",
      nl: "100–250 $",
      pl: "100–250 $",
    },
  },
  {
    key: "200_plus",
    labelEn: "$200+",
    labelRo: "1000+ RON",
    labels: {
      de: "Über 200 $",
      fr: "Plus de 200 $",
      es: "Más de 200 $",
      it: "Oltre 200 $",
      pt: "Mais de 200 $",
      nl: "Meer dan 200 $",
      pl: "Powyżej 200 $",
    },
  },
  {
    key: "250_plus",
    labelEn: "$250+",
    labelRo: "1250+ RON",
    labels: {
      de: "Über 250 $",
      fr: "Plus de 250 $",
      es: "Más de 250 $",
      it: "Oltre 250 $",
      pt: "Mais de 250 $",
      nl: "Meer dan 250 $",
      pl: "Powyżej 250 $",
    },
  },
  {
    key: "flexible",
    labelEn: "No strict budget",
    labelRo: "Fără buget strict",
    labels: {
      de: "Kein festes Budget",
      fr: "Pas de budget strict",
      es: "Sin presupuesto estricto",
      it: "Nessun budget rigido",
      pt: "Sem orçamento fixo",
      nl: "Geen strikt budget",
      pl: "Bez ustalonego budżetu",
    },
  },
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
  {
    key: "best_match",
    labelEn: "Best Match",
    labelRo: "Cea mai potrivită",
    labels: {
      de: "Beste Wahl",
      fr: "Meilleur choix",
      es: "Mejor opción",
      it: "Scelta migliore",
      pt: "Melhor escolha",
      nl: "Beste keuze",
      pl: "Najlepszy wybór",
    },
  },
  {
    key: "safe_choice",
    labelEn: "Safe Choice",
    labelRo: "Alegere sigură",
    labels: {
      de: "Sichere Wahl",
      fr: "Choix sûr",
      es: "Opción segura",
      it: "Scelta sicura",
      pt: "Escolha segura",
      nl: "Veilige keuze",
      pl: "Bezpieczny wybór",
    },
  },
  {
    key: "meaningful",
    labelEn: "Meaningful Choice",
    labelRo: "Alegere cu sens",
    labels: {
      de: "Bedeutungsvolle Wahl",
      fr: "Choix significatif",
      es: "Opción significativa",
      it: "Scelta significativa",
      pt: "Escolha significativa",
      nl: "Betekenisvolle keuze",
      pl: "Wybór z sensem",
    },
  },
  {
    key: "experience",
    labelEn: "Experience Choice",
    labelRo: "Experiență",
    labels: {
      de: "Erlebnis-Wahl",
      fr: "Choix d'expérience",
      es: "Opción de experiencia",
      it: "Scelta esperienziale",
      pt: "Escolha de experiência",
      nl: "Ervaringskeuze",
      pl: "Wybór doświadczenia",
    },
  },
  {
    key: "unexpected",
    labelEn: "Unexpected Choice",
    labelRo: "Surpriză",
    labels: {
      de: "Überraschende Wahl",
      fr: "Choix inattendu",
      es: "Opción inesperada",
      it: "Scelta inaspettata",
      pt: "Escolha inesperada",
      nl: "Onverwachte keuze",
      pl: "Nieoczekiwany wybór",
    },
  },
];

export const REFINEMENT_OPTIONS: Taxon[] = [
  {
    key: "more_personal",
    labelEn: "More personal",
    labelRo: "Mai personal",
    labels: {
      de: "Persönlicher",
      fr: "Plus personnel",
      es: "Más personal",
      it: "Più personale",
      pt: "Mais pessoal",
      nl: "Persoonlijker",
      pl: "Bardziej osobisty",
    },
  },
  {
    key: "more_practical",
    labelEn: "More practical",
    labelRo: "Mai practic",
    labels: {
      de: "Praktischer",
      fr: "Plus pratique",
      es: "Más práctico",
      it: "Più pratico",
      pt: "Mais prático",
      nl: "Praktischer",
      pl: "Bardziej praktyczny",
    },
  },
  {
    key: "more_unique",
    labelEn: "More unique",
    labelRo: "Mai unic",
    labels: {
      de: "Einzigartiger",
      fr: "Plus unique",
      es: "Más único",
      it: "Più unico",
      pt: "Mais único",
      nl: "Unieker",
      pl: "Bardziej unikalny",
    },
  },
  {
    key: "cheaper",
    labelEn: "Cheaper",
    labelRo: "Mai ieftin",
    labels: {
      de: "Günstiger",
      fr: "Moins cher",
      es: "Más económico",
      it: "Più economico",
      pt: "Mais barato",
      nl: "Goedkoper",
      pl: "Tańszy",
    },
  },
  {
    key: "more_premium",
    labelEn: "More premium",
    labelRo: "Mai premium",
    labels: {
      de: "Hochwertiger",
      fr: "Plus premium",
      es: "Más premium",
      it: "Più premium",
      pt: "Mais premium",
      nl: "Meer premium",
      pl: "Bardziej premium",
    },
  },
];

export const WISHLIST_PRIORITIES: Taxon[] = [
  {
    key: "really_want",
    labelEn: "Really want this",
    labelRo: "Chiar îmi doresc",
    labels: {
      de: "Will ich wirklich",
      fr: "Je le veux vraiment",
      es: "Lo deseo de verdad",
      it: "Lo desidero davvero",
      pt: "Quero mesmo isto",
      nl: "Wil ik echt",
      pl: "Bardzo tego chcę",
    },
  },
  {
    key: "would_love",
    labelEn: "Would love this",
    labelRo: "Mi-ar plăcea mult",
    labels: {
      de: "Würde ich lieben",
      fr: "J’aimerais beaucoup",
      es: "Me encantaría",
      it: "Mi piacerebbe molto",
      pt: "Adoraria isto",
      nl: "Zou ik geweldig vinden",
      pl: "Bardzo bym chciał(a)",
    },
  },
  {
    key: "nice_to_have",
    labelEn: "Nice to have",
    labelRo: "Ar fi drăguț",
    labels: {
      de: "Wäre schön",
      fr: "Ce serait sympa",
      es: "Estaría bien",
      it: "Sarebbe carino",
      pt: "Seria bom ter",
      nl: "Leuk om te hebben",
      pl: "Miło mieć",
    },
  },
  {
    key: "surprise_me",
    labelEn: "Surprise me",
    labelRo: "Surprinde-mă",
    labels: {
      de: "Überrasch mich",
      fr: "Surprenez-moi",
      es: "Sorpréndeme",
      it: "Sorprendimi",
      pt: "Surpreenda-me",
      nl: "Verras me",
      pl: "Zaskocz mnie",
    },
  },
];

export const WISHLIST_AUDIENCES: Taxon[] = [
  {
    key: "me",
    labelEn: "Me",
    labelRo: "Pentru mine",
    labels: {
      de: "Für mich",
      fr: "Pour moi",
      es: "Para mí",
      it: "Per me",
      pt: "Para mim",
      nl: "Voor mij",
      pl: "Dla mnie",
    },
  },
  {
    key: "child",
    labelEn: "My child",
    labelRo: "Copilul meu",
    labels: {
      de: "Mein Kind",
      fr: "Mon enfant",
      es: "Mi hijo",
      it: "Mio figlio",
      pt: "O meu filho",
      nl: "Mijn kind",
      pl: "Moje dziecko",
    },
  },
  {
    key: "family",
    labelEn: "My family",
    labelRo: "Familia mea",
    labels: {
      de: "Meine Familie",
      fr: "Ma famille",
      es: "Mi familia",
      it: "La mia famiglia",
      pt: "A minha família",
      nl: "Mijn gezin",
      pl: "Moja rodzina",
    },
  },
  {
    key: "someone_else",
    labelEn: "Someone else",
    labelRo: "Altcineva",
    labels: {
      de: "Jemand anderes",
      fr: "Quelqu’un d’autre",
      es: "Alguien más",
      it: "Qualcun altro",
      pt: "Outra pessoa",
      nl: "Iemand anders",
      pl: "Ktoś inny",
    },
  },
];

export const PRIORITY_EMOJI: Record<string, string> = {
  really_want: "❤️",
  would_love: "⭐",
  nice_to_have: "🎁",
  surprise_me: "✨",
};

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
export const AUDIENCE_KEYS = keySet(WISHLIST_AUDIENCES);

export function labelFor(items: Taxon[], key: string, locale: LocaleCode): string {
  const hit = items.find((i) => i.key === key);
  if (!hit) return key;
  if (locale === "en") return hit.labelEn;
  if (locale === "ro") return hit.labelRo;
  return hit.labels?.[locale] || hit.labelEn;
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
