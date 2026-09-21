export const MUSIC_SOURCES = [
  "youtube_audio_library",
  "original_owned",
  "commissioned",
  "licensed_ai",
  "other_licensed",
  "generated_demo",
] as const;

export type MusicSource = (typeof MUSIC_SOURCES)[number];

export const YOUTUBE_USE = ["yes", "no", "unknown"] as const;
export type YoutubeUse = (typeof YOUTUBE_USE)[number];

export const MUSIC_MOODS = [
  "christmas_jazz",
  "christmas_piano",
  "classic_christmas",
  "cozy_instrumental",
  "relaxing_christmas",
  "sleep_christmas",
] as const;

export type MusicMood = (typeof MUSIC_MOODS)[number];

export const STYLE_PRESETS = ["cozy", "luxury", "snowy", "traditional", "magical", "relaxing"] as const;
export type StylePreset = (typeof STYLE_PRESETS)[number];

export const DURATION_PRESETS_SECONDS = [3600] as const;
export const ENABLED_DURATION_SECONDS = 3600;
export const FUTURE_DURATION_SECONDS = [10800, 21600, 28800, 43200] as const;

export const PRODUCTION_STATUSES = [
  "draft",
  "queued",
  "rendering",
  "saved",
  "demo",
  "ready_to_publish",
  "rights_review_required",
  "similarity_review_required",
  "persist_failed",
  "failed",
] as const;

export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

export const STUDIO_STAGES = [
  "preparing_scene",
  "building_soundtrack",
  "creating_ambience",
  "rendering",
  "final_checks",
  "saving_to_library",
] as const;

export type StudioStage = (typeof STUDIO_STAGES)[number];

export const STAGE_LABELS: Record<StudioStage, string> = {
  preparing_scene: "Preparing scene",
  building_soundtrack: "Building soundtrack",
  creating_ambience: "Creating ambience",
  rendering: "Rendering",
  final_checks: "Final checks",
  saving_to_library: "Saving to Library",
};

export type MusicTrack = {
  id: string;
  title: string;
  artistSource: string;
  durationSeconds: number;
  genre: string;
  mood: MusicMood | string;
  source: MusicSource;
  licenseType: string;
  commercialUseAllowed: boolean | null;
  youtubeMonetizationAllowed: YoutubeUse;
  attributionRequired: boolean;
  attributionText: string;
  licenseUrl?: string | null;
  acquisitionDate?: string | null;
  proofStoragePath?: string | null;
  internalNotes?: string;
  storagePath?: string | null;
  publicSrc?: string | null;
  filename?: string | null;
  storageBucket?: string | null;
  compositionRights: "owned" | "licensed" | "public_domain" | "unknown";
  recordingRights: "owned" | "licensed" | "public_domain" | "unknown";
  rightsComplete: boolean;
  demo?: boolean;
  proofAccessible?: boolean;
  fileSha256?: string | null;
  creationRecord?: Record<string, unknown>;
  editorialStatus?: string;
};

export type PlaylistEntry = {
  trackId: string;
  startSeconds: number;
  endSeconds: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
};

export type VisualAssetRights = {
  id: string;
  title: string;
  origin: "tdg_library" | "generated" | "uploaded";
  commercialUseAllowed: boolean | null;
  notes?: string;
  creationRecord?: Record<string, unknown>;
};

export type RightsManifest = {
  visuals: Array<{
    id: string;
    title: string;
    status: "cleared" | "needs_review";
    origin: string;
    notes?: string;
  }>;
  music: Array<{
    id: string;
    title: string;
    source: string;
    licenseType: string;
    commercialUseAllowed: boolean | null;
    youtubeMonetizationAllowed: YoutubeUse;
    attributionRequired: boolean;
    attribution: string | null;
  }>;
  publicationStatus: "rights_documented" | "rights_review_required";
  blockers: string[];
  generatedAt: string;
};

export type SimilarityReport = {
  score: number;
  closestProductionId: string | null;
  closestTitle: string | null;
  reasons: string[];
  tooSimilar: boolean;
};

export type ThumbnailConcept = {
  id: string;
  label: string;
  textMode: "none" | "short";
  overlayText: string;
  cropHint: string;
};

export type YouTubePublishDraft = {
  productionId: string;
  title: string;
  description: string;
  tags: string[];
  thumbnailPath?: string;
  privacyStatus: "private" | "unlisted" | "public";
  scheduleAt?: string | null;
};

export type LongFormConfig = {
  sceneIds: string[];
  sceneSequence: string[];
  musicTrackIds: string[];
  playlistOrder: string[];
  visualTreatment: string;
  stylePreset: StylePreset;
  durationSeconds: number;
  title: string;
  thumbnailConceptId?: string;
};

export type ExistingProductionFingerprint = {
  id: string;
  title: string;
  config: LongFormConfig;
};

export const MOOD_LABELS: Record<MusicMood, string> = {
  christmas_jazz: "Christmas Jazz",
  christmas_piano: "Christmas Piano",
  classic_christmas: "Classic Christmas",
  cozy_instrumental: "Cozy Instrumental",
  relaxing_christmas: "Relaxing Christmas",
  sleep_christmas: "Sleep Christmas",
};

export const STYLE_LABELS: Record<StylePreset, string> = {
  cozy: "Cozy",
  luxury: "Luxury",
  snowy: "Snowy",
  traditional: "Traditional",
  magical: "Magical",
  relaxing: "Relaxing",
};

export const DURATION_BUTTONS: Array<{ seconds: number; label: string; enabled: boolean }> = [
  { seconds: 3600, label: "1 HOUR", enabled: true },
  { seconds: 10800, label: "3 HOURS", enabled: false },
  { seconds: 21600, label: "6 HOURS", enabled: false },
  { seconds: 28800, label: "8 HOURS", enabled: false },
  { seconds: 43200, label: "12 HOURS", enabled: false },
];
