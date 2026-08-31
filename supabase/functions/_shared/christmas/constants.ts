export const CHRISTMAS_SOURCE_BUCKET = "christmas-source-photos";
export const CHRISTMAS_RESULT_BUCKET = "christmas-generated";
export const CHRISTMAS_PRODUCT_TYPE = "christmas_portrait_pack";
export const CHRISTMAS_SIGNED_UPLOAD_SECONDS = 60 * 15;
export const CHRISTMAS_SIGNED_DOWNLOAD_SECONDS = 60 * 60;

export const CHRISTMAS_PACKS = {
  starter: {
    key: "starter",
    sku: "christmas-starter-3",
    name: "Christmas Starter Pack",
    amountCents: 300,
    imageCount: 3,
    videoCount: 0,
  },
  magic: {
    key: "magic",
    sku: "christmas-magic-8",
    name: "Christmas Magic Pack",
    amountCents: 800,
    imageCount: 8,
    videoCount: 1,
  },
  ultimate: {
    key: "ultimate",
    sku: "christmas-ultimate-12",
    name: "Ultimate Christmas Pack",
    amountCents: 1200,
    imageCount: 12,
    videoCount: 2,
  },
} as const;

export type ChristmasPackKey = keyof typeof CHRISTMAS_PACKS;

export const PERSON_IDENTITY_LOCK =
  "CRITICAL: Preserve the exact facial features, age appearance, ethnicity, hair color, hair style, skin tone, and all defining physical characteristics of the uploaded person without ANY changes. Face and identity preservation is the absolute priority. Clothing, background, and lighting may change dramatically. The result must look like a professional Christmas photoshoot of the SAME recognizable person.";

export type ChristmasSceneDef = {
  key: string;
  label: string;
  templateStyle: string;
  promptEdit: string;
};

export const CHRISTMAS_SCENES: readonly ChristmasSceneDef[] = [
  {
    key: "by-the-christmas-tree",
    label: "By the Christmas Tree",
    templateStyle: "Grand Evergreen Portrait",
    promptEdit:
      "Premium cinematic Christmas portrait beside a beautifully decorated Christmas tree with warm fairy lights, elegant ornaments, and soft bokeh. Evening holiday atmosphere, flattering portrait lighting, photoreal.",
  },
  {
    key: "snowy-winter-portrait",
    label: "Snowy Winter Portrait",
    templateStyle: "Snowfall Portrait",
    promptEdit:
      "Outdoor cinematic snowy winter portrait with gentle falling snow, winter clothing, beautiful snowy environment, warm skin tones, premium lifestyle photography, soft natural light.",
  },
  {
    key: "cozy-christmas",
    label: "Cozy Christmas",
    templateStyle: "Sweater Weather",
    promptEdit:
      "Indoor cozy Christmas portrait near a warm fireplace with Christmas decorations, soft knit sweater or elegant winter clothing matching the subject, golden ambient light, premium home Christmas atmosphere.",
  },
  {
    key: "grand-evergreen",
    label: "Grand Evergreen",
    templateStyle: "Grand Evergreen Portrait",
    promptEdit: "Classic Christmas tree portrait in an elegant living room with ornaments and warm bokeh lights.",
  },
  {
    key: "festive-dinner",
    label: "Festive Dinner Table",
    templateStyle: "Festive Dinner Table",
    promptEdit: "Elegant Christmas dinner table setting with candlelight and festive centerpiece.",
  },
  {
    key: "red-gold-card",
    label: "Red & Gold Card",
    templateStyle: "Red & Gold Card",
    promptEdit: "Premium Christmas card portrait with rich red and gold festive styling.",
  },
  {
    key: "by-the-hearth",
    label: "By the Hearth",
    templateStyle: "By the Hearth",
    promptEdit: "Intimate scene near a crackling stone fireplace with soft knit blankets and warm amber tones.",
  },
  {
    key: "choosing-the-star",
    label: "Choosing the Star",
    templateStyle: "Choosing the Star",
    promptEdit: "Warm Christmas moment placing the star on the tree with twinkling lights.",
  },
  {
    key: "story-time",
    label: "Story Time",
    templateStyle: "Story Time",
    promptEdit: "Cozy Christmas story-time scene by the fireplace with soft blankets and fairy lights.",
  },
  {
    key: "sweater-weather",
    label: "Sweater Weather",
    templateStyle: "Sweater Weather",
    promptEdit: "Cozy Christmas portrait in chunky knit sweater near fireplace with decorated tree soft bokeh.",
  },
  {
    key: "sledding-hill",
    label: "Sledding Hill",
    templateStyle: "Sledding Hill",
    promptEdit: "Snowy outdoor sledding hill Christmas lifestyle portrait with winter coats.",
  },
  {
    key: "snowfall-portrait",
    label: "Snowfall Portrait",
    templateStyle: "Snowfall Portrait",
    promptEdit: "Elegant snowfall portrait with soft-focused evergreen trees and gentle snowflakes.",
  },
  {
    key: "mistletoe-kiss",
    label: "Mistletoe Moment",
    templateStyle: "Mistletoe Kiss",
    promptEdit: "Romantic Christmas portrait under mistletoe with soft warm lighting. Tasteful, non-explicit pose.",
  },
  {
    key: "sleigh-ride",
    label: "Sleigh Ride",
    templateStyle: "Sleigh Ride Duo",
    promptEdit: "Magical Christmas sleigh ride through a snowy winter landscape.",
  },
  {
    key: "winter-proposal",
    label: "Winter Proposal",
    templateStyle: "Winter Proposal",
    promptEdit: "Elegant winter proposal Christmas portrait with soft golden holiday lights.",
  },
  {
    key: "santa-holiday",
    label: "Santa Workshop",
    templateStyle: "Santa (Holiday)",
    promptEdit: "Festive Santa workshop Christmas portrait with warm workshop glow and gifts. Subject remains the uploaded person.",
  },
  {
    key: "hot-chocolate",
    label: "Hot Chocolate",
    templateStyle: "Hot chocolate couple",
    promptEdit: "Cozy Christmas hot-chocolate portrait with steam and warm indoor holiday lighting.",
  },
  {
    key: "winter-outside",
    label: "Winter Outside",
    templateStyle: "Winter outside",
    promptEdit: "Stylish outdoor winter Christmas portrait with coats and soft snow.",
  },
  {
    key: "skiing-winter",
    label: "Skiing in Winter",
    templateStyle: "Skiing in winter",
    promptEdit: "Premium ski-resort Christmas winter portrait with mountain snow backdrop.",
  },
] as const;

