export const CONCEPT_FAMILIES = [
  "choose_one_to_four",
  "christmas_fantasy",
  "cozy_christmas",
  "animals_wolves_reindeer",
  "luxury_christmas",
  "christmas_nostalgia",
  "experimental",
] as const;

export type ConceptFamily = (typeof CONCEPT_FAMILIES)[number];

export type ConceptClassification = "repeat" | "test" | "skip";

export type PipelineStatus =
  | "candidate"
  | "skipped"
  | "selected"
  | "prompts_ready"
  | "generating_assets"
  | "qc_review"
  | "assembling_reel"
  | "library_pending_finish"
  | "ready"
  | "failed";

export type ImageQcVerdict = "PASS" | "REGENERATE" | "REJECT";

export type ContentClip = {
  index: number;
  sceneLabel: string;
  imagePrompt: string;
  motionPrompt: string;
  imageUrl?: string | null;
  imageStoragePath?: string | null;
  imageQc?: ImageQcVerdict | null;
  imageQcReason?: string | null;
  imageAttempts?: number;
  videoStoragePath?: string | null;
  higgsfieldImageRequestId?: string | null;
  higgsfieldVideoRequestId?: string | null;
  videoCostUsd?: number | null;
};

export type ContentAutopilotSettings = {
  enabled: boolean;
  generationPaused: boolean;
  researchCandidatesPerDay: number;
  productionConceptsPerDay: number;
  clipsPerReel: number;
  maxImagesPerDay: number;
  maxImageRetriesPerDay: number;
  maxVideosPerDay: number;
  maxVideoRetriesPerDay: number;
  maxImageAttemptsPerClip: number;
  maxDailySpendUsd: number;
};

export type ResearchCandidate = {
  conceptFamily: ConceptFamily;
  concept: string;
  hook: string;
  targetPlatforms: string[];
  conceptDescription: string;
};
