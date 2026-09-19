export const CLIP_FACTORY_STAGES = [
  "queued",
  "uploading",
  "ingesting",
  "analyzing_audio",
  "transcribing",
  "understanding_scenes",
  "finding_hooks",
  "scoring",
  "creating_clips",
  "generating_captions",
  "optimizing_vertical",
  "finalizing",
  "ready",
  "rendering",
  "completed",
  "partial",
  "failed",
] as const;

export type ClipFactoryStage = (typeof CLIP_FACTORY_STAGES)[number];

export const CLIP_COUNT_OPTIONS = [5, 10, 20, "auto"] as const;
export type ClipCountOption = (typeof CLIP_COUNT_OPTIONS)[number];

export const DURATION_OPTIONS = ["auto", "10-20", "20-30", "30-60"] as const;
export type DurationOption = (typeof DURATION_OPTIONS)[number];

export const PLATFORM_OPTIONS = [
  "auto",
  "instagram_reels",
  "tiktok",
  "youtube_shorts",
  "facebook_reels",
] as const;
export type PlatformOption = (typeof PLATFORM_OPTIONS)[number];

export const OBJECTIVE_OPTIONS = [
  "auto",
  "viral",
  "funny",
  "emotional",
  "educational",
  "storytelling",
  "inspirational",
  "christmas",
] as const;
export type ObjectiveOption = (typeof OBJECTIVE_OPTIONS)[number];

export const CAPTION_STYLES = ["auto", "clean", "bold_viral", "minimal", "karaoke"] as const;
export type CaptionStyle = (typeof CAPTION_STYLES)[number];

export type SourceKind = "upload" | "library" | "direct_media_url" | "supported_external_source";

export type TranscriptWord = {
  word: string;
  start: number;
  end: number;
  confidence?: number;
  speaker?: string;
};

export type TranscriptSegment = {
  id?: number;
  start: number;
  end: number;
  text: string;
  speaker?: string;
};

export type Transcript = {
  language: string | null;
  languageProbability?: number | null;
  fullText: string;
  words: TranscriptWord[];
  segments: TranscriptSegment[];
};

export type ScoreDimensions = {
  hook: number;
  retention: number;
  emotion: number;
  humor: number;
  visual: number;
  standalone: number;
  shareability: number;
};

export type ViralCandidate = {
  startTime: number;
  endTime: number;
  duration: number;
  title: string;
  hook: string;
  summary: string;
  reason: string;
  category: string;
  suggestedPlatforms: string[];
  suggestedCaption: string;
  suggestedPostCaption: string;
  hashtags: string[];
  confidence: number;
  scores: ScoreDimensions;
  overallViralScore: number;
  whyItWorks: string[];
  crop?: ReframePlan;
};

export type ReframeKeyframe = {
  t: number;
  subjectX: number;
  subjectY: number;
  hasFace: boolean;
  confidence: number;
};

export type ReframePlan = {
  mode: "track" | "blur_pad" | "center";
  keyframes: ReframeKeyframe[];
};

export type ClipFactoryOptions = {
  clipCount: ClipCountOption;
  duration: DurationOption;
  platform: PlatformOption;
  objective: ObjectiveOption;
  language: string;
  captionStyle: CaptionStyle;
  aiHook: boolean;
};

export const DEFAULT_CLIP_FACTORY_OPTIONS: ClipFactoryOptions = {
  clipCount: 10,
  duration: "auto",
  platform: "auto",
  objective: "auto",
  language: "auto",
  captionStyle: "auto",
  aiHook: true,
};

export const STAGE_LABELS: Record<string, string> = {
  queued: "Queued",
  uploading: "Uploading / importing video",
  ingesting: "Uploading / importing video",
  analyzing_audio: "Analyzing audio",
  transcribing: "Creating transcript",
  understanding_scenes: "Understanding scenes",
  finding_hooks: "Finding hooks",
  scoring: "Scoring moments",
  creating_clips: "Creating clips",
  generating_captions: "Generating captions",
  optimizing_vertical: "Optimizing for vertical video",
  finalizing: "Finalizing",
  ready: "Ready",
  rendering: "Creating clips",
  completed: "Completed",
  partial: "Partially completed",
  failed: "Failed",
};

export const ANALYSIS_STAGE_ORDER = [
  "ingesting",
  "analyzing_audio",
  "transcribing",
  "understanding_scenes",
  "finding_hooks",
  "scoring",
  "finalizing",
] as const;
