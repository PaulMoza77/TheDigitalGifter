/**
 * Christmas Photo styles — language-independent keys + server-owned prompts.
 * UI reads display fields only; generation uses promptTemplate from this config / DB.
 */

export type ChristmasStyleDef = {
  styleKey: string;
  displayName: string;
  description: string;
  enabled: boolean;
  sortOrder: number;
  /** Accent for style cards (no fake customer photos). */
  accent: string;
  promptTemplate: string;
  negativeHints: string;
};

export const CHRISTMAS_PHOTO_STYLES: ChristmasStyleDef[] = [
  {
    styleKey: "cozy_fireplace",
    displayName: "Cozy Christmas",
    description: "Fireplace, warm lights, Christmas tree.",
    enabled: true,
    sortOrder: 10,
    accent: "#d97706",
    promptTemplate:
      "Transform this photo into a photoreal cozy fireplace Christmas portrait. Preserve exact facial identity and likeness. Warm fireplace glow, soft knit textures, intimate holiday atmosphere. Natural skin, shallow depth of field, no text, no watermark, no extra limbs.",
    negativeHints: "cartoon, text, watermark, melted face",
  },
  {
    styleKey: "winter_wonderland",
    displayName: "Winter Wonderland",
    description: "Snow, elegant winter atmosphere.",
    enabled: true,
    sortOrder: 20,
    accent: "#6b9bd1",
    promptTemplate:
      "Transform this photo into a photoreal winter wonderland Christmas portrait. Preserve exact facial identity and likeness. Soft falling snow, evergreen trees, cool blue-hour light mixed with warm lantern glow. Natural skin, cinematic but realistic, no text, no watermark, no extra people.",
    negativeHints: "cartoon, text, watermark, plastic skin, extra limbs",
  },
  {
    styleKey: "vintage_christmas",
    displayName: "Luxury Christmas",
    description: "Premium room, sophisticated gold details.",
    enabled: true,
    sortOrder: 30,
    accent: "#854d0e",
    promptTemplate:
      "Transform this photo into a photoreal vintage Christmas portrait with gentle film grain and warm nostalgic tones. Preserve exact facial identity and likeness. Mid-century holiday décor cues, soft vignette, natural skin, no text, no watermark, no heavy filters that hide the face.",
    negativeHints: "cartoon, text, watermark, heavy filter that obscures identity",
  },
  {
    styleKey: "christmas_movie",
    displayName: "Christmas Morning",
    description: "Warm home, presents, joyful atmosphere.",
    enabled: true,
    sortOrder: 40,
    accent: "#f59e0b",
    promptTemplate:
      "Transform this photo into a photoreal Christmas-movie cinematic portrait. Preserve exact facial identity and likeness. Soft anamorphic bokeh, warm practical lights, storybook holiday street or porch. Film still aesthetic, no logos, no text, no watermark.",
    negativeHints: "cartoon, text, watermark, logo, title card",
  },
  {
    styleKey: "north_pole",
    displayName: "Snowy Cabin",
    description: "Mountain cabin, snow, fireplace glow.",
    enabled: true,
    sortOrder: 50,
    accent: "#0e7490",
    promptTemplate:
      "Transform this photo into a photoreal North Pole Christmas portrait. Preserve exact facial identity and likeness. Soft aurora sky, snow crystals, magical but realistic atmosphere. Natural face detail, no text, no watermark, no deformed anatomy.",
    negativeHints: "cartoon, text, watermark, neon overload",
  },
  {
    styleKey: "classic_christmas",
    displayName: "Classic Christmas",
    description: "Traditional red, green and gold.",
    enabled: true,
    sortOrder: 60,
    accent: "#c43c2c",
    promptTemplate:
      "Transform this photo into a photoreal classic Christmas portrait. Preserve the exact face identity, age, and likeness of every person. Place them in a timeless Christmas living-room scene with a decorated tree, soft warm lights, and gentle bokeh. Natural skin texture, flattering portrait lighting, no text, no watermark, no extra people, no deformed hands.",
    negativeHints: "cartoon, anime, text, watermark, extra limbs, deformed face",
  },
  {
    styleKey: "elegant_christmas",
    displayName: "Elegant White Christmas",
    description: "Bright, sophisticated winter style.",
    enabled: true,
    sortOrder: 70,
    accent: "#a16207",
    promptTemplate:
      "Transform this photo into a photoreal elegant Christmas evening portrait. Preserve exact facial identity and likeness. Tasteful gold accents, formal soft lighting, upscale holiday backdrop. Photoreal fashion-portrait quality, no text, no watermark, no extra people.",
    negativeHints: "cartoon, text, watermark, oversharpened skin",
  },
  {
    styleKey: "santas_workshop",
    displayName: "Christmas Market",
    description: "European festive lights and atmosphere.",
    enabled: true,
    sortOrder: 80,
    accent: "#b45309",
    promptTemplate:
      "Transform this photo into a photoreal Santa's workshop Christmas portrait. Preserve exact facial identity and likeness. Background of wooden toys, warm workshop lamps, subtle festive props. Keep the person as the hero subject. Natural proportions, no text, no watermark, no costume forced onto face.",
    negativeHints: "cartoon, text, watermark, uncanny face morph",
  },
];

export function enabledChristmasStyles(
  styles: ChristmasStyleDef[] = CHRISTMAS_PHOTO_STYLES,
): ChristmasStyleDef[] {
  return styles.filter((s) => s.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function resolveChristmasStyle(
  styleKey: string,
  styles: ChristmasStyleDef[] = CHRISTMAS_PHOTO_STYLES,
): ChristmasStyleDef | null {
  const key = String(styleKey || "").trim();
  const style = styles.find((s) => s.styleKey === key) ?? null;
  if (!style || !style.enabled) return null;
  return style;
}

export function buildChristmasGenerationPrompt(style: ChristmasStyleDef): string {
  return `${style.promptTemplate} Avoid: ${style.negativeHints}.`;
}
