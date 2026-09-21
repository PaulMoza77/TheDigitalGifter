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

export function hasStoredProof(track: Pick<MusicTrack, "proofStoragePath" | "proofAccessible" | "demo" | "creationRecord">): boolean {
  if (track.demo) return Boolean(track.creationRecord && Object.keys(track.creationRecord).length);
  return Boolean(track.proofAccessible && track.proofStoragePath);
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
  | "demo"
  | "proofAccessible"
  | "proofStoragePath"
  | "creationRecord"
>): boolean {
  if (track.demo) return false;
  if (track.commercialUseAllowed !== true) return false;
  if (track.youtubeMonetizationAllowed === "unknown") return false;
  if (!track.licenseType.trim()) return false;
  if (track.compositionRights === "unknown") return false;
  if (track.recordingRights === "unknown") return false;
  if (track.attributionRequired && !track.attributionText.trim()) return false;
  if (!hasStoredProof(track)) return false;
  return true;
}

export function youtubeUseFromRecord(value: unknown): YoutubeUse {
  if (value === "yes" || value === "no" || value === "unknown") return value;
  return "unknown";
}

export type TrackBadge =
  | { kind: "cleared"; labels: string[] }
  | { kind: "demo"; labels: string[] }
  | { kind: "review"; labels: ["Rights need review"] };

export function trackBadges(track: MusicTrack): TrackBadge {
  if (track.demo) {
    return { kind: "demo", labels: ["Demo / test pad", "Not a finished Christmas recording"] };
  }
  if (!isRightsComplete(track)) {
    return { kind: "review", labels: ["Rights need review"] };
  }
  const labels: string[] = [];
  if (track.commercialUseAllowed === true) labels.push("Commercial use");
  if (track.youtubeMonetizationAllowed === "yes") labels.push("YouTube use (claim-not-guaranteed)");
  if (track.proofAccessible && track.proofStoragePath) labels.push("License stored");
  else if (track.creationRecord && Object.keys(track.creationRecord).length) labels.push("Creation record stored");
  if (labels.length < 3) return { kind: "review", labels: ["Rights need review"] };
  return { kind: "cleared", labels };
}

export function youtubeAudioLibraryLicenseType(attributionRequired: boolean): string {
  return attributionRequired
    ? "YouTube Audio Library — Attribution Required"
    : "YouTube Audio Library — Attribution Not Required";
}

export function clearedForCommercialYoutube(track: MusicTrack): boolean {
  return isRightsComplete(track) && recordingCleared(track) && compositionCleared(track) && !track.demo;
}
