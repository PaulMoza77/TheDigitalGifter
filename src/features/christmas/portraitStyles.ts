/**
 * Vertical-specific Christmas portrait styles (display + server-owned prompts).
 * Keys are stable; prompts must never be accepted from the browser.
 */

import type { ChristmasStyleDef } from "./styles";
import { CHRISTMAS_PHOTO_STYLES } from "./styles";

export { CHRISTMAS_PHOTO_STYLES };

export const CHRISTMAS_FAMILY_STYLES: ChristmasStyleDef[] = [
  {
    styleKey: "classic_family_christmas",
    displayName: "Classic Family Christmas",
    description: "Warm traditional family portrait by the tree.",
    enabled: true,
    sortOrder: 10,
    accent: "#c43c2c",
    promptTemplate:
      "Transform this family photo into a photoreal classic Christmas family portrait. Preserve the exact facial identity, approximate age, and likeness of every person. Keep the same number of people — do not add, remove, or clone anyone. Cohesive group posing near a decorated Christmas tree, soft warm lights, natural skin, no text, no watermark, no deformed hands.",
    negativeHints: "extra people, missing people, cloned faces, cartoon, text, watermark, deformed hands",
  },
  {
    styleKey: "family_cozy_fireplace",
    displayName: "Cozy Fireplace",
    description: "Family gathered in firelight.",
    enabled: true,
    sortOrder: 20,
    accent: "#d97706",
    promptTemplate:
      "Transform this family photo into a photoreal cozy fireplace Christmas portrait. Preserve every person's exact identity and keep the same headcount. Warm fireplace glow, soft knit textures, natural grouping, no text, no watermark, no extra limbs.",
    negativeHints: "extra people, missing people, cartoon, text, watermark",
  },
  {
    styleKey: "family_winter_wonderland",
    displayName: "Winter Wonderland",
    description: "Snowy outdoor family Christmas magic.",
    enabled: true,
    sortOrder: 30,
    accent: "#6b9bd1",
    promptTemplate:
      "Transform this family photo into a photoreal winter wonderland Christmas portrait. Preserve exact identities and the same number of people. Soft snow, evergreens, cool blue-hour light with warm lanterns. Natural proportions, no text, no watermark.",
    negativeHints: "extra people, missing people, cartoon, text, watermark",
  },
  {
    styleKey: "family_elegant_christmas",
    displayName: "Elegant Christmas",
    description: "Refined holiday evening family portrait.",
    enabled: true,
    sortOrder: 40,
    accent: "#a16207",
    promptTemplate:
      "Transform this family photo into a photoreal elegant Christmas evening portrait. Preserve every face identity and keep the same number of people. Tasteful gold accents, formal soft lighting, upscale holiday backdrop. No text, no watermark.",
    negativeHints: "extra people, missing people, cartoon, text, watermark",
  },
  {
    styleKey: "family_christmas_morning",
    displayName: "Christmas Morning",
    description: "Soft morning light and festive calm.",
    enabled: true,
    sortOrder: 50,
    accent: "#f59e0b",
    promptTemplate:
      "Transform this family photo into a photoreal Christmas morning portrait. Preserve exact identities and headcount. Soft daylight, subtle wrapping-paper tones, calm festive living room. Natural skin, no text, no watermark.",
    negativeHints: "extra people, missing people, cartoon, text, watermark",
  },
  {
    styleKey: "family_luxury_christmas",
    displayName: "Luxury Christmas",
    description: "Polished boutique-holiday family portrait.",
    enabled: true,
    sortOrder: 60,
    accent: "#854d0e",
    promptTemplate:
      "Transform this family photo into a photoreal luxury Christmas portrait. Preserve exact identities and the same number of people. Refined décor, soft cinematic lighting, magazine-portrait quality without plastic skin. No text, no watermark.",
    negativeHints: "extra people, missing people, plastic skin, cartoon, text, watermark",
  },
  {
    styleKey: "family_christmas_movie",
    displayName: "Christmas Movie",
    description: "Cinematic holiday still of the family.",
    enabled: true,
    sortOrder: 70,
    accent: "#7c3aed",
    promptTemplate:
      "Transform this family photo into a photoreal Christmas-movie cinematic still. Preserve exact identities and headcount. Soft anamorphic bokeh, warm practical lights, storybook porch or living room. No logos, no text, no watermark.",
    negativeHints: "extra people, missing people, logos, cartoon, text, watermark",
  },
  {
    styleKey: "family_vintage_christmas",
    displayName: "Vintage Family Christmas",
    description: "Nostalgic film-era family warmth.",
    enabled: true,
    sortOrder: 80,
    accent: "#92400e",
    promptTemplate:
      "Transform this family photo into a photoreal vintage Christmas family portrait with gentle film grain. Preserve exact identities and the same number of people. Mid-century holiday décor cues, soft vignette, natural skin. No text, no watermark.",
    negativeHints: "extra people, missing people, cartoon, text, watermark, heavy filter obscuring faces",
  },
];

