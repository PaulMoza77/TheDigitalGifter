import type {
  PetPersonalityOption,
  PetSceneDefinition,
  PetSpeciesOption,
} from "./types";
import {
  PET_CURRENCY,
  PET_PRICE_CENTS,
  PET_PRICE_DISPLAY,
  PET_PRODUCT_NAME,
  PET_PRODUCT_PROMISE,
  PET_PRODUCT_SKU,
  PET_SCENE_COUNT,
} from "./types";

export const PET_OFFER = {
  sku: PET_PRODUCT_SKU,
  name: PET_PRODUCT_NAME,
  promise: PET_PRODUCT_PROMISE,
  priceCents: PET_PRICE_CENTS,
  priceDisplay: PET_PRICE_DISPLAY,
  currency: PET_CURRENCY,
  sceneCount: PET_SCENE_COUNT,
  billing: "one_time" as const,
  subscription: false,
  subscriptionCopy: "No subscription",
  includes: [
    "12 QC-approved portraits of the same pet",
    "Downloads of the generated portraits after human review",
    "Human quality control before you download",
  ] as const,
} as const;

export const PET_SPECIES_OPTIONS: readonly PetSpeciesOption[] = [
  { id: "dog", label: "Dog", hint: "The loyal lead. The side-eye specialist." },
  { id: "cat", label: "Cat", hint: "Already running the house. Now the gallery." },
  { id: "other", label: "Other", hint: "Rabbit, bird, or a very serious hamster." },
] as const;

export const PET_PERSONALITY_OPTIONS: readonly PetPersonalityOption[] = [
  {
    id: "funny",
    label: "Funny",
    description: "Comedy gold. Slightly unhinged. Perfect gift energy.",
  },
  {
    id: "royal",
    label: "Royal",
    description: "Velvet, posture, and a look that files taxes for you.",
  },
  {
    id: "cute",
    label: "Cute",
    description: "Soft lighting. Big eyes. Immediate heart-melting.",
  },
  {
    id: "badass",
    label: "Badass",
    description: "Wind in the fur. Zero apologies. Main character walk.",
  },
  {
    id: "luxury",
    label: "Luxury",
    description: "Quiet wealth. Better lighting. Treat budget unlimited.",
  },
  {
    id: "adventure",
    label: "Adventure",
    description: "Maps, missions, and a snack hidden in every scene.",
  },
] as const;

export const PET_SCENES: readonly PetSceneDefinition[] = [
  {
    id: "royal-portrait",
    number: 1,
    title: "Royal portrait",
    tagline: "A crown is optional. The stare is not.",
    promptHint: "Formal court portrait, ornate gold frame, same pet identity.",
    art: { from: "#3b2a12", to: "#c9a227", accent: "#f3e6c0" },
  },
  {
    id: "luxury-ceo",
    number: 2,
    title: "Luxury CEO",
    tagline: "Quarterly treats. Open office. Closed paws.",
    promptHint: "Executive portrait, city glass, tailored look, same pet.",
    art: { from: "#12151c", to: "#3d4a5c", accent: "#d7c4a3" },
  },
  {
    id: "astronaut",
    number: 3,
    title: "Astronaut",
    tagline: "One small step for paws. One giant leap for snacks.",
    promptHint: "Space suit visor, starfield, helmet reflection of the same pet.",
    art: { from: "#07111f", to: "#2457a6", accent: "#f0f4ff" },
  },
  {
    id: "formula-racer",
    number: 4,
    title: "Formula racing driver",
    tagline: "Pole position. Pit-stop belly rubs.",
    promptHint: "Original racing suit and helmet. No team logos. Same pet face.",
    art: { from: "#2a0b10", to: "#c1121f", accent: "#f4d35e" },
  },
  {
    id: "spa-bathtub",
    number: 5,
    title: "Spa / bathtub",
    tagline: "Cucumbers optional. Dignity non-negotiable.",
    promptHint: "Marble bath, bubbles, towel turban, calm lighting, same pet.",
    art: { from: "#14353a", to: "#7ec8c3", accent: "#f7f1e8" },
  },
  {
    id: "newspaper",
    number: 6,
    title: "Reading a newspaper",
    tagline: "Breaking news: nap moved to 2:15.",
    promptHint: "Generic broadsheet, reading glasses, cafe light, same pet.",
    art: { from: "#2b241c", to: "#8a7a62", accent: "#efe6d4" },
  },
  {
    id: "cinema-boss",
    number: 7,
    title: "Fictional cinema boss",
    tagline: "A made-up office. A very real glare.",
    promptHint:
      "Original fictional crime-drama office. Leather chair, lamp, no existing film characters.",
    art: { from: "#1a120c", to: "#6b3a22", accent: "#e7c9a0" },
  },
  {
    id: "renaissance",
    number: 8,
    title: "Renaissance painting",
    tagline: "Oil, velvet, and 400 years of side-eye.",
    promptHint: "Classical oil painting, museum lighting, ornate frame, same pet.",
    art: { from: "#2c1a10", to: "#8b5a2b", accent: "#e8d5a3" },
  },
  {
    id: "beach-vacation",
    number: 9,
    title: "Beach vacation",
    tagline: "Out of office. Still judging the seagulls.",
    promptHint: "Golden hour beach, sunglasses, ocean, relaxed pose, same pet.",
    art: { from: "#12364a", to: "#f2b441", accent: "#fff4d6" },
  },
  {
    id: "head-chef",
    number: 10,
    title: "Head chef",
    tagline: "The kitchen is closed. The critic is furry.",
    promptHint: "Chef whites, original kitchen, plated dish, same pet identity.",
    art: { from: "#1d1714", to: "#a33b20", accent: "#f3e6d8" },
  },
  {
    id: "original-superhero",
    number: 11,
    title: "Original superhero",
    tagline: "A cape we invented. A city they already own.",
    promptHint: "Original hero costume, no existing comic brands, same pet face.",
    art: { from: "#1b1030", to: "#5b2d8e", accent: "#f2c14e" },
  },
  {
    id: "christmas-portrait",
    number: 12,
    title: "Christmas portrait",
    tagline: "The annual card that actually gets framed.",
    promptHint: "Warm holiday portrait, wreath, fireplace glow, same pet.",
    art: { from: "#1c2a1c", to: "#b4232d", accent: "#f0d48a" },
  },
] as const;