export const STARTER_SCENE_KEYS = [
  "by-the-christmas-tree",
  "snowy-winter-portrait",
  "cozy-christmas",
] as const;

export function sceneByKey(key: string): ChristmasSceneDef | undefined {
  return CHRISTMAS_SCENES.find((s) => s.key === key);
}

export function buildScenePrompt(scene: ChristmasSceneDef): string {
  return `${PERSON_IDENTITY_LOCK}\n\nCreate a premium Christmas portrait labeled "${scene.label}" inspired by the Digital Gifter style "${scene.templateStyle}". ${scene.promptEdit}\n\nREMINDER: Keep the uploaded face identical and immediately recognizable.`;
}

export function siteOrigin(): string {
  return (
    Deno.env.get("SITE_URL") ||
    Deno.env.get("PUBLIC_APP_URL") ||
    "https://www.thedigitalgifter.com"
  ).replace(/\/$/, "");
}

export function generationMock(): boolean {
  return String(Deno.env.get("CHRISTMAS_GENERATION_MOCK") || "").toLowerCase() === "true";
}

export function generationEnabled(): boolean {
  const raw = String(Deno.env.get("CHRISTMAS_GENERATION_ENABLED") ?? "true").toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}

export function christmasImageModel(): string {
  return (
    Deno.env.get("REPLICATE_NANO_BANANA_MODEL") ||
    Deno.env.get("REPLICATE_IMAGE_MODEL") ||
    "google/nano-banana"
  );
}

export function christmasVideoModel(): string {
  return Deno.env.get("CHRISTMAS_VIDEO_MODEL") || "bytedance/seedance-1-pro-fast";
}

export function videoGenerationEnabled(): boolean {
  const raw = String(Deno.env.get("CHRISTMAS_VIDEO_GENERATION_ENABLED") ?? Deno.env.get("PET_VIDEO_GENERATION_ENABLED") ?? "true").toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}
