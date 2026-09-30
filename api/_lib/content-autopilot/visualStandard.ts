/** TDG Christmas Factory art direction — encoded into every remaining generation. */

export const CHRISTMAS_FACTORY_LOOK =
  "I CAN'T WAIT FOR CHRISTMAS. Photorealistic, bright, warm, alive, magical. Premium Christmas movie × childhood memory × beautiful holiday commercial × real life. Not fantasy CGI, not dark prestige cinema, not generic stock, not gloomy winter.";

const LIGHT =
  " Several practical Christmas light sources: golden fairy lights, Christmas tree lights, warm windows, fireplace, candles, street decorations, storefront glow. Night scenes stay luminous. No crushed blacks, no underexposed Christmas.";

const COLOR =
  " Christmas color: warm gold, creamy white, clean bright snow, Christmas red accents, rich evergreen, warm wood, soft winter blue, healthy warm skin tones. Avoid gray-dominated frames, muddy brown, heavy teal/orange grading, desaturation, cold blue monochrome.";

const DEPTH =
  " Three visual layers: foreground snowflakes or blurred lights or decorations; midground emotional action; background Christmas lights, city, tree, fireplace, market. Natural bokeh and atmospheric depth. Rich frame, not empty.";

const NEGATIVE_STILL =
  " No dark gloomy somber empty gray desaturated low-key lighting. No fashion-editorial posing, expressionless actors, fake smiles, plastic skin, fantasy glitter, AI sparkles, logos, watermarks, readable text, malformed hands.";

const VISUAL_STANDARD_SUFFIX =
  ` ${CHRISTMAS_FACTORY_LOOK}${LIGHT}${COLOR}${DEPTH}` +
  " Vertical 9:16 photorealistic photograph of a Christmas MOMENT, not a location plate. Humans (when present) are doing something emotionally readable — natural happiness, not model poses. Immediate Christmas joy." +
  " Not illustration or cartoon. Realistic materials, anatomy, and geometry." +
  NEGATIVE_STILL;

const MOTION_STANDARD_SUFFIX =
  " SUBJECT ACTION + ENVIRONMENT ACTION + CAMERA ACTION. People and the world must move — not a frozen photograph with only a camera zoom." +
  " Environmental life: snowfall at several depths, Christmas lights shimmering, fireplace flicker, steam, walking, wrapping paper, reflections on wet pavement, background activity." +
  " Camera: gentle forward tracking or tiny handheld cinematic move only. Complete the moment depicted in the still." +
  " Stable identity and architecture. No morphing, no wild spins, no random zoom-only animation, no frozen background people.";

export function buildImagePrompt(scenePrompt: string): string {
  const core = String(scenePrompt || "").trim();
  return `${core}${VISUAL_STANDARD_SUFFIX}`.trim();
}

export function buildMotionPrompt(motionPrompt: string): string {
  const core = String(motionPrompt || "").trim();
  return `${core}${MOTION_STANDARD_SUFFIX}`.trim();
}

export function reelTitleFromConcept(input: { concept: string; hook: string }): string {
  const concept = String(input.concept || "").trim();
  const hook = String(input.hook || "").trim();
  if (hook.length <= 80) return hook || concept;
  return concept.slice(0, 80);
}
