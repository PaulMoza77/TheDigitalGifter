import { LANDING_ASSETS } from "../landing/assets";

/** Distinct optimized style-card previews (one image per family style). */
export const FAMILY_STYLE_PREVIEWS = {
  classic_family_christmas: "/assets/christmas/style-previews/classic-family-christmas.webp",
  family_cozy_fireplace: "/assets/christmas/style-previews/cozy-fireplace.webp",
  family_winter_wonderland: "/assets/christmas/style-previews/winter-wonderland.webp",
  family_elegant_christmas: "/assets/christmas/style-previews/elegant-christmas.webp",
  family_christmas_morning: "/assets/christmas/style-previews/christmas-morning.webp",
  family_luxury_christmas: "/assets/christmas/style-previews/luxury-christmas.webp",
  family_christmas_movie: "/assets/christmas/style-previews/christmas-movie.webp",
  family_vintage_christmas: "/assets/christmas/style-previews/vintage-family-christmas.webp",
} as const;

export const PHOTO_GEN_ASSETS = {
  heroRoom: LANDING_ASSETS.hero,
  familyBefore: LANDING_ASSETS.portraitFamilyBefore,
  familyAfter: LANDING_ASSETS.portraitFamily,
  /** Demo everyday photo stand-in until a dedicated couple-before webp ships */
  coupleBefore: LANDING_ASSETS.portraitFamilyBefore,
  coupleAfter: LANDING_ASSETS.portraitCouple,
  dogBefore: "/pet/dog/source.webp",
  dogAfter: "/pet/dog/scenes/christmas-portrait.webp",
  catBefore: "/pet/cat/source.webp",
  catAfter: "/pet/cat/scenes/christmas-portrait.webp",
  familyPetAfter: LANDING_ASSETS.portraitPet,
  styleCozy: FAMILY_STYLE_PREVIEWS.family_cozy_fireplace,
  styleWinter: FAMILY_STYLE_PREVIEWS.family_winter_wonderland,
  styleLuxury: FAMILY_STYLE_PREVIEWS.family_luxury_christmas,
  styleMorning: FAMILY_STYLE_PREVIEWS.family_christmas_morning,
  styleCabin: FAMILY_STYLE_PREVIEWS.family_luxury_christmas,
  styleClassic: FAMILY_STYLE_PREVIEWS.classic_family_christmas,
  styleElegant: FAMILY_STYLE_PREVIEWS.family_elegant_christmas,
  styleMarket: LANDING_ASSETS.card,
  styleMovie: FAMILY_STYLE_PREVIEWS.family_christmas_movie,
  styleVintage: FAMILY_STYLE_PREVIEWS.family_vintage_christmas,
} as const;

export type ExampleCategory = "family" | "couples" | "pets";

export type ExamplePair = {
  id: string;
  category: ExampleCategory | "family_pet";
  before: string;
  after: string;
  beforeAltKey: string;
  afterAltKey: string;
  labelKey: string;
};

export const HERO_EXAMPLES: Record<
  ExampleCategory,
  { before: string; after: string; beforeAlt: string; afterAlt: string }
> = {
  family: {
    before: PHOTO_GEN_ASSETS.familyBefore,
    after: PHOTO_GEN_ASSETS.familyAfter,
    beforeAlt: "Everyday family photo before Christmas transformation",
    afterAlt: "Realistic Christmas family portrait",
  },
  couples: {
    before: PHOTO_GEN_ASSETS.coupleBefore,
    after: PHOTO_GEN_ASSETS.coupleAfter,
    beforeAlt: "Everyday couple photo before Christmas transformation",
    afterAlt: "Romantic Christmas couple portrait",
  },
  pets: {
    before: PHOTO_GEN_ASSETS.dogBefore,
    after: PHOTO_GEN_ASSETS.dogAfter,
    beforeAlt: "Everyday dog photo before Christmas transformation",
    afterAlt: "Realistic Christmas dog portrait",
  },
};

export const GALLERY_EXAMPLES: ExamplePair[] = [
  {
    id: "family",
    category: "family",
    before: PHOTO_GEN_ASSETS.familyBefore,
    after: PHOTO_GEN_ASSETS.familyAfter,
    beforeAltKey: "examples.before",
    afterAltKey: "examples.after",
    labelKey: "examples.family",
  },
  {
    id: "couple",
    category: "couples",
    before: PHOTO_GEN_ASSETS.coupleBefore,
    after: PHOTO_GEN_ASSETS.coupleAfter,
    beforeAltKey: "examples.before",
    afterAltKey: "examples.after",
    labelKey: "examples.couple",
  },
  {
    id: "dog",
    category: "pets",
    before: PHOTO_GEN_ASSETS.dogBefore,
    after: PHOTO_GEN_ASSETS.dogAfter,
    beforeAltKey: "examples.before",
    afterAltKey: "examples.after",
    labelKey: "examples.dog",
  },
  {
    id: "cat",
    category: "pets",
    before: PHOTO_GEN_ASSETS.catBefore,
    after: PHOTO_GEN_ASSETS.catAfter,
    beforeAltKey: "examples.before",
    afterAltKey: "examples.after",
    labelKey: "examples.cat",
  },
  {
    id: "family-pet",
    category: "family_pet",
    before: PHOTO_GEN_ASSETS.familyBefore,
    after: PHOTO_GEN_ASSETS.familyPetAfter,
    beforeAltKey: "examples.before",
    afterAltKey: "examples.after",
    labelKey: "examples.familyPet",
  },
];

/** Map classic style keys to demo preview images (one distinct asset per family style). */
export const STYLE_PREVIEW_BY_KEY: Record<string, string> = {
  classic_christmas: PHOTO_GEN_ASSETS.styleClassic,
  winter_wonderland: PHOTO_GEN_ASSETS.styleWinter,
  santas_workshop: PHOTO_GEN_ASSETS.styleMarket,
  cozy_fireplace: PHOTO_GEN_ASSETS.styleCozy,
  elegant_christmas: PHOTO_GEN_ASSETS.styleElegant,
  north_pole: PHOTO_GEN_ASSETS.styleCabin,
  christmas_movie: PHOTO_GEN_ASSETS.styleMovie,
  vintage_christmas: PHOTO_GEN_ASSETS.styleVintage,
  ...FAMILY_STYLE_PREVIEWS,
  romantic_snowfall: PHOTO_GEN_ASSETS.styleWinter,
  couple_cozy_fireplace: PHOTO_GEN_ASSETS.styleCozy,
  santa_pet: PHOTO_GEN_ASSETS.dogAfter,
};
