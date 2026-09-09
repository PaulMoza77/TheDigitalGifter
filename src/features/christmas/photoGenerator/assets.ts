import { LANDING_ASSETS } from "../landing/assets";

export const PHOTO_GEN_ASSETS = {
  heroRoom: LANDING_ASSETS.hero,
  familyBefore: LANDING_ASSETS.portraitFamilyBefore,
  familyAfter: LANDING_ASSETS.portraitFamily,
  coupleBefore: "/assets/funnel/christmas-before.png",
  coupleAfter: LANDING_ASSETS.portraitCouple,
  dogBefore: "/pet/dog/source.webp",
  dogAfter: "/pet/dog/scenes/christmas-portrait.webp",
  catBefore: "/pet/cat/source.webp",
  catAfter: "/pet/cat/scenes/christmas-portrait.webp",
  familyPetAfter: LANDING_ASSETS.portraitPet,
  styleCozy: LANDING_ASSETS.portraitFamily,
  styleWinter: "/assets/funnel/christmas-ex2-after.png",
  styleLuxury: LANDING_ASSETS.portraitCouple,
  styleMorning: "/assets/funnel/christmas-ex3-after.png",
  styleCabin: LANDING_ASSETS.finale,
  styleClassic: LANDING_ASSETS.portraitFamily,
  styleElegant: LANDING_ASSETS.portraitCouple,
  styleMarket: "/assets/funnel/christmas-after.png",
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

/** Map classic style keys to demo preview images (curated for first iteration). */
export const STYLE_PREVIEW_BY_KEY: Record<string, string> = {
  classic_christmas: PHOTO_GEN_ASSETS.styleClassic,
  winter_wonderland: PHOTO_GEN_ASSETS.styleWinter,
  santas_workshop: PHOTO_GEN_ASSETS.styleMarket,
  cozy_fireplace: PHOTO_GEN_ASSETS.styleCozy,
  elegant_christmas: PHOTO_GEN_ASSETS.styleElegant,
  north_pole: PHOTO_GEN_ASSETS.styleCabin,
  christmas_movie: PHOTO_GEN_ASSETS.styleMorning,
  vintage_christmas: PHOTO_GEN_ASSETS.styleLuxury,
  classic_family_christmas: PHOTO_GEN_ASSETS.styleClassic,
  family_cozy_fireplace: PHOTO_GEN_ASSETS.styleCozy,
  family_winter_wonderland: PHOTO_GEN_ASSETS.styleWinter,
  family_elegant_christmas: PHOTO_GEN_ASSETS.styleElegant,
  family_christmas_morning: PHOTO_GEN_ASSETS.styleMorning,
  family_luxury_christmas: PHOTO_GEN_ASSETS.styleLuxury,
  family_christmas_movie: PHOTO_GEN_ASSETS.styleMorning,
  family_vintage_christmas: PHOTO_GEN_ASSETS.styleClassic,
  romantic_snowfall: PHOTO_GEN_ASSETS.styleWinter,
  couple_cozy_fireplace: PHOTO_GEN_ASSETS.styleCozy,
  santa_pet: PHOTO_GEN_ASSETS.dogAfter,
};
