/**
 * Server-owned Christmas portrait prompt registry.
 * Mirrors src/features/christmas/portraitStyles.ts + styles.ts.
 * Never accept arbitrary prompt text from the browser.
 */

export type ChristmasPromptStyle = {
  styleKey: string;
  displayName: string;
  enabled: boolean;
  promptTemplate: string;
  negativeHints: string;
};

const REGISTRY: Record<string, ChristmasPromptStyle[]> = {
  "christmas_photo": [
    {
      "styleKey": "classic_christmas",
      "displayName": "Classic Christmas",
      "enabled": true,
      "promptTemplate": "Transform this photo into a photoreal classic Christmas portrait. Preserve the exact face identity, age, and likeness of every person. Place them in a timeless Christmas living-room scene with a decorated tree, soft warm lights, and gentle bokeh. Natural skin texture, flattering portrait lighting, no text, no watermark, no extra people, no deformed hands.",
      "negativeHints": "cartoon, anime, text, watermark, extra limbs, deformed face"
    },
    {
      "styleKey": "winter_wonderland",
      "displayName": "Winter Wonderland",
      "enabled": true,
      "promptTemplate": "Transform this photo into a photoreal winter wonderland Christmas portrait. Preserve exact facial identity and likeness. Soft falling snow, evergreen trees, cool blue-hour light mixed with warm lantern glow. Natural skin, cinematic but realistic, no text, no watermark, no extra people.",
      "negativeHints": "cartoon, text, watermark, plastic skin, extra limbs"
    },
    {
      "styleKey": "santas_workshop",
      "displayName": "Santa's Workshop",
      "enabled": true,
      "promptTemplate": "Transform this photo into a photoreal Santa's workshop Christmas portrait. Preserve exact facial identity and likeness. Background of wooden toys, warm workshop lamps, subtle festive props. Keep the person as the hero subject. Natural proportions, no text, no watermark, no costume forced onto face.",
      "negativeHints": "cartoon, text, watermark, uncanny face morph"
    },
    {
      "styleKey": "cozy_fireplace",
      "displayName": "Cozy Fireplace",
      "enabled": true,
      "promptTemplate": "Transform this photo into a photoreal cozy fireplace Christmas portrait. Preserve exact facial identity and likeness. Warm fireplace glow, soft knit textures, intimate holiday atmosphere. Natural skin, shallow depth of field, no text, no watermark, no extra limbs.",
      "negativeHints": "cartoon, text, watermark, melted face"
    },
    {
      "styleKey": "elegant_christmas",
      "displayName": "Elegant Christmas",
      "enabled": true,
      "promptTemplate": "Transform this photo into a photoreal elegant Christmas evening portrait. Preserve exact facial identity and likeness. Tasteful gold accents, formal soft lighting, upscale holiday backdrop. Photoreal fashion-portrait quality, no text, no watermark, no extra people.",
      "negativeHints": "cartoon, text, watermark, oversharpened skin"
    },
    {
      "styleKey": "north_pole",
      "displayName": "North Pole",
      "enabled": true,
      "promptTemplate": "Transform this photo into a photoreal North Pole Christmas portrait. Preserve exact facial identity and likeness. Soft aurora sky, snow crystals, magical but realistic atmosphere. Natural face detail, no text, no watermark, no deformed anatomy.",
      "negativeHints": "cartoon, text, watermark, neon overload"
    },
    {
      "styleKey": "christmas_movie",
      "displayName": "Christmas Movie",
      "enabled": true,
      "promptTemplate": "Transform this photo into a photoreal Christmas-movie cinematic portrait. Preserve exact facial identity and likeness. Soft anamorphic bokeh, warm practical lights, storybook holiday street or porch. Film still aesthetic, no logos, no text, no watermark.",
      "negativeHints": "cartoon, text, watermark, logo, title card"
    },
    {
      "styleKey": "vintage_christmas",
      "displayName": "Vintage Christmas",
      "enabled": true,
      "promptTemplate": "Transform this photo into a photoreal vintage Christmas portrait with gentle film grain and warm nostalgic tones. Preserve exact facial identity and likeness. Mid-century holiday décor cues, soft vignette, natural skin, no text, no watermark, no heavy filters that hide the face.",
      "negativeHints": "cartoon, text, watermark, heavy filter that obscures identity"
    }
  ],
  "christmas_family": [
    {
      "styleKey": "classic_family_christmas",
      "displayName": "Classic Family Christmas",
      "enabled": true,
      "promptTemplate": "Transform this family photo into a photoreal classic Christmas family portrait. Preserve the exact facial identity, approximate age, and likeness of every person. Keep the same number of people — do not add, remove, or clone anyone. Cohesive group posing near a decorated Christmas tree, soft warm lights, natural skin, no text, no watermark, no deformed hands.",
      "negativeHints": "extra people, missing people, cloned faces, cartoon, text, watermark, deformed hands"
    },
    {
      "styleKey": "family_cozy_fireplace",
      "displayName": "Cozy Fireplace",
      "enabled": true,
      "promptTemplate": "Transform this family photo into a photoreal cozy fireplace Christmas portrait. Preserve every person's exact identity and keep the same headcount. Warm fireplace glow, soft knit textures, natural grouping, no text, no watermark, no extra limbs.",
      "negativeHints": "extra people, missing people, cartoon, text, watermark"
    },
    {
      "styleKey": "family_winter_wonderland",
      "displayName": "Winter Wonderland",
      "enabled": true,
      "promptTemplate": "Transform this family photo into a photoreal winter wonderland Christmas portrait. Preserve exact identities and the same number of people. Soft snow, evergreens, cool blue-hour light with warm lanterns. Natural proportions, no text, no watermark.",
      "negativeHints": "extra people, missing people, cartoon, text, watermark"
    },
    {
      "styleKey": "family_elegant_christmas",
      "displayName": "Elegant Christmas",
      "enabled": true,
      "promptTemplate": "Transform this family photo into a photoreal elegant Christmas evening portrait. Preserve every face identity and keep the same number of people. Tasteful gold accents, formal soft lighting, upscale holiday backdrop. No text, no watermark.",
      "negativeHints": "extra people, missing people, cartoon, text, watermark"
    },
    {
      "styleKey": "family_christmas_morning",
      "displayName": "Christmas Morning",
      "enabled": true,
      "promptTemplate": "Transform this family photo into a photoreal Christmas morning portrait. Preserve exact identities and headcount. Soft daylight, subtle wrapping-paper tones, calm festive living room. Natural skin, no text, no watermark.",
      "negativeHints": "extra people, missing people, cartoon, text, watermark"
    },
    {
      "styleKey": "family_luxury_christmas",
      "displayName": "Luxury Christmas",
      "enabled": true,
      "promptTemplate": "Transform this family photo into a photoreal luxury Christmas portrait. Preserve exact identities and the same number of people. Refined décor, soft cinematic lighting, magazine-portrait quality without plastic skin. No text, no watermark.",
      "negativeHints": "extra people, missing people, plastic skin, cartoon, text, watermark"
    },
    {
      "styleKey": "family_christmas_movie",
      "displayName": "Christmas Movie",
      "enabled": true,
      "promptTemplate": "Transform this family photo into a photoreal Christmas-movie cinematic still. Preserve exact identities and headcount. Soft anamorphic bokeh, warm practical lights, storybook porch or living room. No logos, no text, no watermark.",
      "negativeHints": "extra people, missing people, logos, cartoon, text, watermark"
    },
    {
      "styleKey": "family_vintage_christmas",
      "displayName": "Vintage Family Christmas",
      "enabled": true,
      "promptTemplate": "Transform this family photo into a photoreal vintage Christmas family portrait with gentle film grain. Preserve exact identities and the same number of people. Mid-century holiday décor cues, soft vignette, natural skin. No text, no watermark.",
      "negativeHints": "extra people, missing people, cartoon, text, watermark, heavy filter obscuring faces"
    }
  ],
  "christmas_couple": [
    {
      "styleKey": "romantic_snowfall",
      "displayName": "Romantic Snowfall",
      "enabled": true,
      "promptTemplate": "Transform this couple photo into a photoreal romantic Christmas snowfall portrait. Preserve both people's exact facial identities. Keep exactly two people — do not merge, clone, or drop either person. Soft falling snow, warm lantern glow, intimate pose, natural skin, no text, no watermark.",
      "negativeHints": "one person, three people, merged faces, cartoon, text, watermark"
    },
    {
      "styleKey": "couple_cozy_fireplace",
      "displayName": "Cozy Fireplace",
      "enabled": true,
      "promptTemplate": "Transform this couple photo into a photoreal cozy fireplace Christmas portrait. Preserve both identities exactly and keep two people only. Warm fireplace glow, soft textures, romantic but natural pose. No text, no watermark.",
      "negativeHints": "one person, extra people, cartoon, text, watermark"
    },
    {
      "styleKey": "couple_christmas_movie",
      "displayName": "Christmas Movie",
      "enabled": true,
      "promptTemplate": "Transform this couple photo into a photoreal Christmas-movie cinematic portrait. Preserve both faces exactly; keep two people. Soft bokeh, warm practical lights, storybook holiday street. No logos, no text, no watermark.",
      "negativeHints": "one person, logos, cartoon, text, watermark"
    },
    {
      "styleKey": "couple_elegant_christmas",
      "displayName": "Elegant Christmas",
      "enabled": true,
      "promptTemplate": "Transform this couple photo into a photoreal elegant Christmas evening portrait. Preserve both identities; keep exactly two people. Tasteful gold accents, soft formal lighting. No text, no watermark.",
      "negativeHints": "one person, extra people, cartoon, text, watermark"
    },
    {
      "styleKey": "couple_winter_city",
      "displayName": "Winter City",
      "enabled": true,
      "promptTemplate": "Transform this couple photo into a photoreal winter-city Christmas portrait. Preserve both identities; keep two people. Soft city bokeh, festive lights, realistic winter clothing. No text, no watermark.",
      "negativeHints": "one person, cartoon, text, watermark"
    },
    {
      "styleKey": "couple_christmas_market",
      "displayName": "Christmas Market",
      "enabled": true,
      "promptTemplate": "Transform this couple photo into a photoreal Christmas market portrait. Preserve both identities; keep exactly two people. Warm stall lights, subtle festive atmosphere, natural skin. No text, no watermark.",
      "negativeHints": "one person, extra people, cartoon, text, watermark"
    },
    {
      "styleKey": "couple_classic_portrait",
      "displayName": "Classic Portrait",
      "enabled": true,
      "promptTemplate": "Transform this couple photo into a photoreal classic Christmas couple portrait. Preserve both facial identities exactly; keep two people. Soft portrait lighting, subtle tree bokeh. No text, no watermark.",
      "negativeHints": "one person, cartoon, text, watermark"
    },
    {
      "styleKey": "couple_vintage_christmas",
      "displayName": "Vintage Christmas",
      "enabled": true,
      "promptTemplate": "Transform this couple photo into a photoreal vintage Christmas portrait with gentle film grain. Preserve both identities; keep two people. Mid-century holiday cues, soft vignette. No text, no watermark.",
      "negativeHints": "one person, cartoon, text, watermark, heavy filter"
    }
  ],
  "christmas_pet": [
    {
      "styleKey": "santa_pet",
      "displayName": "Santa Pet",
      "enabled": true,
      "promptTemplate": "Transform this pet photo into a photoreal Santa Christmas pet portrait. Preserve the exact species, coat colors, markings, and facial characteristics. Do not change the animal into a different species or add extra animals. Subtle festive Santa-hat or scarf prop only if it does not hide the face. Soft warm Christmas lighting, no text, no watermark.",
      "negativeHints": "wrong species, extra animals, human face, cartoon, text, watermark"
    },
    {
      "styleKey": "pet_cozy_christmas",
      "displayName": "Cozy Christmas",
      "enabled": true,
      "promptTemplate": "Transform this pet photo into a photoreal cozy Christmas pet portrait. Preserve exact species, coat pattern, and face. Fireplace glow, soft textures, no extra animals, no text, no watermark.",
      "negativeHints": "wrong species, extra animals, cartoon, text, watermark"
    },
    {
      "styleKey": "pet_north_pole",
      "displayName": "North Pole",
      "enabled": true,
      "promptTemplate": "Transform this pet photo into a photoreal North Pole Christmas pet portrait. Preserve species, coat, and facial identity. Soft snow and aurora accents that stay realistic. No extra animals, no text, no watermark.",
      "negativeHints": "wrong species, extra animals, cartoon, text, watermark"
    },
    {
      "styleKey": "pet_christmas_sweater",
      "displayName": "Christmas Sweater",
      "enabled": true,
      "promptTemplate": "Transform this pet photo into a photoreal Christmas sweater pet portrait. Preserve exact species, markings, and face. A tasteful holiday sweater that does not obscure the face. Soft studio lighting, no extra animals, no text, no watermark.",
      "negativeHints": "wrong species, face covered, extra animals, cartoon, text, watermark"
    },
    {
      "styleKey": "pet_snow_portrait",
      "displayName": "Snow Portrait",
      "enabled": true,
      "promptTemplate": "Transform this pet photo into a photoreal snow Christmas pet portrait. Preserve species, coat colors, and facial traits. Soft snowfall, evergreen bokeh, natural fur detail. No extra animals, no text, no watermark.",
      "negativeHints": "wrong species, extra animals, cartoon, text, watermark"
    },
    {
      "styleKey": "pet_christmas_card",
      "displayName": "Christmas Card",
      "enabled": true,
      "promptTemplate": "Transform this pet photo into a photoreal Christmas-card pet portrait. Preserve exact species and likeness. Clean festive backdrop suitable for a card, but no readable text, logos, or watermarks in the image. No extra animals.",
      "negativeHints": "wrong species, text, logos, watermark, extra animals, cartoon"
    },
    {
      "styleKey": "pet_royal_christmas",
      "displayName": "Royal Christmas",
      "enabled": true,
      "promptTemplate": "Transform this pet photo into a photoreal royal Christmas pet portrait. Preserve species, coat pattern, and face. Tasteful regal Christmas accents without distorting anatomy. No extra animals, no text, no watermark.",
      "negativeHints": "wrong species, extra animals, deformed anatomy, cartoon, text, watermark"
    },
    {
      "styleKey": "pet_vintage_christmas",
      "displayName": "Vintage Christmas",
      "enabled": true,
      "promptTemplate": "Transform this pet photo into a photoreal vintage Christmas pet portrait with gentle film grain. Preserve exact species, markings, and facial identity. Soft vignette, warm nostalgic tones. No extra animals, no text, no watermark.",
      "negativeHints": "wrong species, extra animals, cartoon, text, watermark"
    }
  ]
};