export const CHRISTMAS_COUPLE_STYLES: ChristmasStyleDef[] = [
  {
    styleKey: "romantic_snowfall",
    displayName: "Romantic Snowfall",
    description: "Soft snow and intimate winter light.",
    enabled: true,
    sortOrder: 10,
    accent: "#93c5fd",
    promptTemplate:
      "Transform this couple photo into a photoreal romantic Christmas snowfall portrait. Preserve both people's exact facial identities. Keep exactly two people — do not merge, clone, or drop either person. Soft falling snow, warm lantern glow, intimate pose, natural skin, no text, no watermark.",
    negativeHints: "one person, three people, merged faces, cartoon, text, watermark",
  },
  {
    styleKey: "couple_cozy_fireplace",
    displayName: "Cozy Fireplace",
    description: "Firelight couple portrait.",
    enabled: true,
    sortOrder: 20,
    accent: "#d97706",
    promptTemplate:
      "Transform this couple photo into a photoreal cozy fireplace Christmas portrait. Preserve both identities exactly and keep two people only. Warm fireplace glow, soft textures, romantic but natural pose. No text, no watermark.",
    negativeHints: "one person, extra people, cartoon, text, watermark",
  },
  {
    styleKey: "couple_christmas_movie",
    displayName: "Christmas Movie",
    description: "Cinematic holiday couple still.",
    enabled: true,
    sortOrder: 30,
    accent: "#7c3aed",
    promptTemplate:
      "Transform this couple photo into a photoreal Christmas-movie cinematic portrait. Preserve both faces exactly; keep two people. Soft bokeh, warm practical lights, storybook holiday street. No logos, no text, no watermark.",
    negativeHints: "one person, logos, cartoon, text, watermark",
  },
  {
    styleKey: "couple_elegant_christmas",
    displayName: "Elegant Christmas",
    description: "Evening formal couple portrait.",
    enabled: true,
    sortOrder: 40,
    accent: "#a16207",
    promptTemplate:
      "Transform this couple photo into a photoreal elegant Christmas evening portrait. Preserve both identities; keep exactly two people. Tasteful gold accents, soft formal lighting. No text, no watermark.",
    negativeHints: "one person, extra people, cartoon, text, watermark",
  },
  {
    styleKey: "couple_winter_city",
    displayName: "Winter City",
    description: "City lights and winter coats.",
    enabled: true,
    sortOrder: 50,
    accent: "#64748b",
    promptTemplate:
      "Transform this couple photo into a photoreal winter-city Christmas portrait. Preserve both identities; keep two people. Soft city bokeh, festive lights, realistic winter clothing. No text, no watermark.",
    negativeHints: "one person, cartoon, text, watermark",
  },
  {
    styleKey: "couple_christmas_market",
    displayName: "Christmas Market",
    description: "Festive market glow behind you.",
    enabled: true,
    sortOrder: 60,
    accent: "#c2410c",
    promptTemplate:
      "Transform this couple photo into a photoreal Christmas market portrait. Preserve both identities; keep exactly two people. Warm stall lights, subtle festive atmosphere, natural skin. No text, no watermark.",
    negativeHints: "one person, extra people, cartoon, text, watermark",
  },
  {
    styleKey: "couple_classic_portrait",
    displayName: "Classic Portrait",
    description: "Timeless studio-style couple Christmas look.",
    enabled: true,
    sortOrder: 70,
    accent: "#c43c2c",
    promptTemplate:
      "Transform this couple photo into a photoreal classic Christmas couple portrait. Preserve both facial identities exactly; keep two people. Soft portrait lighting, subtle tree bokeh. No text, no watermark.",
    negativeHints: "one person, cartoon, text, watermark",
  },
  {
    styleKey: "couple_vintage_christmas",
    displayName: "Vintage Christmas",
    description: "Nostalgic film-era couple warmth.",
    enabled: true,
    sortOrder: 80,
    accent: "#92400e",
    promptTemplate:
      "Transform this couple photo into a photoreal vintage Christmas portrait with gentle film grain. Preserve both identities; keep two people. Mid-century holiday cues, soft vignette. No text, no watermark.",
    negativeHints: "one person, cartoon, text, watermark, heavy filter",
  },
];

