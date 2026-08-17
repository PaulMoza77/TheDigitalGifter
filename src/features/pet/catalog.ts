import type {
  PetPersonalityOption,
  PetSceneDefinition,
  PetSpecies,
  PetSpeciesOption,
  PetSubtype,
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
  videoCount: 2,
  clipDurationSeconds: 5,
  billing: "one_time" as const,
  subscription: false,
  subscriptionCopy: "No subscription",
  includes: [
    "12 portraits of the same pet",
    "2 cinematic 5-second clips",
    "Human review before download",
    "One-time price — no subscription",
  ] as const,
} as const;

export const PET_DEMO_SOURCE_IMAGE = "/pet/dog/source.webp";

export function petLandingPath(species: PetSpecies): string {
  return `/pet/${species}`;
}

export function petCreatePath(species: PetSpecies): string {
  return `/pet/create?species=${encodeURIComponent(species)}`;
}

export function petSourceImage(species: PetSpecies = "dog"): string {
  return `/pet/${species}/source.webp`;
}

export function sceneImageSrc(
  id: PetSceneDefinition["id"],
  species: PetSpecies = "dog",
): string {
  return `/pet/${species}/scenes/${id}.webp`;
}

export const PET_DEMO_CLIP_IDS = ["formula-racer", "spa-bathtub"] as const;
export type PetDemoClipId = (typeof PET_DEMO_CLIP_IDS)[number];

export function sceneClipSrc(
  id: PetSceneDefinition["id"],
  species: PetSpecies = "dog",
): string {
  return `/pet/${species}/clips/${id}.mp4`;
}

export function sceneHasMotionClip(id: PetSceneDefinition["id"]): boolean {
  return (PET_DEMO_CLIP_IDS as readonly string[]).includes(id);
}

export const PET_CLIP_COPY: Record<
  PetSpecies,
  { heading: string; description: string }
> = {
  dog: {
    heading: "Two cinematic clips",
    description: "Same pet. Five seconds. A world in motion.",
  },
  cat: {
    heading: "Two cinematic clips",
    description: "Same cat. Five seconds. A world in motion.",
  },
  other: {
    heading: "Two cinematic clips",
    description: "Five-second motion examples for different kinds of pets.",
  },
};

export function isPetSpecies(value: string | null | undefined): value is PetSpecies {
  return value === "dog" || value === "cat" || value === "other";
}

export function parsePetSpecies(value: string | null | undefined): PetSpecies {
  return isPetSpecies(value) ? value : "dog";
}

export const PET_OTHER_SUBJECTS: Record<PetSceneDefinition["id"], string> = {
  "royal-portrait": "Turtle",
  "luxury-ceo": "Macaw",
  astronaut: "Hamster",
  "formula-racer": "Rabbit",
  "spa-bathtub": "Hedgehog",
  newspaper: "Guinea pig",
  "cinema-boss": "Bearded dragon",
  renaissance: "Ferret",
  "beach-vacation": "Goldfish",
  "head-chef": "Mini pig",
  "original-superhero": "Chameleon",
  "christmas-portrait": "Cockatiel",
};

export const PET_LANDING_COPY: Record<
  PetSpecies,
  { heading: string; description: string; support: string }
> = {
  dog: {
    heading: "Twelve secret lives",
    description: "Hover or tap a portrait to watch it move. Same Golden Retriever. A different world in every frame.",
    support: "Turn your dog into royalty, an astronaut, a CEO and nine more secret lives.",
  },
  cat: {
    heading: "Twelve secret lives",
    description: "Hover or tap a portrait to watch it move. Same cat. A different world in every frame.",
    support: "Turn your cat into royalty, an astronaut, a CEO and nine more secret lives.",
  },
  other: {
    heading: "Made for many kinds of pets",
    description: "Hover or tap a portrait to watch it move. Every pet deserves a secret life.",
    support: "Every pet deserves a secret life.",
  },
};

export const PET_HERO_SUBTITLE =
  "See your pet as royalty, an astronaut, a CEO and more — the same face in every world.";

export const PET_HERO_PROMISE = "One photo. 12 secret lives. 2 cinematic clips.";

export const PET_SUBTYPE_OPTIONS: readonly { id: PetSubtype; label: string }[] = [
  { id: "rabbit", label: "Rabbit" },
  { id: "bird", label: "Bird" },
  { id: "small_pet", label: "Small pet" },
  { id: "reptile", label: "Reptile" },
  { id: "horse", label: "Horse" },
  { id: "other", label: "Other" },
] as const;

export const PET_SEO: Record<
  PetSpecies,
  { title: string; description: string; path: string; ogImage: string }
