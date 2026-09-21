import type { MusicTrack, YoutubeUse } from "./types";

const POSITIVE_FILENAME_HINTS = [
  "royalty free",
  "royalty-free",
  "no copyright",
  "nocopyright",
  "ncs",
  "free music",
  "copyright free",
];

export function filenameImpliesSafety(title: string, filename?: string | null): boolean {
  const hay = `${title} ${filename || ""}`.toLowerCase();
  return POSITIVE_FILENAME_HINTS.some((hint) => hay.includes(hint));
}

/**
 * Never treat a public-domain composition as a public-domain recording.
 * Both legs must be independently cleared.
 */
export function recordingCleared(track: Pick<MusicTrack, "recordingRights" | "commercialUseAllowed">): boolean {
  if (track.commercialUseAllowed !== true) return false;
  return track.recordingRights === "owned" || track.recordingRights === "licensed" || track.recordingRights === "public_domain";
}

export function compositionCleared(track: Pick<MusicTrack, "compositionRights">): boolean {
  return (
    track.compositionRights === "owned" ||
    track.compositionRights === "licensed" ||
    track.compositionRights === "public_domain"
  );
}

export function isRightsComplete(track: Pick<
  MusicTrack,
  | "commercialUseAllowed"
  | "youtubeMonetizationAllowed"
  | "attributionRequired"
  | "attributionText"
  | "licenseType"
  | "source"
  | "compositionRights"
  | "recordingRights"
>): boolean {
  if (track.commercialUseAllowed !== true) return false;
  if (track.youtubeMonetizationAllowed === "unknown") return false;
  if (!track.licenseType.trim()) return false;
  if (track.compositionRights === "unknown") return false;
  if (track.recordingRights === "unknown") return false;
  if (track.attributionRequired && !track.attributionText.trim()) return false;
  return true;
}

export function youtubeUseFromRecord(value: unknown): YoutubeUse {
  if (value === "yes" || value === "no" || value === "unknown") return value;
  return "unknown";
}

export type TrackBadge =
  | { kind: "cleared"; labels: string[] }
  | { kind: "review"; labels: ["Rights need review"] };

export function trackBadges(track: MusicTrack): TrackBadge {
  if (!track.rightsComplete || !isRightsComplete(track)) {
    return { kind: "review", labels: ["Rights need review"] };
  }
  const labels: string[] = [];
  if (track.commercialUseAllowed === true) labels.push("Commercial use");
  if (track.youtubeMonetizationAllowed === "yes") labels.push("YouTube use");
  if (track.licenseType.trim()) labels.push("License stored");
  if (labels.length < 3) return { kind: "review", labels: ["Rights need review"] };
  return { kind: "cleared", labels };
}

export function youtubeAudioLibraryLicenseType(attributionRequired: boolean): string {
  return attributionRequired
    ? "YouTube Audio Library — Attribution Required"
    : "YouTube Audio Library — Attribution Not Required";
}

export function clearedForCommercialYoutube(track: MusicTrack): boolean {
  return (
    track.rightsComplete &&
    isRightsComplete(track) &&
    track.commercialUseAllowed === true &&
    track.youtubeMonetizationAllowed === "yes" &&
    recordingCleared(track) &&
    compositionCleared(track)
  );
}
