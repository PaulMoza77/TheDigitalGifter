export const CHRISTMAS_PHOTO_PRODUCT_KEY = "christmas_photo" as const;
export const CHRISTMAS_PHOTO_PACKAGE_KEY = "single" as const;
export const CHRISTMAS_PHOTO_ROUTE = "/christmas/photo-generator" as const;
export const CHRISTMAS_SOURCE_BUCKET = "christmas-source" as const;
export const CHRISTMAS_GENERATED_BUCKET = "christmas-generated" as const;

export const CHRISTMAS_PHOTO_STEPS = [
  "intro",
  "upload",
  "style",
  "preview",
  "offer",
  "checkout",
  "generating",
  "result",
  "error",
] as const;

export type ChristmasPhotoStep = (typeof CHRISTMAS_PHOTO_STEPS)[number];

export type ChristmasPhotoDraft = {
  step: ChristmasPhotoStep;
  styleKey: string | null;
  localPreviewUrl: string | null;
  blurredPreviewUrl: string | null;
  uploadId: string | null;
  sourcePath: string | null;
  sourceContentType: string | null;
  sourceWidth: number | null;
  sourceHeight: number | null;
  orderId: string | null;
  publicToken: string | null;
  email: string;
  lastError: string | null;
  updatedAt: string;
};

export const CHRISTMAS_PHOTO_DRAFT_KEY = "tdg.christmas.photo.draft.v1";

export function emptyChristmasPhotoDraft(): ChristmasPhotoDraft {
  return {
    step: "intro",
    styleKey: null,
    localPreviewUrl: null,
    blurredPreviewUrl: null,
    uploadId: null,
    sourcePath: null,
    sourceContentType: null,
    sourceWidth: null,
    sourceHeight: null,
    orderId: null,
    publicToken: null,
    email: "",
    lastError: null,
    updatedAt: new Date().toISOString(),
  };
}
