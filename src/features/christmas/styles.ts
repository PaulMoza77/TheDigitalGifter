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
    styleKey: "classic_christmas",
    displayName: "Classic Christmas",
    description: "Warm traditional Christmas portrait lighting.",
    enabled: true,
    sortOrder: 10,
    accent: "#c43c2c",
    promptTemplate:
      "Transform this photo into a photoreal classic Christmas portrait. Preserve the exact face identity, age, and likeness of every person. Place them in a timeless Christmas living-room scene with a decorated tree, soft warm lights, and gentle bokeh. Natural skin texture, flattering portrait lighting, no text, no watermark, no extra people, no deformed hands.",
    negativeHints: "cartoon, anime, text, watermark, extra limbs, deformed face",
  },
  {
    styleKey: "winter_wonderland",
    displayName: "Winter Wonderland",
    description: "Snowy outdoor Christmas magic.",
    enabled: true,
    sortOrder: 20,
    accent: "#6b9bd1",
    promptTemplate:
      "Transform this photo into a photoreal winter wonderland Christmas portrait. Preserve exact facial identity and likeness. Soft falling snow, evergreen trees, cool blue-hour light mixed with warm lantern glow. Natural skin, cinematic but realistic, no text, no watermark, no extra people.",
    negativeHints: "cartoon, text, watermark, plastic skin, extra limbs",
  },
  {
    styleKey: "santas_workshop",
    displayName: "Santa's Workshop",
    description: "Cozy North Pole workshop ambiance.",
    enabled: true,
    sortOrder: 30,
    accent: "#b45309",
    promptTemplate:
      "Transform this photo into a photoreal Santa's workshop Christmas portrait. Preserve exact facial identity and likeness. Background of wooden toys, warm workshop lamps, subtle festive props. Keep the person as the hero subject. Natural proportions, no text, no watermark, no costume forced onto face.",
    negativeHints: "cartoon, text, watermark, uncanny face morph",
  },
  {
    styleKey: "cozy_fireplace",
    displayName: "Cozy Fireplace",
    description: "Firelight glow and soft blankets.",
    enabled: true,
    sortOrder: 40,
    accent: "#d97706",
    promptTemplate:
      "Transform this photo into a photoreal cozy fireplace Christmas portrait. Preserve exact facial identity and likeness. Warm fireplace glow, soft knit textures, intimate holiday atmosphere. Natural skin, shallow depth of field, no text, no watermark, no extra limbs.",
    negativeHints: "cartoon, text, watermark, melted face",
  },
  {
    styleKey: "elegant_christmas",
    displayName: "Elegant Christmas",
    description: "Refined holiday evening portrait.",
    enabled: true,
    sortOrder: 50,
    accent: "#a16207",
    promptTemplate:
      "Transform this photo into a photoreal elegant Christmas evening portrait. Preserve exact facial identity and likeness. Tasteful gold accents, formal soft lighting, upscale holiday backdrop. Photoreal fashion-portrait quality, no text, no watermark, no extra people.",
    negativeHints: "cartoon, text, watermark, oversharpened skin",
  },
  {
    styleKey: "north_pole",
    displayName: "North Pole",
    description: "Aurora sky and icy magic.",
    enabled: true,
    sortOrder: 60,
    accent: "#0e7490",
    promptTemplate:
      "Transform this photo into a photoreal North Pole Christmas portrait. Preserve exact facial identity and likeness. Soft aurora sky, snow crystals, magical but realistic atmosphere. Natural face detail, no text, no watermark, no deformed anatomy.",
    negativeHints: "cartoon, text, watermark, neon overload",
  },
  {
    styleKey: "christmas_movie",
    displayName: "Christmas Movie",
    description: "Cinematic holiday still-frame look.",
    enabled: true,
    sortOrder: 70,
    accent: "#7c3aed",
    promptTemplate:
      "Transform this photo into a photoreal Christmas-movie cinematic portrait. Preserve exact facial identity and likeness. Soft anamorphic bokeh, warm practical lights, storybook holiday street or porch. Film still aesthetic, no logos, no text, no watermark.",
    negativeHints: "cartoon, text, watermark, logo, title card",
  },
  {
    styleKey: "vintage_christmas",
    displayName: "Vintage Christmas",
    description: "Nostalgic film-era Christmas warmth.",
    enabled: true,
    sortOrder: 80,
    accent: "#92400e",
    promptTemplate:
      "Transform this photo into a photoreal vintage Christmas portrait with gentle film grain and warm nostalgic tones. Preserve exact facial identity and likeness. Mid-century holiday décor cues, soft vignette, natural skin, no text, no watermark, no heavy filters that hide the face.",
    negativeHints: "cartoon, text, watermark, heavy filter that obscures identity",
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
