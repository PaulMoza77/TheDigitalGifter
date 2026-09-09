/** Card maker UX taxonomy — types, steps, curated examples. */

import type { CardStyleKey } from "./cardStyles";
import { LANDING_ASSETS } from "../landing/assets";

export const CARD_MAKER_STEPS = [
  "type",
  "photo",
  "design",
  "message",
  "preview",
  "result",
] as const;

export type CardMakerStep = (typeof CARD_MAKER_STEPS)[number];

export const CARD_TYPES = [
  {
    key: "family",
    labelEn: "Family",
    labelRo: "Familie",
    defaultStyle: "cozy_christmas" as CardStyleKey,
    defaultRecipient: "family",
    defaultTone: "heartfelt",
  },
  {
    key: "couple",
    labelEn: "Couple",
    labelRo: "Cuplu",
    defaultStyle: "romantic_christmas" as CardStyleKey,
    defaultRecipient: "partner",
    defaultTone: "romantic",
  },
  {
    key: "kids",
    labelEn: "Kids",
    labelRo: "Copii",
    defaultStyle: "playful_christmas" as CardStyleKey,
    defaultRecipient: "child",
    defaultTone: "warm",
  },
  {
    key: "pet",
    labelEn: "Pet",
    labelRo: "Animal de companie",
    defaultStyle: "playful_christmas" as CardStyleKey,
    defaultRecipient: "family",
    defaultTone: "funny",
  },
  {
    key: "friends",
    labelEn: "Friends",
    labelRo: "Prieteni",
    defaultStyle: "classic_christmas" as CardStyleKey,
    defaultRecipient: "friend",
    defaultTone: "warm",
  },
  {
    key: "romantic",
    labelEn: "Romantic",
    labelRo: "Romantic",
    defaultStyle: "romantic_christmas" as CardStyleKey,
    defaultRecipient: "partner",
    defaultTone: "romantic",
  },
  {
    key: "funny",
    labelEn: "Funny",
    labelRo: "Amuzant",
    defaultStyle: "playful_christmas" as CardStyleKey,
    defaultRecipient: "friend",
    defaultTone: "funny",
  },
  {
    key: "elegant",
    labelEn: "Elegant",
    labelRo: "Elegant",
    defaultStyle: "elegant_gold" as CardStyleKey,
    defaultRecipient: "other",
    defaultTone: "heartfelt",
  },
  {
    key: "business",
    labelEn: "Business",
    labelRo: "Business",
    defaultStyle: "minimal_christmas" as CardStyleKey,
    defaultRecipient: "coworker",
    defaultTone: "professional",
  },
] as const;

export type CardTypeKey = (typeof CARD_TYPES)[number]["key"];

export const CARD_TYPE_KEYS = new Set(CARD_TYPES.map((t) => t.key));

export function getCardType(key: string) {
  return CARD_TYPES.find((t) => t.key === key) || CARD_TYPES[0]!;
}

/** Curated design directions shown in the creator (ordered for UX). */
export const CARD_DESIGN_ORDER: CardStyleKey[] = [
  "classic_christmas",
  "elegant_gold",
  "cozy_christmas",
  "winter_wonderland",
  "minimal_christmas",
  "vintage_christmas",
  "playful_christmas",
  "romantic_christmas",
];

export const CARD_DESIGN_BLURBS: Record<
  CardStyleKey,
  { en: string; ro: string; categoryEn: string; categoryRo: string }
