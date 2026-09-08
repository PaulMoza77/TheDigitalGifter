/**
 * Christmas portrait vertical configs — one reusable funnel, many acquisition routes.
 * Dogs/cats share commerce product `christmas_pet` with species metadata.
 */

import type { ChristmasStyleDef } from "./styles";
import {
  CHRISTMAS_COUPLE_STYLES,
  CHRISTMAS_FAMILY_STYLES,
  CHRISTMAS_KIDS_STYLES,
  CHRISTMAS_PET_STYLES,
  CHRISTMAS_PHOTO_STYLES,
} from "./portraitStyles";

export type PortraitSubject =
  | "person"
  | "family"
  | "couple"
  | "child"
  | "pet";

export type PortraitSpecies = "dog" | "cat" | "any" | null;

export type ChristmasPortraitVerticalId =
  | "photo"
  | "family"
  | "couples"
  | "kids"
  | "pets"
  | "dogs"
  | "cats";

export type ChristmasPortraitVertical = {
  id: ChristmasPortraitVerticalId;
  productKey:
    | "christmas_photo"
    | "christmas_family"
    | "christmas_couple"
    | "christmas_kids"
    | "christmas_pet";
  packageKey: "single";
  routePath: string;
  portraitType: PortraitSubject;
  /** When set, route enforces expected species (dog/cat). Pets hub uses any. */
  expectedSpecies: PortraitSpecies;
  draftStorageKey: string;
  pageTitle: string;
  metaDescription: string;
  heroHeadline: string;
  heroSupport: string;
  uploadHint: string;
  deliverableLine: string;
  privacyLine: string;
  crossLinks: Array<{ label: string; to: string }>;
  styles: ChristmasStyleDef[];
  allowMultiplePeople: boolean;
  requiresGuardianConsent: boolean;
  noindex: boolean;
  hidePublicShare: boolean;
};

const PHOTO_CROSS = [
  { label: "Family Christmas", to: "/christmas/family" },
  { label: "Couples Christmas", to: "/christmas/couples" },
  { label: "Pet Christmas", to: "/christmas/pets" },
];

export const CHRISTMAS_PORTRAIT_VERTICALS: Record<
  ChristmasPortraitVerticalId,
  ChristmasPortraitVertical