> = {
  dog: {
    title: "Custom Dog Portraits & Videos | My Pet’s Secret Life",
    description:
      "Turn one photo of your dog into 12 personalized portraits and 2 cinematic 5-second clips. Same face in every world. One-time payment. No subscription.",
    path: "/pet/dog",
    ogImage: "https://www.thedigitalgifter.com/pet/dog/scenes/royal-portrait.webp",
  },
  cat: {
    title: "Custom Cat Portraits & Videos | My Pet’s Secret Life",
    description:
      "Turn one photo of your cat into 12 personalized portraits and 2 cinematic 5-second clips. Same face in every world. One-time payment. No subscription.",
    path: "/pet/cat",
    ogImage: "https://www.thedigitalgifter.com/pet/cat/scenes/royal-portrait.webp",
  },
  other: {
    title: "Custom Pet Portraits & Videos | My Pet’s Secret Life",
    description:
      "Custom portraits and cinematic clips for rabbits, birds, small pets, reptiles, horses, and other animals. One photo. Human reviewed. One-time payment.",
    path: "/pet/other",
    ogImage: "https://www.thedigitalgifter.com/pet/other/scenes/formula-racer.webp",
  },
};

export type PetTestimonial = {
  customerFirstName: string;
  petName: string;
  species: PetSpecies;
  quote: string;
  beforeSrc?: string;
  afterSrc?: string;
};

/** Hidden until real approved testimonials exist. Do not invent quotes. */
export const PET_TESTIMONIALS: readonly PetTestimonial[] = [];

export const PET_GUARANTEE = {
  heading: "The Same Pet Guarantee",
  body: "Every portrait and clip is checked by a person. If a result does not recognizably look like your pet, we remake it before delivery.",
  href: "/support",
} as const;

export const PET_SPECIES_OPTIONS: readonly PetSpeciesOption[] = [
  { id: "dog", label: "Dog", hint: "Dog" },
  { id: "cat", label: "Cat", hint: "Cat" },
  { id: "other", label: "Other", hint: "Other pet" },
] as const;

export const PET_PERSONALITY_OPTIONS: readonly PetPersonalityOption[] = [
  { id: "funny", label: "Funny", description: "Funny" },
  { id: "royal", label: "Royal", description: "Royal" },
  { id: "cute", label: "Cute", description: "Cute" },
  { id: "badass", label: "Badass", description: "Badass" },
  { id: "luxury", label: "Luxury", description: "Luxury" },
  { id: "adventure", label: "Adventure", description: "Adventure" },
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
    title: "Name your pet",
    body: "A first name is enough. No charge yet.",
  },
  {
    step: 2,
    title: "Upload one photo",
    body: "A clear face, looking forward. Add your email.",
  },
  {
    step: 3,
    title: "Review and pay once",
    body: "No subscription. No renewal. Stripe checkout.",
  },
  {
    step: 4,
    title: "Get 12 portraits and 2 clips",
    body: "Same pet. Human-checked. Delivery only after QC.",
  },
] as const;

export const PET_FAQS = [
  {
    question: "Is this a subscription?",
    answer: "No. One-time payment. Nothing renews.",
  },
  {
    question: "Will it look like my pet?",
    answer:
      "Yes — that is the product. One photo, twelve scenes, two cinematic clips, the same face. A person checks before you download.",
  },
  {
    question: "How long does it take?",
    answer:
      "Usually ready within 24–48 hours. Portraits are generated first, then a person reviews them, then two clips are made and reviewed. We email you when the gallery is ready.",
  },
  {
    question: "What photo works best?",
    answer:
      "One pet, face toward the camera, both eyes visible, even light. No group shots or heavy filters.",
  },
  {
    question: "Can I gift this?",
    answer: "Yes. Use their pet’s photo, pay once, and send the gallery link.",
  },
  {
    question: "What if a portrait does not look like my pet?",
    answer:
      "A person checks every portrait and clip. If a result does not recognizably look like your pet, we remake it before delivery. Contact support from your order email if you need help.",
  },
  {
    question: "Is my source photo private?",
    answer:
      "Your photo is used only to create this order. It is not used as public marketing. We do not sell it.",
  },
  {
    question: "Can I include multiple pets?",
    answer:
      "Not in one order. Use one clear photo with one pet. Group photos are rejected before generation.",
  },
  {
    question: "What does “human checked” mean?",
    answer:
      "After generation, a person reviews the faces and clips. Downloads stay locked until that review is approved.",
  },
  {
    question: "What file formats do I receive?",
    answer:
      "You receive the QC-approved portrait files and two cinematic MP4 clips from the order gallery after review. Extra crops such as wallpapers are not included yet.",
  },
] as const;

export function petFaqsWithDelivery(estimate: string) {
  return PET_FAQS.map((faq) =>
    faq.question === "How long does it take?"
      ? {
          ...faq,
          answer: `${estimate} Portraits are generated first, then a person reviews them, then two clips are made and reviewed. We email you when the gallery is ready.`,
        }
      : faq,
  );
}

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