> = {
  classic_christmas: {
    en: "Traditional red, evergreen and warm gold.",
    ro: "Roșu tradițional, verde brad și aur cald.",
    categoryEn: "Classic Christmas",
    categoryRo: "Crăciun clasic",
  },
  elegant_gold: {
    en: "Premium, minimal and sophisticated.",
    ro: "Premium, minimal și sofisticat.",
    categoryEn: "Elegant Gold",
    categoryRo: "Aur elegant",
  },
  cozy_christmas: {
    en: "Warm home atmosphere and soft typography.",
    ro: "Atmosferă de acasă și tipografie blândă.",
    categoryEn: "Cozy Christmas",
    categoryRo: "Crăciun cozy",
  },
  winter_wonderland: {
    en: "Winter white, snow and quiet cold light.",
    ro: "Alb de iarnă, zăpadă și lumină rece.",
    categoryEn: "Winter Wonderland",
    categoryRo: "Iarnă magică",
  },
  romantic_christmas: {
    en: "Couples, warm lights, soft romance.",
    ro: "Cupluri, lumini calde, romantism blând.",
    categoryEn: "Romantic Christmas",
    categoryRo: "Crăciun romantic",
  },
  playful_christmas: {
    en: "Playful energy — great for pets and laughs.",
    ro: "Energie jucăușă — perfect pentru animale și glume.",
    categoryEn: "Playful Christmas",
    categoryRo: "Crăciun jucăuș",
  },
  minimal_christmas: {
    en: "Clean typography with breathing room.",
    ro: "Tipografie curată, cu spațiu de respirat.",
    categoryEn: "Minimal Christmas",
    categoryRo: "Crăciun minimal",
  },
  vintage_christmas: {
    en: "Heritage tones with a keepsake feel.",
    ro: "Nuanțe vintage, sentiment de amintire.",
    categoryEn: "Vintage Christmas",
    categoryRo: "Crăciun vintage",
  },
};

export type HeroExampleKey = "family" | "couple" | "pet" | "elegant" | "funny";

export type CardExample = {
  key: HeroExampleKey | "portrait_to_card";
  labelEn: string;
  labelRo: string;
  styleKey: CardStyleKey;
  photoSrc: string;
  photoAltEn: string;
  photoAltRo: string;
  greetingEn: string;
  greetingRo: string;
  messageEn: string;
  messageRo: string;
  toEn: string;
  toRo: string;
  fromEn: string;
  fromRo: string;
};

export type HeroExample = Omit<CardExample, "key"> & { key: HeroExampleKey };

export const HERO_EXAMPLES: HeroExample[] = [
  {
    key: "family",
    labelEn: "Family",
    labelRo: "Familie",
    styleKey: "cozy_christmas",
    photoSrc: LANDING_ASSETS.portraitFamily,
    photoAltEn: "Demo family Christmas portrait on a Christmas card",
    photoAltRo: "Portret demonstrativ de familie pe un card de Crăciun",
    greetingEn: "Merry Christmas",
    greetingRo: "Crăciun Fericit",
    messageEn:
      "Wishing you a Christmas filled with warm moments, happy memories and all the people you love most.",
    messageRo:
      "Îți dorim un Crăciun plin de momente calde, amintiri frumoase și oamenii pe care îi iubești cel mai mult.",
    toEn: "Grandma",
    toRo: "Bunica",
    fromEn: "Emma, Noah & Mum and Dad",
    fromRo: "Emma, Noah & Mama și Tata",
  },
  {
    key: "couple",
    labelEn: "Couple",
    labelRo: "Cuplu",
    styleKey: "romantic_christmas",
    photoSrc: LANDING_ASSETS.portraitCouple,
    photoAltEn: "Demo couple Christmas portrait on a Christmas card",
    photoAltRo: "Portret demonstrativ de cuplu pe un card de Crăciun",
    greetingEn: "Merry Christmas, my love",
    greetingRo: "Crăciun Fericit, dragostea mea",
    messageEn: "Another Christmas with you is another reason to feel incredibly lucky.",
    messageRo: "Încă un Crăciun alături de tine e încă un motiv să mă simt incredibil de norocos.",
    toEn: "My love",
    toRo: "Iubirea mea",
    fromEn: "Always yours",
    fromRo: "Al tău pentru totdeauna",
  },
  {
    key: "pet",
    labelEn: "Pet",
    labelRo: "Pet",
    styleKey: "playful_christmas",
    photoSrc: LANDING_ASSETS.portraitPet,
    photoAltEn: "Demo pet Christmas portrait on a Christmas card",
    photoAltRo: "Portret demonstrativ cu animal pe un card de Crăciun",
    greetingEn: "Pawsitively merry",
    greetingRo: "Crăciun cu lăbuțe",
    messageEn: "May your stockings be full, your naps be long, and your treats be plentiful.",
    messageRo: "Să ai ciorapii plini, somnuri lungi și recompense pe măsură.",
    toEn: "Our favorite human",
    toRo: "Omul nostru preferat",
    fromEn: "With love from the dog",
    fromRo: "Cu drag, de la cățel",
  },
  {
    key: "elegant",
    labelEn: "Elegant",
    labelRo: "Elegant",
    styleKey: "elegant_gold",
    photoSrc: LANDING_ASSETS.card,
    photoAltEn: "Demo elegant Christmas card on a wooden table",
    photoAltRo: "Card elegant de Crăciun demonstrativ pe o masă de lemn",
    greetingEn: "Season’s greetings",
    greetingRo: "Urări de sărbători",
    messageEn: "Merry Christmas and a beautiful New Year filled with happiness.",
    messageRo: "Crăciun Fericit și un An Nou frumos, plin de fericire.",
    toEn: "Friends near and far",
    toRo: "Prietenilor de aproape și de departe",
    fromEn: "With warm regards",
    fromRo: "Cu gânduri calde",
  },
  {
    key: "funny",
    labelEn: "Funny",
    labelRo: "Amuzant",
    styleKey: "playful_christmas",
    photoSrc: LANDING_ASSETS.portraitFamilyBefore,
    photoAltEn: "Demo funny Christmas card photo",
    photoAltRo: "Fotografie demonstrativă pentru un card amuzant",
    greetingEn: "We checked twice",
    greetingRo: "Am verificat de două ori",
    messageEn: "We checked the nice list twice. You’re still on it — somehow.",
    messageRo: "Am verificat lista celor cuminți de două ori. Încă ești pe ea — cumva.",
    toEn: "Best friend",
    toRo: "Cel mai bun prieten",
    fromEn: "Your favorite troublemaker",
    fromRo: "Preferatul tău necumpătat",
  },
];

