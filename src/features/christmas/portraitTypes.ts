export const CHRISTMAS_PORTRAIT_STEPS = [
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

export type ChristmasPortraitStep = (typeof CHRISTMAS_PORTRAIT_STEPS)[number];

export type ChristmasPortraitDraft = {
  step: ChristmasPortraitStep;
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
  portraitType: string | null;
  species: string | null;
  lastError: string | null;
  updatedAt: string;
};

export function emptyPortraitDraft(): ChristmasPortraitDraft {
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
    portraitType: null,
    species: null,
    lastError: null,
    updatedAt: new Date().toISOString(),
  };
}
