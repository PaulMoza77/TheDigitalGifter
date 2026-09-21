import { clearedForCommercialYoutube, isRightsComplete } from "./musicRights";
import type { MusicTrack, RightsManifest, VisualAssetRights } from "./types";

export function validateProductionRights(input: {
  visuals: VisualAssetRights[];
  tracks: MusicTrack[];
}): { ok: boolean; blockers: string[]; manifest: RightsManifest } {
  const blockers: string[] = [];
  const visuals = input.visuals.map((visual) => {
    const cleared = visual.commercialUseAllowed === true;
    if (!cleared) blockers.push(`Visual “${visual.title}” needs commercial-rights review.`);
    return {
      id: visual.id,
      title: visual.title,
      status: cleared ? ("cleared" as const) : ("needs_review" as const),
      origin: visual.origin,
      notes: visual.notes,
    };
  });
  if (!input.visuals.length) blockers.push("No visual assets selected.");
  if (!input.tracks.length) blockers.push("No music tracks selected.");

  const music = input.tracks.map((track) => {
    if (track.commercialUseAllowed !== true) {
      blockers.push(`Music “${track.title}” is not cleared for commercial use.`);
    }
    if (track.youtubeMonetizationAllowed !== "yes") {
      blockers.push(`Music “${track.title}” does not have confirmed YouTube use.`);
    }
    if (track.attributionRequired && !track.attributionText.trim()) {
      blockers.push(`Music “${track.title}” requires attribution text.`);
    }
    if (!isRightsComplete(track) || !clearedForCommercialYoutube(track)) {
      blockers.push(`Music “${track.title}” rights data is incomplete.`);
    }
    return {
      id: track.id,
      title: track.title,
      source: track.source,
      licenseType: track.licenseType,
      commercialUseAllowed: track.commercialUseAllowed,
      youtubeMonetizationAllowed: track.youtubeMonetizationAllowed,
      attributionRequired: track.attributionRequired,
      attribution: track.attributionRequired ? track.attributionText.trim() || null : null,
    };
  });

  const uniqueBlockers = [...new Set(blockers)];
  const ok = uniqueBlockers.length === 0;
  return {
    ok,
    blockers: uniqueBlockers,
    manifest: {
      visuals,
      music,
      publicationStatus: ok ? "rights_documented" : "rights_review_required",
      blockers: uniqueBlockers,
      generatedAt: new Date().toISOString(),
    },
  };
}

export function formatRightsManifestText(manifest: RightsManifest): string {
  const lines = ["RIGHTS MANIFEST", "", "VISUALS"];
  for (const visual of manifest.visuals) {
    const mark = visual.status === "cleared" ? "✓" : "⚠";
    lines.push(`${mark} ${visual.title} — ${visual.origin}${visual.notes ? ` (${visual.notes})` : ""}`);
  }
  lines.push("", "MUSIC");
  for (const track of manifest.music) {
    lines.push(`Track — ${track.title}`);
    lines.push(`Source: ${track.source}`);
    lines.push(`License: ${track.licenseType}`);
    lines.push(`Attribution: ${track.attributionRequired ? "Required" : "No"}`);
    if (track.attribution) lines.push(track.attribution);
    lines.push("");
  }
  if (manifest.blockers.length) {
    lines.push("BLOCKERS");
    for (const b of manifest.blockers) lines.push(`- ${b}`);
  }
  return lines.join("\n").trim();
}