export const EXAMPLES_GALLERY: CardExample[] = [
  ...HERO_EXAMPLES,
  {
    key: "portrait_to_card",
    labelEn: "Portrait → Card",
    labelRo: "Portret → Card",
    styleKey: "classic_christmas",
    photoSrc: LANDING_ASSETS.portraitFamily,
    photoAltEn: "Demo Christmas portrait turned into a finished Christmas card",
    photoAltRo: "Portret de Crăciun demonstrativ transformat într-un card final",
    greetingEn: "Our Christmas portrait",
    greetingRo: "Portretul nostru de Crăciun",
    messageEn:
      "We turned our Christmas portrait into a card — so the people we love can keep this moment too.",
    messageRo:
      "Am transformat portretul nostru de Crăciun într-un card — ca oamenii pe care îi iubim să păstreze și ei acest moment.",
    toEn: "Family",
    toRo: "Familie",
    fromEn: "With love",
    fromRo: "Cu drag",
  },
];

/** Lightweight in-flow message helper recipients (subset). */
export const CARD_MESSAGE_RECIPIENTS = [
  "mom",
  "dad",
  "partner",
  "family",
  "friend",
  "coworker",
] as const;

export const CARD_MESSAGE_TONES = [
  "heartfelt",
  "warm",
  "romantic",
  "funny",
  "professional",
  "short_and_sweet",
] as const;

/** Compact style thumbnail imagery — small crops, not full cards. */
export const STYLE_THUMB_SRC: Record<CardStyleKey, string> = {
  classic_christmas: LANDING_ASSETS.card,
  elegant_gold: LANDING_ASSETS.card,
  cozy_christmas: LANDING_ASSETS.portraitFamily,
  winter_wonderland: LANDING_ASSETS.hero,
  romantic_christmas: LANDING_ASSETS.portraitCouple,
  playful_christmas: LANDING_ASSETS.portraitPet,
  minimal_christmas: LANDING_ASSETS.portraitFamilyBefore,
  vintage_christmas: LANDING_ASSETS.finale,
};

export const DEMO_MESSAGES = {
  heartfeltFamily: {
    en: "Wishing you a Christmas filled with warm moments, happy memories and all the people you love most.",
    ro: "Îți dorim un Crăciun plin de momente calde, amintiri frumoase și oamenii pe care îi iubești cel mai mult.",
  },
  romantic: {
    en: "Another Christmas with you is another reason to feel incredibly lucky.",
    ro: "Încă un Crăciun alături de tine e încă un motiv să mă simt incredibil de norocos.",
  },
  simple: {
    en: "Merry Christmas and a beautiful New Year filled with happiness.",
    ro: "Crăciun Fericit și un An Nou frumos, plin de fericire.",
  },
  petFunny: {
    en: "May your stockings be full, your naps be long, and your treats be plentiful.",
    ro: "Să ai ciorapii plini, somnuri lungi și recompense pe măsură.",
  },
} as const;
