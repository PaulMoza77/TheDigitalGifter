import { LANDING_ASSETS } from "../landing/assets";
import { FAMILY_STYLE_PREVIEWS } from "../photoGenerator/assets";

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
    preview: FAMILY_STYLE_PREVIEWS.family_cozy_fireplace,
  },
  {
    styleKey: "family_winter_wonderland",
    labelKey: "styles.snowy",
    preview: FAMILY_STYLE_PREVIEWS.family_winter_wonderland,
  },
  {
    styleKey: "classic_family_christmas",
    labelKey: "styles.classic",
    preview: FAMILY_STYLE_PREVIEWS.classic_family_christmas,
  },
  {
    styleKey: "family_elegant_christmas",
    labelKey: "styles.elegant",
    preview: FAMILY_STYLE_PREVIEWS.family_elegant_christmas,
  },
  {
    styleKey: "family_christmas_morning",
    labelKey: "styles.morning",
    preview: FAMILY_STYLE_PREVIEWS.family_christmas_morning,
  },
  {
    styleKey: "family_luxury_christmas",
    labelKey: "styles.cabin",
    preview: FAMILY_STYLE_PREVIEWS.family_luxury_christmas,
  },
];

export const STYLE_PREVIEW_BY_KEY: Record<string, string> = {
  ...FAMILY_STYLE_PREVIEWS,
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
    image: FAMILY_STYLE_PREVIEWS.family_cozy_fireplace,
    styleKey: "family_cozy_fireplace",
  },
  {
    id: "morning",
    titleKey: "styles.morning",
    descKey: "styles.morningDesc",
    image: FAMILY_STYLE_PREVIEWS.family_christmas_morning,
    styleKey: "family_christmas_morning",
  },
  {
    id: "cabin",
    titleKey: "styles.cabin",
    descKey: "styles.cabinDesc",
    image: FAMILY_STYLE_PREVIEWS.family_luxury_christmas,
    styleKey: "family_luxury_christmas",
  },
  {
    id: "elegant",
    titleKey: "styles.elegant",
    descKey: "styles.elegantDesc",
    image: FAMILY_STYLE_PREVIEWS.family_elegant_christmas,
    styleKey: "family_elegant_christmas",
  },
  {
    id: "classic",
    titleKey: "styles.classic",
    descKey: "styles.classicDesc",
    image: FAMILY_STYLE_PREVIEWS.classic_family_christmas,
    styleKey: "classic_family_christmas",
  },
  {
    id: "wonderland",
    titleKey: "styles.wonderland",
    descKey: "styles.wonderlandDesc",
    image: FAMILY_STYLE_PREVIEWS.family_winter_wonderland,
    styleKey: "family_winter_wonderland",
  },
] as const;
