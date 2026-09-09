import { LANDING_ASSETS } from "../landing/assets";

export const FAMILY_ASSETS = {
  room: LANDING_ASSETS.hero,
  finale: LANDING_ASSETS.finale,
  familyBefore: LANDING_ASSETS.portraitFamilyBefore,
  familyAfter: LANDING_ASSETS.portraitFamily,
  coupleAfter: LANDING_ASSETS.portraitCouple,
  petAfter: LANDING_ASSETS.portraitPet,
  funnelBefore: "/assets/funnel/christmas-before.png",
  funnelAfter: "/assets/funnel/christmas-after.png",
  funnelEx2Before: "/assets/funnel/christmas-ex2-before.png",
  funnelEx2After: "/assets/funnel/christmas-ex2-after.png",
  funnelEx3Before: "/assets/funnel/christmas-ex3-before.png",
  funnelEx3After: "/assets/funnel/christmas-ex3-after.png",
  familyStill: "/assets/funnel/family.png",
  dogAfter: "/pet/dog/scenes/christmas-portrait.webp",
  catAfter: "/pet/cat/scenes/christmas-portrait.webp",
  dogBefore: "/pet/dog/source.webp",
  catBefore: "/pet/cat/source.webp",
} as const;

/** Hero style chips — Christmas-first labels mapped to registry keys. */
export type FamilyStyleChip = {
  styleKey: string;
  labelKey: string;
  preview: string;
};

export const FAMILY_STYLE_CHIPS: FamilyStyleChip[] = [
  {
    styleKey: "family_cozy_fireplace",
    labelKey: "styles.cozy",
    preview: FAMILY_ASSETS.familyAfter,
  },
  {
    styleKey: "family_winter_wonderland",
    labelKey: "styles.snowy",
    preview: FAMILY_ASSETS.finale,
  },
  {
    styleKey: "classic_family_christmas",
    labelKey: "styles.classic",
    preview: FAMILY_ASSETS.funnelAfter,
  },
  {
    styleKey: "family_elegant_christmas",
    labelKey: "styles.elegant",
    preview: FAMILY_ASSETS.coupleAfter,
  },
  {
    styleKey: "family_christmas_morning",
    labelKey: "styles.morning",
    preview: FAMILY_ASSETS.funnelEx2After,
  },
  {
    styleKey: "family_luxury_christmas",
    labelKey: "styles.cabin",
    preview: FAMILY_ASSETS.funnelEx3After,
  },
];

export const STYLE_PREVIEW_BY_KEY: Record<string, string> = {
  classic_family_christmas: FAMILY_ASSETS.funnelAfter,
  family_cozy_fireplace: FAMILY_ASSETS.familyAfter,
  family_winter_wonderland: FAMILY_ASSETS.finale,
  family_elegant_christmas: FAMILY_ASSETS.coupleAfter,
  family_christmas_morning: FAMILY_ASSETS.funnelEx2After,
  family_luxury_christmas: FAMILY_ASSETS.funnelEx3After,
  family_christmas_movie: FAMILY_ASSETS.familyStill,
  family_vintage_christmas: FAMILY_ASSETS.funnelAfter,
};

export type FamilyGalleryItem = {
  id: string;
  labelKey: string;
  before: string;
  after: string;
};

export const FAMILY_GALLERY: FamilyGalleryItem[] = [
  {
    id: "family3",
    labelKey: "examples.family3",
    before: FAMILY_ASSETS.funnelEx2Before,
    after: FAMILY_ASSETS.funnelEx2After,
  },
  {
    id: "family4",
    labelKey: "examples.family4",
    before: FAMILY_ASSETS.familyBefore,
    after: FAMILY_ASSETS.familyAfter,
  },
  {
    id: "family5",
    labelKey: "examples.family5",
    before: FAMILY_ASSETS.funnelBefore,
    after: FAMILY_ASSETS.funnelAfter,
  },
  {
    id: "baby",
    labelKey: "examples.baby",
    before: FAMILY_ASSETS.funnelEx3Before,
    after: FAMILY_ASSETS.funnelEx3After,
  },
  {
    id: "grandparents",
    labelKey: "examples.grandparents",
    before: FAMILY_ASSETS.familyBefore,
    after: FAMILY_ASSETS.familyStill,
  },
  {
    id: "dog",
    labelKey: "examples.dog",
    before: FAMILY_ASSETS.dogBefore,
    after: FAMILY_ASSETS.dogAfter,
  },
  {
    id: "cat",
    labelKey: "examples.cat",
    before: FAMILY_ASSETS.catBefore,
    after: FAMILY_ASSETS.catAfter,
  },
];

/** Scene cards for the styles storytelling section. */
export const FAMILY_SCENE_CARDS = [
  {
    id: "cozy",
    titleKey: "styles.cozy",
    descKey: "styles.cozyDesc",
    image: FAMILY_ASSETS.familyAfter,
    styleKey: "family_cozy_fireplace",
  },
  {
    id: "morning",
    titleKey: "styles.morning",
    descKey: "styles.morningDesc",
    image: FAMILY_ASSETS.funnelEx2After,
    styleKey: "family_christmas_morning",
  },
  {
    id: "cabin",
    titleKey: "styles.cabin",
    descKey: "styles.cabinDesc",
    image: FAMILY_ASSETS.funnelEx3After,
    styleKey: "family_luxury_christmas",
  },
  {
    id: "elegant",
    titleKey: "styles.elegant",
    descKey: "styles.elegantDesc",
    image: FAMILY_ASSETS.coupleAfter,
    styleKey: "family_elegant_christmas",
  },
  {
    id: "classic",
    titleKey: "styles.classic",
    descKey: "styles.classicDesc",
    image: FAMILY_ASSETS.funnelAfter,
    styleKey: "classic_family_christmas",
  },
  {
    id: "wonderland",
    titleKey: "styles.wonderland",
    descKey: "styles.wonderlandDesc",
    image: FAMILY_ASSETS.funnelEx3After,
    styleKey: "family_winter_wonderland",
  },
] as const;
