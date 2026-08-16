import type { PetSceneKey } from "./constants.ts";

export type SceneDefinition = {
  key: PetSceneKey;
  number: number;
  title: string;
  prompt: string;
};

const IDENTITY =
  "Keep the exact same pet identity, face, fur markings, colors, eye color, and unique features from the reference photo. Do not replace the pet with a different animal. No logos, no trademarks, no copyrighted characters, no real newspaper mastheads, no racing team branding, no superhero franchise costumes.";

export const PET_SCENE_DEFINITIONS: readonly SceneDefinition[] = [
  {
    key: "royal-portrait",
    number: 1,
    title: "Royal portrait",
    prompt: `${IDENTITY} Formal original court portrait of this exact pet, ornate gold frame, velvet backdrop, museum lighting.`,
  },
  {
    key: "luxury-ceo",
    number: 2,
    title: "Luxury CEO",
    prompt: `${IDENTITY} Executive portrait of this exact pet in an original glass-office setting, tailored look, city skyline, cinematic lighting.`,
  },
  {
    key: "astronaut",
    number: 3,
    title: "Astronaut",
    prompt: `${IDENTITY} This exact pet wearing an original space suit, visor reflection, starfield, photoreal, no NASA logos.`,
  },
  {
    key: "formula-racer",
    number: 4,
    title: "Formula racing driver",
    prompt: `${IDENTITY} This exact pet as an original racing driver. Original racing suit and helmet. No team names, no manufacturer logos, no series branding.`,
  },
  {
    key: "spa-bathtub",
    number: 5,
    title: "Spa / bathtub",
    prompt: `${IDENTITY} This exact pet relaxing in a marble bathtub with bubbles and a towel, spa lighting, original interior.`,
  },
  {
    key: "newspaper",
    number: 6,
    title: "Reading a newspaper",
    prompt: `${IDENTITY} This exact pet reading a generic unbranded broadsheet with unreadable placeholder text, cafe light, original setting. No real newspaper titles.`,
  },
  {
    key: "cinema-boss",
    number: 7,
    title: "Fictional cinema boss",
    prompt: `${IDENTITY} This exact pet as an original fictional crime-drama office boss. Leather chair, lamp, original office. No existing film characters.`,
  },
  {
    key: "renaissance",
    number: 8,
    title: "Renaissance painting",
    prompt: `${IDENTITY} Classical original oil painting of this exact pet, museum lighting, ornate frame, renaissance palette.`,
  },
  {
    key: "beach-vacation",
    number: 9,
    title: "Beach vacation",
    prompt: `${IDENTITY} This exact pet on a golden-hour beach vacation, sunglasses, ocean, relaxed pose, photoreal.`,
  },
  {
    key: "head-chef",
    number: 10,
    title: "Head chef",
    prompt: `${IDENTITY} This exact pet as head chef in original whites, original kitchen, plated dish, warm restaurant light. No restaurant brands.`,
  },
  {
    key: "original-superhero",
    number: 11,
    title: "Original superhero",
    prompt: `${IDENTITY} This exact pet in an original invented superhero costume and cape. No existing comic or movie brands.`,
  },
  {
    key: "christmas-portrait",
    number: 12,
    title: "Christmas portrait",
    prompt: `${IDENTITY} Warm original holiday portrait of this exact pet, wreath, fireplace glow, festive but unbranded.`,
  },
] as const;

export function sceneByKey(key: string): SceneDefinition | undefined {
  return PET_SCENE_DEFINITIONS.find((scene) => scene.key === key);
}

export function personalityTone(personality: string): string {
  switch (personality) {
    case "funny":
      return "Slightly humorous, gift-ready expression.";
    case "royal":
      return "Regal posture and composed expression.";
    case "cute":
      return "Soft, adorable expression with gentle light.";
    case "badass":
      return "Confident, cinematic main-character energy.";
    case "luxury":
      return "Quiet luxury, refined styling.";
    case "adventure":
      return "Adventurous, outdoors-ready energy.";
    default:
      return "Natural expression that still matches the pet.";
  }
}

export function buildScenePrompt(input: {
  sceneKey: string;
  petName: string;
  species: string;
  personality: string;
}): string {
  const scene = sceneByKey(input.sceneKey);
  const speciesWord = input.species === "other" ? "pet" : input.species;
  const name = input.petName.replace(/[<>]/g, "").slice(0, 40);
  return [
    scene?.prompt || IDENTITY,
    `The subject is a ${speciesWord} named ${name}.`,
    personalityTone(input.personality),
    "Photoreal or high-craft illustration as the scene requires. Square-friendly portrait composition.",
  ].join(" ");
}
