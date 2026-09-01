/**
 * Christmas V2 occasion funnel config.
 * Data-driven so Birthday / Valentine / etc. can later reuse the same shell.
 */

export const CHRISTMAS_V2_ROUTE = "/christmas-ai-photos" as const;
export const CHRISTMAS_V2_ORDER_ROUTE = "/christmas-ai-photos/order" as const;
export const CHRISTMAS_V2_DRAFT_KEY = "tdg.christmasV2.draft.v1" as const;
export const CHRISTMAS_V2_SESSION_KEY = "tdg.christmasV2.session.v1" as const;
export const CHRISTMAS_V2_CHECKOUT_HOLD_KEY = "tdg.christmasV2.checkoutSession.v1" as const;
/** Same-origin Vercel route (local dev / when Vercel is available). */
export const CHRISTMAS_V2_EVENT_PATH = "/api/christmas-v2-funnel-event" as const;
/** Supabase Edge ingest — production path when Vercel is blocked or unavailable. */
export const CHRISTMAS_V2_EVENT_EDGE_ACTION = "christmas-v2-funnel-event" as const;

export const CHRISTMAS_STARTER_SKU = "christmas-starter-3" as const;
export const CHRISTMAS_MAGIC_SKU = "christmas-magic-8" as const;
export const CHRISTMAS_ULTIMATE_SKU = "christmas-ultimate-12" as const;

export const CHRISTMAS_STARTER_PRICE_CENTS = 300 as const;
export const CHRISTMAS_MAGIC_PRICE_CENTS = 800 as const;
export const CHRISTMAS_ULTIMATE_PRICE_CENTS = 1200 as const;

export const CHRISTMAS_PRODUCT_TYPE = "christmas_portrait_pack" as const;
export const CHRISTMAS_FUNNEL_VARIANT = "christmas_v2" as const;

export const CHRISTMAS_PHOTO_MAX_BYTES = 15 * 1024 * 1024;
export const CHRISTMAS_UPLOAD_MAX_EDGE = 2048;

/** Approximate Replicate COGS (nano-banana ~$0.04/img, Seedance ~$0.08/5s clip). */
export const CHRISTMAS_COGS_ESTIMATE = {
  starter: { images: 3, videos: 0, imageUsd: 0.04, videoUsd: 0.08, totalUsd: 0.12 },
  magic: { images: 8, videos: 1, imageUsd: 0.04, videoUsd: 0.08, totalUsd: 0.4 },
  ultimate: { images: 12, videos: 2, imageUsd: 0.04, videoUsd: 0.08, totalUsd: 0.64 },
} as const;

export type ChristmasSceneKey =
  | "by-the-christmas-tree"
  | "snowy-winter-portrait"
  | "cozy-christmas"
  | "grand-evergreen"
  | "festive-dinner"
  | "red-gold-card"
  | "by-the-hearth"
  | "choosing-the-star"
  | "story-time"
  | "sweater-weather"
  | "sledding-hill"
  | "snowfall-portrait"
  | "mistletoe-kiss"
  | "sleigh-ride"
  | "winter-proposal"
  | "santa-holiday"
  | "hot-chocolate"
  | "winter-outside"
  | "skiing-winter";

export type ChristmasSceneDef = {
  key: ChristmasSceneKey;
  label: string;
  shortLabel: string;
  /** Maps to existing generator style concepts from templates_supabase. */
  templateStyle: string;
  category: "Classic" | "Cozy" | "Snowy" | "Romantic" | "Holiday";
  orientation: "portrait" | "landscape";
  promptEdit: string;
  exampleImage?: string;
  pack: "starter" | "upsell" | "both";
};

/**
 * Starter uses three portrait-oriented Christmas scenes.
 * Upsell pool reuses existing Digital Gifter Christmas style concepts.
 */