> = {
  photo: {
    id: "photo",
    productKey: "christmas_photo",
    packageKey: "single",
    routePath: "/christmas/photo-generator",
    portraitType: "person",
    expectedSpecies: null,
    draftStorageKey: "tdg.christmas.portrait.photo.v1",
    pageTitle: "Christmas AI Photo Generator | The Digital Gifter",
    metaDescription:
      "Turn your photo into a personalized Christmas portrait. Private by default. Preview uses your original photo — finished AI art after purchase.",
    heroHeadline: "Turn your photo into a personalized Christmas portrait.",
    heroSupport:
      "Upload a photo, pick a Christmas style, see a blurred preview of your own image, then create the finished portrait after checkout.",
    uploadHint: "Clear face photo works best. Family and couple photos are welcome.",
    deliverableLine: "One high-quality Christmas portrait you can download and share privately.",
    privacyLine: "Your upload and result stay private by default.",
    crossLinks: PHOTO_CROSS,
    styles: CHRISTMAS_PHOTO_STYLES,
    allowMultiplePeople: true,
    requiresGuardianConsent: false,
    noindex: false,
    hidePublicShare: false,
  },
  family: {
    id: "family",
    productKey: "christmas_family",
    packageKey: "single",
    routePath: "/christmas/family",
    portraitType: "family",
    expectedSpecies: null,
    draftStorageKey: "tdg.christmas.portrait.family.v1",
    pageTitle: "Family Christmas Portrait | The Digital Gifter",
    metaDescription:
      "Turn your family photo into a magical Christmas portrait. Built for groups. Private by default.",
    heroHeadline: "Turn your family photo into a magical Christmas portrait.",
    heroSupport:
      "Upload a family photo, choose a festive style, preview a blurred version of your original, then create the finished portrait after payment.",
    uploadHint: "Group photos welcome — we aim to keep everyone in the frame.",
    deliverableLine: "One Christmas family portrait optimized for multiple people.",
    privacyLine: "Family photos stay private by default. No public gallery.",
    crossLinks: [
      { label: "Couples", to: "/christmas/couples" },
      { label: "Classic portrait", to: "/christmas/photo-generator" },
    ],
    styles: CHRISTMAS_FAMILY_STYLES,
    allowMultiplePeople: true,
    requiresGuardianConsent: false,
    noindex: false,
    hidePublicShare: false,
  },
  couples: {
    id: "couples",
    productKey: "christmas_couple",
    packageKey: "single",
    routePath: "/christmas/couples",
    portraitType: "couple",
    expectedSpecies: null,
    draftStorageKey: "tdg.christmas.portrait.couples.v1",
    pageTitle: "Couples Christmas Portrait | The Digital Gifter",
    metaDescription:
      "Create a romantic Christmas couple portrait from your photo. Private by default.",
    heroHeadline: "A romantic Christmas portrait of the two of you.",
    heroSupport:
      "Perfect for first Christmas together or a personalized couple gift — upload one photo with both of you.",
    uploadHint: "One photo with both people visible works best for V1.",
    deliverableLine: "One Christmas couple portrait that aims to keep both of you recognizable.",
    privacyLine: "Your couple photo stays private by default.",
    crossLinks: [
      { label: "Family", to: "/christmas/family" },
      { label: "Classic portrait", to: "/christmas/photo-generator" },
    ],
    styles: CHRISTMAS_COUPLE_STYLES,
    allowMultiplePeople: true,
    requiresGuardianConsent: false,
    noindex: false,
    hidePublicShare: false,
  },
  kids: {
    id: "kids",
    productKey: "christmas_kids",
    packageKey: "single",
    routePath: "/christmas/kids",
    portraitType: "child",
    expectedSpecies: null,
    draftStorageKey: "tdg.christmas.portrait.kids.v1",
    pageTitle: "Kids Christmas Portrait | The Digital Gifter",
    metaDescription:
      "Create a private Christmas portrait of your child. Parent or guardian consent required. Not indexed. No public gallery.",
    heroHeadline: "A private Christmas portrait of your child.",
    heroSupport:
      "Upload their photo, pick a child-safe Christmas style, preview a blur of the original, then create after checkout. This page is not indexed and results stay private.",
    uploadHint: "A clear, recent photo of your child works best. Parent or guardian permission is required.",
    deliverableLine: "One private Christmas kids portrait — download via your order link only.",
    privacyLine:
      "Private by default. No public gallery. Not listed for search engines. Unpaid uploads deleted after 7 days; paid portraits after 90 days.",
    crossLinks: [
      { label: "Family Christmas", to: "/christmas/family" },
      { label: "Classic portrait", to: "/christmas/photo-generator" },
    ],
    styles: CHRISTMAS_KIDS_STYLES,
    allowMultiplePeople: true,
    requiresGuardianConsent: true,
    noindex: true,
    hidePublicShare: true,
  },
  pets: {
    id: "pets",
    productKey: "christmas_pet",
    packageKey: "single",
    routePath: "/christmas/pets",
    portraitType: "pet",
    expectedSpecies: "any",
    draftStorageKey: "tdg.christmas.portrait.pets.v1",
    pageTitle: "Pet Christmas Portrait | The Digital Gifter",
    metaDescription:
      "Turn your pet photo into a Christmas portrait. Dogs and cats welcome. Private by default.",
    heroHeadline: "Turn your pet into a Christmas portrait.",
    heroSupport:
      "A Christmas-specific pet portrait — separate from Secret Life packs. Choose dog or cat for a tailored start.",
    uploadHint: "Clear pet face/body photo. Prefer Dog or Cat routes for best species matching.",
    deliverableLine: "One Christmas pet portrait you can download privately.",
    privacyLine: "Pet photos stay private by default.",
    crossLinks: [
      { label: "Christmas Dogs", to: "/christmas/dogs" },
      { label: "Christmas Cats", to: "/christmas/cats" },
    ],
    styles: CHRISTMAS_PET_STYLES,
    allowMultiplePeople: false,
    requiresGuardianConsent: false,
    noindex: false,
    hidePublicShare: false,
  },
  dogs: {
    id: "dogs",
    productKey: "christmas_pet",
    packageKey: "single",
    routePath: "/christmas/dogs",
    portraitType: "pet",
    expectedSpecies: "dog",
    draftStorageKey: "tdg.christmas.portrait.dogs.v1",
    pageTitle: "Dog Christmas Portrait | The Digital Gifter",
    metaDescription: "Create a Christmas portrait of your dog. Species-checked. Private by default.",
    heroHeadline: "A Christmas portrait made for your dog.",
    heroSupport:
      "Upload a clear dog photo, pick a holiday style, preview a blur of your original, then create after checkout.",
    uploadHint: "Dog photos only on this route — cats will be offered the Cat Christmas path.",
    deliverableLine: "One Christmas dog portrait.",
    privacyLine: "Your dog photo stays private by default.",
    crossLinks: [
      { label: "Christmas Cats", to: "/christmas/cats" },
      { label: "All pets", to: "/christmas/pets" },
    ],
    styles: CHRISTMAS_PET_STYLES,
    allowMultiplePeople: false,
    requiresGuardianConsent: false,
    noindex: false,
    hidePublicShare: false,
  },
  cats: {
    id: "cats",
    productKey: "christmas_pet",
    packageKey: "single",
    routePath: "/christmas/cats",
    portraitType: "pet",
    expectedSpecies: "cat",
    draftStorageKey: "tdg.christmas.portrait.cats.v1",
    pageTitle: "Cat Christmas Portrait | The Digital Gifter",
    metaDescription: "Create a Christmas portrait of your cat. Species-checked. Private by default.",
    heroHeadline: "A Christmas portrait made for your cat.",
    heroSupport:
      "Upload a clear cat photo, pick a holiday style, preview a blur of your original, then create after checkout.",
    uploadHint: "Cat photos only on this route — dogs will be offered the Dog Christmas path.",
    deliverableLine: "One Christmas cat portrait.",
    privacyLine: "Your cat photo stays private by default.",
    crossLinks: [
      { label: "Christmas Dogs", to: "/christmas/dogs" },
      { label: "All pets", to: "/christmas/pets" },
    ],
    styles: CHRISTMAS_PET_STYLES,
    allowMultiplePeople: false,
    requiresGuardianConsent: false,
    noindex: false,
    hidePublicShare: false,
  },
};

export function verticalFromPathname(pathname: string): ChristmasPortraitVertical | null {
  const path = pathname.split("?")[0].replace(/\/$/, "") || "/";
  const match = Object.values(CHRISTMAS_PORTRAIT_VERTICALS).find((v) => v.routePath === path);
  return match ?? null;
}

export function resolvePortraitStyle(
  vertical: ChristmasPortraitVertical,
  styleKey: string,
): ChristmasStyleDef | null {
  const key = String(styleKey || "").trim();
  const style = vertical.styles.find((s) => s.styleKey === key && s.enabled) ?? null;
  return style;
}

export const PORTRAIT_COMMERCE_PRODUCT_KEYS = [
  "christmas_photo",
  "christmas_family",
  "christmas_couple",
  "christmas_kids",
  "christmas_pet",
] as const;

export function isPortraitCommerceProduct(productKey: string): boolean {
  return (PORTRAIT_COMMERCE_PRODUCT_KEYS as readonly string[]).includes(productKey);
}
