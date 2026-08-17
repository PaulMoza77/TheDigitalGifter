export const PET_SKU = "pet-secret-life-12" as const;
export const PET_PRODUCT_NAME = "My Pet’s Secret Life";
export const PET_PRICE_CENTS = 5900;
export const PET_CURRENCY = "usd";
export const PET_SCENE_COUNT = 12;
export const PET_VIDEO_CLIP_COUNT = 2;
export const PET_PHOTO_MAX_BYTES = 15 * 1024 * 1024;
export const PET_SOURCE_BUCKET = "pet-source-photos";
export const PET_RESULT_BUCKET = "pet-generated";
export const PET_ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PET_SIGNED_UPLOAD_SECONDS = 15 * 60;
export const PET_SIGNED_DOWNLOAD_SECONDS = 15 * 60;
export const PET_MAX_SCENE_ATTEMPTS = 3;

export const DEFAULT_PET_IMAGE_MODEL = "black-forest-labs/flux-kontext-pro";
export const DEFAULT_PET_VIDEO_MODEL = "bytedance/seedance-1-pro-fast";
export const DEFAULT_PET_VIDEO_DURATION_SECONDS = 5;
export const DEFAULT_PET_VIDEO_RESOLUTION = "720p";
export const DEFAULT_PET_VIDEO_MAX_ATTEMPTS = 1;

export const PET_SPECIES = ["dog", "cat", "other"] as const;
export const PET_PERSONALITIES = [
  "funny",
  "royal",
  "cute",
  "badass",
  "luxury",
  "adventure",
] as const;

export const PET_SCENE_KEYS = [
  "royal-portrait",
  "luxury-ceo",
  "astronaut",
  "formula-racer",
  "spa-bathtub",
  "newspaper",
  "cinema-boss",
  "renaissance",
  "beach-vacation",
  "head-chef",
  "original-superhero",
  "christmas-portrait",
] as const;

export type PetSceneKey = (typeof PET_SCENE_KEYS)[number];

export function siteOrigin(): string {
  return (
    Deno.env.get("SITE_URL") ||
    Deno.env.get("PUBLIC_APP_URL") ||
    "https://www.thedigitalgifter.com"
  ).replace(/\/$/, "");
}

export function generationEnabled(): boolean {
  const raw = String(Deno.env.get("PET_GENERATION_ENABLED") ?? "true").trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}

export function publicDeliveryEstimate(value?: string | null): string {
  const trimmed = String(value || "").trim();
  if (!trimmed || /24\s*[–-]\s*48/.test(trimmed)) {
    return "Usually ready in a few minutes after payment";
  }
  return trimmed;
}

export function generationMock(): boolean {
  return String(Deno.env.get("PET_GENERATION_MOCK") || "").toLowerCase() === "true";
}

export function petImageModel(): string {
  return (Deno.env.get("PET_IMAGE_MODEL") || DEFAULT_PET_IMAGE_MODEL).trim();
}

export function petImageModelVersion(): string | null {
  const value = (Deno.env.get("PET_IMAGE_MODEL_VERSION") || "").trim();
  return value || null;
}

export function videoGenerationEnabled(): boolean {
  return String(Deno.env.get("PET_VIDEO_GENERATION_ENABLED") || "").toLowerCase() === "true";
}

export function videoGenerationMock(): boolean {
  return String(Deno.env.get("PET_VIDEO_GENERATION_MOCK") || "").toLowerCase() === "true";
}

export function petVideoModel(): string {
  return (Deno.env.get("PET_VIDEO_MODEL") || DEFAULT_PET_VIDEO_MODEL).trim();
}

export function petVideoDurationSeconds(): number {
  const parsed = Number(Deno.env.get("PET_VIDEO_DURATION_SECONDS") || DEFAULT_PET_VIDEO_DURATION_SECONDS);
  return Number.isFinite(parsed) && parsed >= 2 && parsed <= 12 ? parsed : DEFAULT_PET_VIDEO_DURATION_SECONDS;
}

export function petVideoResolution(): string {
  const value = (Deno.env.get("PET_VIDEO_RESOLUTION") || DEFAULT_PET_VIDEO_RESOLUTION).trim();
  return value === "720p" ? value : DEFAULT_PET_VIDEO_RESOLUTION;
}

export function petVideoMaxAttempts(): number {
  const parsed = Number(Deno.env.get("PET_VIDEO_MAX_ATTEMPTS") || DEFAULT_PET_VIDEO_MAX_ATTEMPTS);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, 10) : DEFAULT_PET_VIDEO_MAX_ATTEMPTS;
}