export const PORTRAIT_PRODUCT_KEYS = [
  "christmas_photo",
  "christmas_family",
  "christmas_couple",
  "christmas_pet",
] as const;

export function isPortraitProductKey(productKey: string): boolean {
  return (PORTRAIT_PRODUCT_KEYS as readonly string[]).includes(productKey);
}

export function stylesForProductKey(productKey: string): ChristmasPromptStyle[] {
  return REGISTRY[productKey] || [];
}

export function resolveProductStyle(
  productKey: string,
  styleKey: string,
): ChristmasPromptStyle | null {
  const key = String(styleKey || "").trim();
  const style = stylesForProductKey(productKey).find((s) => s.styleKey === key) ?? null;
  if (!style || !style.enabled) return null;
  return style;
}

export function buildChristmasPortraitPrompt(input: {
  productKey: string;
  styleKey: string;
  species?: string | null;
  /** Client-supplied prompts are always ignored. */
  clientPrompt?: unknown;
}): { ok: true; prompt: string; style: ChristmasPromptStyle } | { ok: false; code: string } {
  void input.clientPrompt; // never trusted
  if (!isPortraitProductKey(input.productKey)) {
    return { ok: false, code: "unknown_product" };
  }
  const style = resolveProductStyle(input.productKey, input.styleKey);
  if (!style) return { ok: false, code: "invalid_style" };

  let prompt = `${style.promptTemplate} Avoid: ${style.negativeHints}.`;
  const species = String(input.species || "").trim().toLowerCase();
  if (input.productKey === "christmas_pet" && (species === "dog" || species === "cat")) {
    prompt += ` The subject is a ${species}. Preserve ${species} species, coat coloring, and facial characteristics. Do not change species or add extra animals.`;
  }
  return { ok: true, prompt, style };
}

export function recoveryRouteForOrder(input: {
  productKey: string;
  species?: string | null;
  sourceRoute?: string | null;
  landingPath?: string | null;
}): string {
  const route = String(input.sourceRoute || "").trim();
  if (route.startsWith("/christmas/")) return route.split("?")[0];
  const landing = String(input.landingPath || "").split("?")[0];
  if (landing.startsWith("/christmas/family") || landing.startsWith("/christmas/couples") ||
      landing.startsWith("/christmas/pets") || landing.startsWith("/christmas/dogs") ||
      landing.startsWith("/christmas/cats") || landing.startsWith("/christmas/photo-generator") ||
      landing.startsWith("/christmas/santa-video")) {
    return landing;
  }
  if (input.productKey === "christmas_santa_video") return "/christmas/santa-video";
  if (input.productKey === "christmas_family") return "/christmas/family";
  if (input.productKey === "christmas_couple") return "/christmas/couples";
  if (input.productKey === "christmas_pet") {
    const sp = String(input.species || "").toLowerCase();
    if (sp === "dog") return "/christmas/dogs";
    if (sp === "cat") return "/christmas/cats";
    return "/christmas/pets";
  }
  return "/christmas/photo-generator";
}
