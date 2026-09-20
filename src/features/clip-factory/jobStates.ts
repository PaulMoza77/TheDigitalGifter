export const CLIP_FACTORY_JOB_STATUSES = [
  "queued",
  "importing",
  "extracting_audio",
  "transcribing",
  "analyzing",
  "selecting_moments",
  "rendering",
  "captioning",
  "saving",
  "completed",
  "failed",
  // legacy rows from the first Clip Factory release
  "ingesting",
  "analyzing_audio",
  "understanding_scenes",
  "finding_hooks",
  "scoring",
  "ready",
  "partial",
] as const;

export type ClipFactoryJobStatus = (typeof CLIP_FACTORY_JOB_STATUSES)[number];

const TRANSITIONS: Record<string, readonly string[]> = {
  queued: ["importing", "ingesting", "failed"],
  importing: ["extracting_audio", "analyzing_audio", "failed"],
  ingesting: ["extracting_audio", "analyzing_audio", "failed"],
  extracting_audio: ["transcribing", "failed"],
  analyzing_audio: ["transcribing", "failed"],
  transcribing: ["analyzing", "understanding_scenes", "failed"],
  analyzing: ["selecting_moments", "finding_hooks", "failed"],
  understanding_scenes: ["selecting_moments", "finding_hooks", "scoring", "failed"],
  finding_hooks: ["selecting_moments", "scoring", "failed"],
  selecting_moments: ["rendering", "ready", "failed"],
  scoring: ["rendering", "ready", "failed"],
  ready: ["rendering", "completed", "failed"],
  rendering: ["captioning", "saving", "completed", "partial", "failed"],
  captioning: ["saving", "rendering", "completed", "failed"],
  saving: ["completed", "rendering", "partial", "failed"],
  completed: ["rendering", "failed"],
  partial: ["rendering", "failed", "queued"],
  failed: ["queued", "importing", "rendering"],
};

export function canTransitionJob(from: string, to: string): boolean {
  if (from === to) return true;
  return (TRANSITIONS[from] || []).includes(to);
}

export function assertJobTransition(from: string, to: string): void {
  if (!canTransitionJob(from, to)) {
    throw new Error(`Illegal clip factory transition: ${from} → ${to}`);
  }
}

export function normalizeJobStatus(status: string): ClipFactoryJobStatus {
  if (status === "ingesting") return "importing";
  if (status === "analyzing_audio") return "extracting_audio";
  if (status === "understanding_scenes") return "analyzing";
  if (status === "finding_hooks" || status === "scoring") return "selecting_moments";
  if (status === "ready") return "selecting_moments";
  return (CLIP_FACTORY_JOB_STATUSES as readonly string[]).includes(status)
    ? (status as ClipFactoryJobStatus)
    : "queued";
}

export function isTerminalJobStatus(status: string): boolean {
  return status === "completed" || status === "failed";
}

export function isActiveJobStatus(status: string): boolean {
  return !isTerminalJobStatus(status) && status !== "ready" && status !== "partial";
}

export function requiresRightsConfirmation(sourceKind: string): boolean {
  return sourceKind === "direct_media_url" || sourceKind === "youtube" || sourceKind === "vimeo" || sourceKind === "supported_external_source";
}

export function rightsConfirmationError(confirmed: unknown): string | null {
  if (confirmed === true) return null;
  return "Confirm that you own this content or have permission to use it.";
}
