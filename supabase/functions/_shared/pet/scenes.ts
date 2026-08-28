import type { PetSceneKey } from "./constants.ts";

export type SceneDefinition = {
  key: PetSceneKey;
  number: number;
  title: string;
  edit: string;
};

/** Kontext edits the reference photo — identity lock must lead every prompt. */
export const IDENTITY_LOCK =
  "Use the uploaded pet photo as the authoritative identity reference. Create the same individual pet in the requested scene. Preserve its exact species, breed appearance, coat color and markings, facial structure, muzzle, ears, eye placement, fur length and texture, body proportions, and distinctive traits. Change only the environment, clothing/accessories, and pose needed for the scene. The final image must be immediately recognizable to the owner as the same pet. Do not swap breeds. Do not replace the animal with a generic dog or cat. Do not beautify beyond recognition.";

export const PET_SCENE_DEFINITIONS: readonly SceneDefinition[] = [
  {
    key: "royal-portrait",
    number: 1,
    title: "Royal portrait",
    edit: "Add a royal crown, ornate gold picture frame, and red velvet backdrop with museum lighting. No humans, logos, or second animals.",
  },
  {
    key: "luxury-ceo",
    number: 2,
    title: "Luxury CEO",
    edit: "Add a glass executive office, city skyline, and tailored suit on the same pet body. No humans or logos.",
  },
  {
    key: "astronaut",
    number: 3,
    title: "Astronaut",
    edit:
      "Add a white space suit with the helmet visor open so the pet's full face stays visible and unchanged. Starfield background. No logos. No humans.",
  },
  {
    key: "formula-racer",
    number: 4,
    title: "Formula racing driver",
    edit:
      "Add a racing-inspired suit only — no closed or full-face helmet; leave the head bare so ears, face, and any mane/ruff stay fully visible and identical to the reference. Preserve fluffy or dense coats exactly (never shorten into a sleek coat). Pet alone in the cockpit — no human driver behind the pet. No team names, brand marks, or commercial logos.",
  },
  {
    key: "spa-bathtub",
    number: 5,
    title: "Spa / bathtub",
    edit: "Add a marble bathtub with bubbles and a spa towel. Keep the pet's face and fur exactly as in the reference.",
  },
  {
    key: "newspaper",
    number: 6,
    title: "Reading a newspaper",
    edit:
      "Add a generic unbranded newspaper with unreadable text and a cafe background. Do not hide or replace the pet's face.",
  },
  {
    key: "cinema-boss",
    number: 7,
    title: "Fictional cinema boss",
    edit: "Add a dark leather chair, desk lamp, and moody office. Keep the pet's face unchanged. No film characters.",
  },
  {
    key: "renaissance",
    number: 8,
    title: "Renaissance painting",
    edit:
      "Add an ornate frame and warm classical background lighting. Keep the pet's face photoreal and identical to the reference.",
  },
  {
    key: "beach-vacation",
    number: 9,
    title: "Beach vacation",
    edit: "Add a golden-hour beach and ocean background. Sunglasses may rest on the head; eyes stay visible and unchanged.",
  },
  {
    key: "head-chef",
    number: 10,
    title: "Head chef",
    edit: "Add chef whites, a kitchen, and plated food. Keep the pet's face and fur exactly as in the reference.",
  },
  {
    key: "original-superhero",
    number: 11,
    title: "Original superhero",
    edit: "Add an original invented cape and costume. Keep the pet's face and fur unchanged. No comic brands.",
  },
  {
    key: "christmas-portrait",
    number: 12,
    title: "Christmas portrait",
    edit: "Add a wreath, fireplace glow, and festive background. Keep the pet's face and fur exactly as in the reference.",
  },
] as const;

export function sceneByKey(key: string): SceneDefinition | undefined {
  return PET_SCENE_DEFINITIONS.find((scene) => scene.key === key);
}

export function personalityTone(personality: string): string {
  switch (personality) {
    case "funny":
      return "Scene mood may feel playful; the pet's expression must stay true to the reference photo.";
    case "royal":
      return "Scene mood may feel regal; posture and expression must stay true to the reference photo.";
    case "cute":
      return "Scene lighting may feel soft; the pet's expression must stay true to the reference photo.";
    case "badass":
      return "Scene mood may feel cinematic; the pet's expression must stay true to the reference photo.";
    case "luxury":
      return "Scene styling may feel refined; the pet's expression must stay true to the reference photo.";
    case "adventure":
      return "Scene mood may feel adventurous; the pet's expression must stay true to the reference photo.";
    default:
      return "Keep the pet's natural expression from the reference photo.";
  }
}

export function buildScenePrompt(input: {
  sceneKey: string;
  petName: string;
  species: string;
  personality: string;
}): string {
  const scene = sceneByKey(input.sceneKey);
  const name = input.petName.replace(/[<>]/g, "").slice(0, 40);
  return [
    IDENTITY_LOCK,
    "Change only background, clothing, props, and lighting. Never replace the pet.",
    scene?.edit || "Minimal scene edit only.",
    `If any tag or label appears, it may read ${name}. The name must not change the pet's appearance.`,
    personalityTone(input.personality),
    "Photoreal. Single pet only. No logos, trademarks, or copyrighted characters.",
  ].join(" ");
}
