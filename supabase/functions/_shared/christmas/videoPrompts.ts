/**
 * Scene-specific Higgsfield Kling I2V motion prompts for Christmas V2 packs.
 * Keep in sync with api/_lib/christmas/videoPrompts.ts.
 */

export const CHRISTMAS_VIDEO_MODEL_DEFAULT = "kling-video/v3.0/pro/image-to-video";
export const CHRISTMAS_VIDEO_DURATION_SECONDS = 5 as const;

const IDENTITY_AND_SAFETY = [
  "Preserve the exact faces, ages, hairstyles, skin tones, clothing, and body proportions from the source portrait.",
  "No face morphing, identity drift, plastic skin, extra people, extra limbs, extra fingers, warped hands, or anatomy errors.",
  "No scene change, no costume swap, no readable text, no watermark, no captions, no logos.",
  "Keep lighting and color consistent with the source image. Subtle cinematic realism only.",
].join(" ");

const CAMERA_SAFE =
  "Camera: nearly locked-off with at most a very slow micro push-in. No whip pans, no orbit, no cuts.";

export type ChristmasVideoPromptDef = {
  sceneKey: string;
  motion: string;
};

export const CHRISTMAS_SCENE_VIDEO_PROMPTS: Readonly<Record<string, ChristmasVideoPromptDef>> = {
  "by-the-christmas-tree": {
    sceneKey: "by-the-christmas-tree",
    motion:
      "Subjects near the Christmas tree share soft natural smiles and warm eye contact, with tiny head turns and gentle breathing. Tree fairy lights shimmer softly; ornaments stay still. Fabric and hair move only slightly.",
  },
  "snowy-winter-portrait": {
    sceneKey: "snowy-winter-portrait",
    motion:
      "Subjects breathe naturally outdoors with soft closed-mouth smiles. Gentle snow drifts across frame; coats and scarves show faint wind movement. Background evergreens stay stable.",
  },
  "cozy-christmas": {
    sceneKey: "cozy-christmas",
    motion:
      "Indoor cozy portrait: subjects settle with calm smiles and subtle breathing. Fireplace glow flickers softly; knit textures and tree lights shimmer gently without reshaping faces.",
  },
  "grand-evergreen": {
    sceneKey: "grand-evergreen",
    motion:
      "Classic evergreen living-room portrait: natural blinks, slight posture settle, warm smiles. Tree lights and room bokeh pulse softly; furniture and ornaments remain fixed.",
  },
  "festive-dinner": {
    sceneKey: "festive-dinner",
    motion:
      "At the festive table, subjects glance toward one another with natural smiles and tiny conversational head movements. Candle flames flicker; glassware and plates stay still.",
  },
  "red-gold-card": {
    sceneKey: "red-gold-card",
    motion:
      "Premium red-and-gold card portrait: elegant micro expressions, soft breathing, and restrained smiles. Festive backdrop lights shimmer; poses stay composed and photoreal.",
  },
  "by-the-hearth": {
    sceneKey: "by-the-hearth",
    motion:
      "Intimate hearth scene: subjects relax with gentle smiles and breathing. Firelight flickers on faces and blankets; stone fireplace and décor remain stable.",
  },
  "choosing-the-star": {
    sceneKey: "choosing-the-star",
    motion:
      "Tree-star moment: subjects look up toward the tree top with joyful micro smiles and tiny arm settle if hands are visible. Twinkling lights shimmer; tree and room stay fixed.",
  },
  "story-time": {
    sceneKey: "story-time",
    motion:
      "Story-time by the fire: soft attentive expressions, natural blinks, subtle breathing. Fairy lights and fireplace glow move gently; blankets and furniture stay still.",
  },
  "sweater-weather": {
    sceneKey: "sweater-weather",
    motion:
      "Chunky-sweater portrait: warm smiles, slight head tilts, natural breathing. Knit fabric shows micro movement; fireplace and tree bokeh shimmer softly.",
  },
  "sledding-hill": {
    sceneKey: "sledding-hill",
    motion:
      "Outdoor sledding-hill lifestyle: joyful smiles, natural breathing, faint scarf or coat movement. Soft snow drifts; hillside and sled remain compositionally stable.",
  },
  "snowfall-portrait": {
    sceneKey: "snowfall-portrait",
    motion:
      "Elegant snowfall portrait: serene soft smiles, calm breathing, delicate snowflake drift. Evergreen background stays soft-focused and still.",
  },
  "mistletoe-kiss": {
    sceneKey: "mistletoe-kiss",
    motion:
      "Tasteful mistletoe moment: affectionate soft smiles, gentle eye contact, and very subtle closer lean only if already posed. No exaggerated kissing motion, no face distortion. Warm lights shimmer softly.",
  },
  "sleigh-ride": {
    sceneKey: "sleigh-ride",
    motion:
      "Sleigh ride through snow: subjects hold natural posture with soft smiles and breathing. Blanket edges flutter slightly; background snowscape drifts gently without changing layout.",
  },
  "winter-proposal": {
    sceneKey: "winter-proposal",
    motion:
      "Winter proposal portrait: tender smiles, emotional eye contact, natural breathing, and restrained micro movements. Golden holiday lights shimmer; snowy setting stays consistent.",
  },
  "santa-holiday": {
    sceneKey: "santa-holiday",
    motion:
      "Santa workshop portrait of the same uploaded person: friendly smile, subtle head movement, natural breathing. Workshop lamps glow warmly; gifts and props remain still.",
  },
  "hot-chocolate": {
    sceneKey: "hot-chocolate",
    motion:
      "Hot-chocolate portrait: cozy smiles, soft breathing, tiny mug settle if held. Gentle steam rises; indoor holiday lights shimmer without changing faces.",
  },
  "winter-outside": {
    sceneKey: "winter-outside",
    motion:
      "Stylish outdoor winter portrait: natural closed-mouth smiles, breathing, faint coat movement. Soft snow drifts; street or park background stays stable.",
  },
  "skiing-winter": {
    sceneKey: "skiing-winter",
    motion:
      "Ski-resort winter portrait: confident soft smiles, natural breathing, subtle gear settle. Mountain snow backdrop stays fixed; light wind moves only hair or scarf slightly.",
  },
} as const;