export const CHRISTMAS_PET_STYLES: ChristmasStyleDef[] = [
  {
    styleKey: "santa_pet",
    displayName: "Santa Pet",
    description: "Festive Santa-inspired pet portrait.",
    enabled: true,
    sortOrder: 10,
    accent: "#c43c2c",
    promptTemplate:
      "Transform this pet photo into a photoreal Santa Christmas pet portrait. Preserve the exact species, coat colors, markings, and facial characteristics. Do not change the animal into a different species or add extra animals. Subtle festive Santa-hat or scarf prop only if it does not hide the face. Soft warm Christmas lighting, no text, no watermark.",
    negativeHints: "wrong species, extra animals, human face, cartoon, text, watermark",
  },
  {
    styleKey: "pet_cozy_christmas",
    displayName: "Cozy Christmas",
    description: "Firelight and soft blankets.",
    enabled: true,
    sortOrder: 20,
    accent: "#d97706",
    promptTemplate:
      "Transform this pet photo into a photoreal cozy Christmas pet portrait. Preserve exact species, coat pattern, and face. Fireplace glow, soft textures, no extra animals, no text, no watermark.",
    negativeHints: "wrong species, extra animals, cartoon, text, watermark",
  },
  {
    styleKey: "pet_north_pole",
    displayName: "North Pole",
    description: "Snowy magical pet portrait.",
    enabled: true,
    sortOrder: 30,
    accent: "#0e7490",
    promptTemplate:
      "Transform this pet photo into a photoreal North Pole Christmas pet portrait. Preserve species, coat, and facial identity. Soft snow and aurora accents that stay realistic. No extra animals, no text, no watermark.",
    negativeHints: "wrong species, extra animals, cartoon, text, watermark",
  },
  {
    styleKey: "pet_christmas_sweater",
    displayName: "Christmas Sweater",
    description: "Festive knit without hiding identity.",
    enabled: true,
    sortOrder: 40,
    accent: "#15803d",
    promptTemplate:
      "Transform this pet photo into a photoreal Christmas sweater pet portrait. Preserve exact species, markings, and face. A tasteful holiday sweater that does not obscure the face. Soft studio lighting, no extra animals, no text, no watermark.",
    negativeHints: "wrong species, face covered, extra animals, cartoon, text, watermark",
  },
  {
    styleKey: "pet_snow_portrait",
    displayName: "Snow Portrait",
    description: "Clean outdoor snow portrait.",
    enabled: true,
    sortOrder: 50,
    accent: "#6b9bd1",
    promptTemplate:
      "Transform this pet photo into a photoreal snow Christmas pet portrait. Preserve species, coat colors, and facial traits. Soft snowfall, evergreen bokeh, natural fur detail. No extra animals, no text, no watermark.",
    negativeHints: "wrong species, extra animals, cartoon, text, watermark",
  },
  {
    styleKey: "pet_christmas_card",
    displayName: "Christmas Card",
    description: "Greeting-card ready pet portrait.",
    enabled: true,
    sortOrder: 60,
    accent: "#b91c1c",
    promptTemplate:
      "Transform this pet photo into a photoreal Christmas-card pet portrait. Preserve exact species and likeness. Clean festive backdrop suitable for a card, but no readable text, logos, or watermarks in the image. No extra animals.",
    negativeHints: "wrong species, text, logos, watermark, extra animals, cartoon",
  },
  {
    styleKey: "pet_royal_christmas",
    displayName: "Royal Christmas",
    description: "Regal holiday pet portrait.",
    enabled: true,
    sortOrder: 70,
    accent: "#a16207",
    promptTemplate:
      "Transform this pet photo into a photoreal royal Christmas pet portrait. Preserve species, coat pattern, and face. Tasteful regal Christmas accents without distorting anatomy. No extra animals, no text, no watermark.",
    negativeHints: "wrong species, extra animals, deformed anatomy, cartoon, text, watermark",
  },
  {
    styleKey: "pet_vintage_christmas",
    displayName: "Vintage Christmas",
    description: "Nostalgic film-era pet portrait.",
    enabled: true,
    sortOrder: 80,
    accent: "#92400e",
    promptTemplate:
      "Transform this pet photo into a photoreal vintage Christmas pet portrait with gentle film grain. Preserve exact species, markings, and facial identity. Soft vignette, warm nostalgic tones. No extra animals, no text, no watermark.",
    negativeHints: "wrong species, extra animals, cartoon, text, watermark",
  },
];

/** Server + client: resolve a style for a commerce product key. */
export function stylesForProductKey(productKey: string): ChristmasStyleDef[] {
  switch (productKey) {
    case "christmas_family":
      return CHRISTMAS_FAMILY_STYLES;
    case "christmas_couple":
      return CHRISTMAS_COUPLE_STYLES;
    case "christmas_pet":
      return CHRISTMAS_PET_STYLES;
    case "christmas_photo":
    default:
      return CHRISTMAS_PHOTO_STYLES;
  }
}

export function resolveProductStyle(
  productKey: string,
  styleKey: string,
): ChristmasStyleDef | null {
  const styles = stylesForProductKey(productKey);
  const key = String(styleKey || "").trim();
  const style = styles.find((s) => s.styleKey === key) ?? null;
  if (!style || !style.enabled) return null;
  return style;
}
