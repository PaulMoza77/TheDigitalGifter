/**
 * Christmas portrait vertical configs — one reusable funnel, many acquisition routes.
 * Dogs/cats share commerce product `christmas_pet` with species metadata.
 */

import type { ChristmasStyleDef } from "./styles";
import {
  CHRISTMAS_COUPLE_STYLES,
  CHRISTMAS_FAMILY_STYLES,
  CHRISTMAS_PET_STYLES,
  CHRISTMAS_PHOTO_STYLES,
} from "./portraitStyles";
import { parseChristmasLocalePath } from "./seo/localeRouting";

export type PortraitSubject =
  | "person"
  | "family"
  | "couple"
  | "pet";

export type PortraitSpecies = "dog" | "cat" | "any" | null;

export type ChristmasPortraitVerticalId =
  | "photo"
  | "family"
  | "kids"
  | "couples"
  | "pets"
  | "dogs"
  | "cats";

export type ChristmasPortraitVertical = {
  id: ChristmasPortraitVerticalId;
  productKey:
    | "christmas_photo"
    | "christmas_family"
    | "christmas_kids"
    | "christmas_couple"
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
};

const PHOTO_CROSS = [
  { label: "Family Christmas", to: "/christmas/family" },
  { label: "Couples Christmas", to: "/christmas/couples" },
  { label: "Pet Christmas", to: "/christmas/pets" },
  { label: "Christmas Cards", to: "/christmas/cards" },
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
    pageTitle:
      "AI Christmas Photo Generator | Family, Couples & Pets",
    metaDescription:
      "Turn your favorite photo into a magical Christmas portrait. Create festive photos for family, couples, and pets in minutes.",
    heroHeadline: "Turn Your Photo Into Christmas Magic",
    heroSupport:
      "Upload a favorite photo and create a magical Christmas portrait for your family, partner or pet.",
    uploadHint: "Choose a clear photo — faces should be visible. Family, couple, and pet photos are welcome.",
    deliverableLine: "One high-quality Christmas portrait you can download and share privately.",
    privacyLine: "Your upload and result stay private by default. No public gallery.",
    crossLinks: PHOTO_CROSS,
    styles: CHRISTMAS_PHOTO_STYLES,
    allowMultiplePeople: true,
  },
  family: {
    id: "family",
    productKey: "christmas_family",
    packageKey: "single",
    routePath: "/christmas/family",
    portraitType: "family",
    expectedSpecies: null,
    draftStorageKey: "tdg.christmas.portrait.family.v1",
    pageTitle:
      "Family Christmas Photo Generator | Christmas Family Portraits",
    metaDescription:
      "Create a personalized family Christmas portrait from your favorite family photo. Choose a festive Christmas scene and turn your photo into a holiday memory.",
    heroHeadline: "Turn Your Family Photo Into a Magical Christmas Portrait",
    heroSupport:
      "Upload a family photo, choose a Christmas style, and create a beautiful portrait made for the people you love most.",
    uploadHint: "Group photos welcome — we aim to keep everyone in the frame.",
    deliverableLine: "One Christmas family portrait optimized for multiple people.",
    privacyLine: "Family photos stay private by default. No public gallery.",
    crossLinks: [
      { label: "Couples", to: "/christmas/couples" },
      { label: "Classic portrait", to: "/christmas/photo-generator" },
      { label: "Christmas Cards", to: "/christmas/cards" },
    ],
    styles: CHRISTMAS_FAMILY_STYLES,
    allowMultiplePeople: true,
  },
  kids: {
    id: "kids",
    productKey: "christmas_kids",
    packageKey: "single",
    routePath: "/christmas/kids",
    portraitType: "family",
    expectedSpecies: null,
    draftStorageKey: "tdg.christmas.portrait.kids.v1",
    pageTitle: "Christmas Photos for Kids | Magical Holiday Portraits",
    metaDescription:
      "Create a privacy-first Christmas portrait for a child or siblings from a photo you have permission to use.",
    heroHeadline: "Create a Magical Christmas Portrait for Your Kids",
    heroSupport:
      "With parent or guardian permission, upload a clear photo and choose a family-safe Christmas style.",
    uploadHint:
      "Use a photo you have permission to use. Clear, visible faces and simple backgrounds work best.",
    deliverableLine: "One private Christmas portrait for your child or children.",
    privacyLine:
      "Private by default. No public gallery, and we do not ask for school, address, phone, or social profile details.",
    crossLinks: [
      { label: "Family", to: "/christmas/family" },
      { label: "Classic portrait", to: "/christmas/photo-generator" },
      { label: "Christmas Cards", to: "/christmas/cards" },
    ],
    styles: CHRISTMAS_FAMILY_STYLES,
    allowMultiplePeople: true,
  },
  couples: {
    id: "couples",
    productKey: "christmas_couple",
    packageKey: "single",
    routePath: "/christmas/couples",
    portraitType: "couple",
    expectedSpecies: null,
    draftStorageKey: "tdg.christmas.portrait.couples.v1",
    pageTitle: "Couple Christmas Photo Generator | Romantic Christmas Portraits",
    metaDescription:
      "Create a romantic Christmas couple portrait from your photo. Perfect for a first Christmas together or a personalized couple gift.",
    heroHeadline: "Create a Magical Christmas Portrait Together",
    heroSupport:
      "Perfect for first Christmas together or a personalized couple gift — upload one photo with both of you.",
    uploadHint: "One photo with both people visible works best for V1.",
    deliverableLine: "One Christmas couple portrait that aims to keep both of you recognizable.",
    privacyLine: "Your couple photo stays private by default.",
    crossLinks: [
      { label: "Family", to: "/christmas/family" },
      { label: "Classic portrait", to: "/christmas/photo-generator" },
      { label: "Christmas Cards", to: "/christmas/cards" },
    ],
    styles: CHRISTMAS_COUPLE_STYLES,
    allowMultiplePeople: true,
  },
  pets: {
    id: "pets",
    productKey: "christmas_pet",
    packageKey: "single",
    routePath: "/christmas/pets",
    portraitType: "pet",
    expectedSpecies: "any",
    draftStorageKey: "tdg.christmas.portrait.pets.v1",
    pageTitle: "Christmas Pet Photo Generator | Festive Pet Portraits",
    metaDescription:
      "Turn your pet photo into a festive Christmas portrait. Dogs and cats welcome — private by default.",
    heroHeadline: "Turn Your Pet Into Christmas Magic",
    heroSupport:
      "A Christmas-specific pet portrait — separate from Secret Life packs. Choose dog or cat for a tailored start.",
    uploadHint: "Clear pet face/body photo. Prefer Dog or Cat routes for best species matching.",
    deliverableLine: "One Christmas pet portrait you can download privately.",
    privacyLine: "Pet photos stay private by default.",
    crossLinks: [
      { label: "Christmas Dogs", to: "/christmas/dogs" },
      { label: "Christmas Cats", to: "/christmas/cats" },
      { label: "Christmas Cards", to: "/christmas/cards" },
    ],
    styles: CHRISTMAS_PET_STYLES,
    allowMultiplePeople: false,
  },
  dogs: {
    id: "dogs",
    productKey: "christmas_pet",
    packageKey: "single",
    routePath: "/christmas/dogs",
    portraitType: "pet",
    expectedSpecies: "dog",
    draftStorageKey: "tdg.christmas.portrait.dogs.v1",
    pageTitle: "Christmas Dog Photo Generator | Festive Dog Portraits",
    metaDescription: "Create a magical Christmas portrait of your dog from a clear photo. Species-checked and private by default.",
    heroHeadline: "Create a Magical Christmas Portrait of Your Dog",
    heroSupport:
      "Upload a clear dog photo, pick a holiday style, preview a blur of your original, then create after checkout.",
    uploadHint: "Dog photos only on this route — cats will be offered the Cat Christmas path.",
    deliverableLine: "One Christmas dog portrait.",
    privacyLine: "Your dog photo stays private by default.",
    crossLinks: [
      { label: "Christmas Cats", to: "/christmas/cats" },
      { label: "All pets", to: "/christmas/pets" },
      { label: "Christmas Cards", to: "/christmas/cards" },
    ],
    styles: CHRISTMAS_PET_STYLES,
    allowMultiplePeople: false,
  },
  cats: {
    id: "cats",
    productKey: "christmas_pet",
    packageKey: "single",
    routePath: "/christmas/cats",
    portraitType: "pet",
    expectedSpecies: "cat",
    draftStorageKey: "tdg.christmas.portrait.cats.v1",
    pageTitle: "Christmas Cat Photo Generator | Festive Cat Portraits",
    metaDescription: "Create a magical Christmas portrait of your cat from a clear photo. Species-checked and private by default.",
    heroHeadline: "Create a Magical Christmas Portrait of Your Cat",
    heroSupport:
      "Upload a clear cat photo, pick a holiday style, preview a blur of your original, then create after checkout.",
    uploadHint: "Cat photos only on this route — dogs will be offered the Dog Christmas path.",
    deliverableLine: "One Christmas cat portrait.",
    privacyLine: "Your cat photo stays private by default.",
    crossLinks: [
      { label: "Christmas Dogs", to: "/christmas/dogs" },
      { label: "All pets", to: "/christmas/pets" },
      { label: "Christmas Cards", to: "/christmas/cards" },
    ],
    styles: CHRISTMAS_PET_STYLES,
    allowMultiplePeople: false,
  },
};

export function verticalFromPathname(pathname: string): ChristmasPortraitVertical | null {
  const { basePath } = parseChristmasLocalePath(pathname);
  const match = Object.values(CHRISTMAS_PORTRAIT_VERTICALS).find((v) => v.routePath === basePath);
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
  "christmas_kids",
  "christmas_couple",
  "christmas_pet",
] as const;

export function isPortraitCommerceProduct(productKey: string): boolean {
  return (PORTRAIT_COMMERCE_PRODUCT_KEYS as readonly string[]).includes(productKey);
}