export const CHRISTMAS_VIDEO_SCENE_KEYS = Object.keys(CHRISTMAS_SCENE_VIDEO_PROMPTS);

export function buildChristmasVideoPrompt(sceneKey: string): string {
  const def = CHRISTMAS_SCENE_VIDEO_PROMPTS[sceneKey];
  const motion = def?.motion
    ?? "Subtle cinematic Christmas motion of this exact portrait: soft natural smiles, gentle breathing, and faint environmental shimmer only.";
  return [
    `Photoreal cinematic ${CHRISTMAS_VIDEO_DURATION_SECONDS}-second Christmas video of this exact portrait.`,
    motion,
    CAMERA_SAFE,
    IDENTITY_AND_SAFETY,
  ].join(" ");
}

export function resolveVideoSourceSceneKeys(
  sceneKeys: readonly string[],
  videoCount: number,
): string[] {
  if (videoCount <= 0) return [];
  const unique = [...new Set(sceneKeys.map((k) => String(k || "").trim()).filter(Boolean))];
  return unique.slice(0, videoCount);
}

export function orderReadyForDeliveryEmail(input: {
  videoCount: number;
  scenes: Array<{ status: string }>;
  videos: Array<{ status: string }>;
}): {
  imagesDone: boolean;
  videosDone: boolean;
  ready: boolean;
  partialFailure: boolean;
  allFailed: boolean;
} {
  const sceneTerminal = (s: string) => ["succeeded", "ready", "failed"].includes(s);
  const sceneOk = (s: string) => ["succeeded", "ready"].includes(s);
  const videoTerminal = (s: string) => ["succeeded", "ready", "failed"].includes(s);
  const videoOk = (s: string) => ["succeeded", "ready"].includes(s);

  const imagesDone =
    input.scenes.length > 0 && input.scenes.every((s) => sceneTerminal(String(s.status)));
  const imageSuccesses = input.scenes.filter((s) => sceneOk(String(s.status))).length;
  const imageFailures = input.scenes.filter((s) => String(s.status) === "failed").length;

  if (!imagesDone) {
    return {
      imagesDone: false,
      videosDone: false,
      ready: false,
      partialFailure: false,
      allFailed: false,
    };
  }

  if (input.videoCount <= 0) {
    return {
      imagesDone: true,
      videosDone: true,
      ready: imageSuccesses > 0,
      partialFailure: imageFailures > 0 && imageSuccesses > 0,
      allFailed: imageSuccesses === 0,
    };
  }

  const videosDone =
    input.videos.length >= input.videoCount &&
    input.videos.every((v) => videoTerminal(String(v.status)));
  const videoSuccesses = input.videos.filter((v) => videoOk(String(v.status))).length;
  const videoFailures = input.videos.filter((v) => String(v.status) === "failed").length;

  if (!videosDone) {
    return {
      imagesDone: true,
      videosDone: false,
      ready: false,
      partialFailure: false,
      allFailed: false,
    };
  }

  const anySuccess = imageSuccesses > 0 || videoSuccesses > 0;
  const anyFailure = imageFailures > 0 || videoFailures > 0;
  return {
    imagesDone: true,
    videosDone: true,
    ready: anySuccess,
    partialFailure: anySuccess && anyFailure,
    allFailed: !anySuccess,
  };
}
