export const CHRISTMAS_PORTRAIT_STEPS = [
  "intro",
  "upload",
  "subject",
  "style",
  "preview",
  "offer",
  "checkout",
  "generating",
  "result",
  "error",
] as const;

export type ChristmasPortraitStep = (typeof CHRISTMAS_PORTRAIT_STEPS)[number];

/** Hub subject choice after upload (photo-generator). */
export type ChristmasPortraitSubjectChoice =
  | "family"
  | "couple"
  | "person"
  | "pet"
  | "person_pet";

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
  /** Hub-only: who the user says is in the photo */
  subjectChoice: ChristmasPortraitSubjectChoice | null;
  species: string | null;
  lastError: string | null;
  softWarning: string | null;
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
    subjectChoice: null,
    species: null,
    lastError: null,
    softWarning: null,
    updatedAt: new Date().toISOString(),
  };
}