export const CHRISTMAS_SCENES: readonly ChristmasSceneDef[] = [
  {
    key: "by-the-christmas-tree",
    label: "By the Christmas Tree",
    shortLabel: "Christmas Tree",
    templateStyle: "Grand Evergreen Portrait",
    category: "Classic",
    orientation: "portrait",
    pack: "starter",
    exampleImage: "/assets/funnel/christmas-after.png",
    promptEdit:
      "Premium cinematic Christmas portrait beside a beautifully decorated Christmas tree with warm fairy lights, elegant ornaments, and soft bokeh. Evening holiday atmosphere, flattering portrait lighting, photoreal.",
  },
  {
    key: "snowy-winter-portrait",
    label: "Snowy Winter Portrait",
    shortLabel: "Snowy Winter",
    templateStyle: "Snowfall Portrait",
    category: "Snowy",
    orientation: "portrait",
    pack: "starter",
    exampleImage: "/assets/funnel/christmas-ex2-after.png",
    promptEdit:
      "Outdoor cinematic snowy winter portrait with gentle falling snow, winter clothing, beautiful snowy environment, warm skin tones, premium lifestyle photography, soft natural light.",
  },
  {
    key: "cozy-christmas",
    label: "Cozy Christmas",
    shortLabel: "Cozy Christmas",
    templateStyle: "Sweater Weather",
    category: "Cozy",
    orientation: "portrait",
    pack: "starter",
    exampleImage: "/assets/funnel/christmas-ex3-after.png",
    promptEdit:
      "Indoor cozy Christmas portrait near a warm fireplace with Christmas decorations, soft knit sweater or elegant winter clothing matching the subject, golden ambient light, premium home Christmas atmosphere.",
  },
  {
    key: "grand-evergreen",
    label: "Grand Evergreen",
    shortLabel: "Evergreen",
    templateStyle: "Grand Evergreen Portrait",
    category: "Classic",
    orientation: "portrait",
    pack: "upsell",
    promptEdit:
      "Classic Christmas tree portrait in an elegant living room with ornaments and warm bokeh lights. Festive classic Christmas look.",
  },
  {
    key: "festive-dinner",
    label: "Festive Dinner Table",
    shortLabel: "Dinner Table",
    templateStyle: "Festive Dinner Table",
    category: "Classic",
    orientation: "landscape",
    pack: "upsell",
    promptEdit:
      "Elegant Christmas dinner table setting with candlelight, fine china, and festive centerpiece. Warm classic holiday dining atmosphere.",
  },
  {
    key: "red-gold-card",
    label: "Red & Gold Card",
    shortLabel: "Red & Gold",
    templateStyle: "Red & Gold Card",
    category: "Classic",
    orientation: "portrait",
    pack: "upsell",
    promptEdit:
      "Premium Christmas card portrait with rich red and gold festive styling, elegant holiday backdrop suitable for sharing.",
  },
  {
    key: "by-the-hearth",
    label: "By the Hearth",
    shortLabel: "Hearth",
    templateStyle: "By the Hearth",
    category: "Cozy",
    orientation: "landscape",
    pack: "upsell",
    promptEdit:
      "Intimate scene near a crackling stone fireplace with soft knit blankets, warm amber tones, cozy Christmas home atmosphere.",
  },
  {
    key: "choosing-the-star",
    label: "Choosing the Star",
    shortLabel: "Tree Star",
    templateStyle: "Choosing the Star",
    category: "Cozy",
    orientation: "portrait",
    pack: "upsell",
    promptEdit:
      "Warm family Christmas moment placing the star on the tree, twinkling lights, cozy living room, joyful holiday atmosphere.",
  },
  {
    key: "story-time",
    label: "Story Time",
    shortLabel: "Story Time",
    templateStyle: "Story Time",
    category: "Cozy",
    orientation: "landscape",
    pack: "upsell",
    promptEdit:
      "Cozy Christmas story-time scene by the fireplace with soft blankets and warm fairy lights.",
  },
  {
    key: "sweater-weather",
    label: "Sweater Weather",
    shortLabel: "Sweater",
    templateStyle: "Sweater Weather",
    category: "Cozy",
    orientation: "portrait",
    pack: "upsell",
    promptEdit:
      "Romantic cozy Christmas portrait in chunky knit sweater near fireplace with decorated tree soft bokeh in background.",
  },
  {
    key: "sledding-hill",
    label: "Sledding Hill",
    shortLabel: "Sledding",
    templateStyle: "Sledding Hill",
    category: "Snowy",
    orientation: "landscape",
    pack: "upsell",
    promptEdit:
      "Snowy outdoor sledding hill Christmas lifestyle portrait, winter coats, joyful winter wonderland atmosphere.",
  },
  {
    key: "snowfall-portrait",
    label: "Snowfall Portrait",
    shortLabel: "Snowfall",
    templateStyle: "Snowfall Portrait",
    category: "Snowy",
    orientation: "portrait",
    pack: "upsell",
    promptEdit:
      "Elegant snowfall portrait with soft-focused evergreen trees, gentle snowflakes, serene winter holiday ambiance.",
  },
  {
    key: "mistletoe-kiss",
    label: "Mistletoe Moment",
    shortLabel: "Mistletoe",
    templateStyle: "Mistletoe Kiss",
    category: "Romantic",
    orientation: "portrait",
    pack: "upsell",
    promptEdit:
      "Romantic Christmas portrait under mistletoe with soft warm lighting and elegant festive décor. Keep a tasteful, non-explicit pose.",
  },
  {
    key: "sleigh-ride",
    label: "Sleigh Ride",
    shortLabel: "Sleigh",
    templateStyle: "Sleigh Ride Duo",
    category: "Romantic",
    orientation: "landscape",
    pack: "upsell",
    promptEdit:
      "Magical Christmas sleigh ride through a snowy winter landscape with warm blankets and holiday charm.",
  },
  {
    key: "winter-proposal",
    label: "Winter Proposal",
    shortLabel: "Proposal",
    templateStyle: "Winter Proposal",
    category: "Romantic",
    orientation: "portrait",
    pack: "upsell",
    promptEdit:
      "Elegant winter proposal Christmas portrait in a snowy romantic setting with soft golden holiday lights.",
  },
  {
    key: "santa-holiday",
    label: "Santa Workshop",
    shortLabel: "Santa",
    templateStyle: "Santa (Holiday)",
    category: "Holiday",
    orientation: "portrait",
    pack: "upsell",
    promptEdit:
      "Festive Santa workshop Christmas portrait with warm workshop glow, gifts, and magical holiday atmosphere. Subject remains the uploaded person.",
  },
  {
    key: "hot-chocolate",
    label: "Hot Chocolate",
    shortLabel: "Cocoa",
    templateStyle: "Hot chocolate couple",
    category: "Cozy",
    orientation: "portrait",
    pack: "upsell",
    promptEdit:
      "Cozy Christmas hot-chocolate portrait with steam, soft knit textures, and warm indoor holiday lighting.",
  },
  {
    key: "winter-outside",
    label: "Winter Outside",
    shortLabel: "Winter Out",
    templateStyle: "Winter outside",
    category: "Snowy",
    orientation: "portrait",
    pack: "upsell",
    promptEdit:
      "Stylish outdoor winter Christmas portrait with coats, soft snow, and premium lifestyle photography feel.",
  },
  {
    key: "skiing-winter",
    label: "Skiing in Winter",
    shortLabel: "Skiing",
    templateStyle: "Skiing in winter",
    category: "Snowy",
    orientation: "portrait",
    pack: "upsell",
    promptEdit:
      "Premium ski-resort Christmas winter portrait with mountain snow backdrop and elegant winter sportswear.",
  },
] as const;