export const PET_RESULT_FORMATS = [
  {
    kind: "high_res" as const,
    label: "QC-approved portrait",
    description: "The generated portrait file, released after a person confirms it is the same pet.",
    comingLater: false,
  },
  {
    kind: "wallpaper" as const,
    label: "Phone wallpaper",
    description: "Vertical crop for a lock screen.",
    comingLater: true,
  },
  {
    kind: "social" as const,
    label: "Social format",
    description: "Square crop for a post, story, or gift reveal.",
    comingLater: true,
  },
  {
    kind: "poster" as const,
    label: "Printable poster",
    description: "Poster-ready file with print-safe margins.",
    comingLater: true,
  },
] as const;

export const PET_HOW_IT_WORKS = [
  {
    step: 1,
    title: "Upload one photo",
    body: "A clear, well-lit shot of their face. JPEG, PNG or WebP, up to 15 MB.",
  },
  {
    step: 2,
    title: "Name the legend",
    body: "Tell us who they are, dog or cat or otherwise, and the vibe they deserve.",
  },
  {
    step: 3,
    title: "Pay once. Get twelve.",
    body: "No subscription. We generate 12 scenes of the same pet, then a human checks the faces.",
  },
] as const;

export const PET_FAQS = [
  {
    question: "Is this a subscription?",
    answer:
      "No. My Pet’s Secret Life is a one-time $59 payment. You are not enrolled in anything recurring.",
  },
  {
    question: "Will every portrait look like my pet?",
    answer:
      "That is the product. One source photo, twelve scenes, the same face throughout. A person reviews identity before downloads are released.",
  },
  {
    question: "How long does it take?",
    answer:
      "Most orders finish in under an hour after payment. You can watch scene-by-scene progress on the order page, and we email you when the gallery is ready.",
  },
  {
    question: "What photo works best?",
    answer:
      "A sharp, front-facing photo with even light and both eyes visible. Avoid heavy filters, sunglasses covering the face, and group shots. JPEG, PNG or WebP up to 15 MB.",
  },
  {
    question: "What files do I receive?",
    answer:
      "You receive 12 QC-approved portraits of the same pet. Each download is the generated image file at its real pixel size. Wallpaper, social, and poster crops are not included in this purchase and are marked Coming later.",
  },
  {
    question: "Can I gift this?",
    answer:
      "Yes. Use the recipient’s pet photo, pay once, and send them the order link when the gallery is ready. It is built as a gift, not a membership.",
  },
] as const;

export function getSceneById(id: PetSceneDefinition["id"]): PetSceneDefinition {
  const scene = PET_SCENES.find((item) => item.id === id);
  if (!scene) {
    throw new Error(`Unknown pet scene: ${id}`);
  }
  return scene;
}

export function formatPetPrice(): string {
  return PET_OFFER.priceDisplay;
}