export const CHRISTMAS_STARTER_SCENES = CHRISTMAS_SCENES.filter((s) => s.pack === "starter");
export const CHRISTMAS_UPSELL_SCENES = CHRISTMAS_SCENES.filter(
  (s) => s.pack === "upsell" || s.pack === "both",
);

export type ChristmasPackKey = "starter" | "magic" | "ultimate";

export type ChristmasPackDef = {
  key: ChristmasPackKey;
  sku: string;
  name: string;
  priceCents: number;
  priceDisplay: string;
  imageCount: number;
  videoCount: number;
  cta: string;
  badge?: string;
  description: string;
};

export const CHRISTMAS_PACKS: Record<ChristmasPackKey, ChristmasPackDef> = {
  starter: {
    key: "starter",
    sku: CHRISTMAS_STARTER_SKU,
    name: "Christmas Starter Pack",
    priceCents: CHRISTMAS_STARTER_PRICE_CENTS,
    priceDisplay: "$3",
    imageCount: 3,
    videoCount: 0,
    cta: "Create My 3 Christmas Photos",
    description: "3 AI Christmas portraits",
  },
  magic: {
    key: "magic",
    sku: CHRISTMAS_MAGIC_SKU,
    name: "Christmas Magic Pack",
    priceCents: CHRISTMAS_MAGIC_PRICE_CENTS,
    priceDisplay: "$8",
    imageCount: 8,
    videoCount: 1,
    cta: "Get 8 Photos + 1 Video — $8",
    description: "8 Christmas Photos + 1 AI Video",
  },
  ultimate: {
    key: "ultimate",
    sku: CHRISTMAS_ULTIMATE_SKU,
    name: "Ultimate Christmas Pack",
    priceCents: CHRISTMAS_ULTIMATE_PRICE_CENTS,
    priceDisplay: "$12",
    imageCount: 12,
    videoCount: 2,
    cta: "Get 12 Photos + 2 Videos — $12",
    badge: "BEST VALUE",
    description: "12 Christmas Photos + 2 AI Videos",
  },
};

export const PERSON_IDENTITY_LOCK =
  "CRITICAL: Preserve the exact facial features, age appearance, ethnicity, hair color, hair style, skin tone, and all defining physical characteristics of the uploaded person without ANY changes. Face and identity preservation is the absolute priority. Clothing, background, and lighting may change dramatically. The result must look like a professional Christmas photoshoot of the SAME recognizable person.";

export function buildChristmasScenePrompt(scene: ChristmasSceneDef): string {
  return `${PERSON_IDENTITY_LOCK}\n\nCreate a premium ${scene.orientation} Christmas portrait labeled "${scene.label}" inspired by the Digital Gifter style "${scene.templateStyle}". ${scene.promptEdit}\n\nREMINDER: Keep the uploaded face identical and immediately recognizable.`;
}

export function pickSurpriseScenes(count: number, exclude: ChristmasSceneKey[] = []): ChristmasSceneKey[] {
  const pool = CHRISTMAS_UPSELL_SCENES.map((s) => s.key).filter((k) => !exclude.includes(k));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function sceneByKey(key: string): ChristmasSceneDef | undefined {
  return CHRISTMAS_SCENES.find((s) => s.key === key);
}
