import type { MusicTrack } from "./types";
import { isRightsComplete } from "./musicRights";
import { youtubeAudioLibraryLicenseType } from "./musicRights";

function demoPad(partial: {
  id: string;
  title: string;
  durationSeconds: number;
  genre: string;
  mood: string;
  filename: string;
}): MusicTrack {
  const track: MusicTrack = {
    ...partial,
    source: "generated_demo",
    licenseType: "FFmpeg aevalsrc demo pad · not a commercial master",
    commercialUseAllowed: null,
    youtubeMonetizationAllowed: "unknown",
    attributionRequired: false,
    attributionText: "",
    compositionRights: "unknown",
    recordingRights: "unknown",
    artistSource: "TDG studio generator (demo)",
    acquisitionDate: "2026-09-21",
    internalNotes:
      "Synthesized test tone from api/_lib/long-form-studio/originalMusic.ts. Not Christmas jazz/piano, not YouTube-cleared.",
    publicSrc: `/assets/long-form/music/${partial.filename}`,
    demo: true,
    proofAccessible: false,
    creationRecord: {
      kind: "ffmpeg_aevalsrc_recipe",
      recipe: "api/_lib/long-form-studio/originalMusic.ts",
      filename: partial.filename,
    },
    editorialStatus: "demo_unreviewed",
    rightsComplete: false,
  };
  return { ...track, rightsComplete: isRightsComplete(track) };
}

/** Demo pads only. Do not present these as premium Christmas recordings. */
export const ORIGINAL_MUSIC_SEED: MusicTrack[] = [
  demoPad({
    id: "tdg-orig-cozy-hearth",
    title: "Demo pad · warm drone",
    durationSeconds: 180,
    genre: "test pad",
    mood: "cozy_instrumental",
    filename: "hearth_glow.m4a",
  }),
  demoPad({
    id: "tdg-orig-jazz-ember",
    title: "Demo pad · mid drone",
    durationSeconds: 180,
    genre: "test pad",
    mood: "christmas_jazz",
    filename: "ember_lounge.m4a",
  }),
  demoPad({
    id: "tdg-orig-piano-snowfall",
    title: "Demo pad · high drone",
    durationSeconds: 180,
    genre: "test pad",
    mood: "christmas_piano",
    filename: "snowfall_keys.m4a",
  }),
  demoPad({
    id: "tdg-orig-classic-wreath",
    title: "Demo pad · fifths",
    durationSeconds: 180,
    genre: "test pad",
    mood: "classic_christmas",
    filename: "wreath_carol_air.m4a",
  }),
  demoPad({
    id: "tdg-orig-relax-window",
    title: "Demo pad · low drone",
    durationSeconds: 180,
    genre: "test pad",
    mood: "relaxing_christmas",
    filename: "window_quiet.m4a",
  }),
  demoPad({
    id: "tdg-orig-sleep-ember",
    title: "Demo pad · slow drone",
    durationSeconds: 240,
    genre: "test pad",
    mood: "sleep_christmas",
    filename: "sleeping_embers.m4a",
  }),
];

export function exampleYoutubeAudioLibraryTrack(attributionRequired: boolean): MusicTrack {
  const track: MusicTrack = {
    id: attributionRequired ? "yal-example-attr" : "yal-example-no-attr",
    title: attributionRequired ? "YAL import (attribution required)" : "YAL import (no attribution)",
    artistSource: "YouTube Audio Library",
    durationSeconds: 0,
    genre: "",
    mood: "cozy_instrumental",
    source: "youtube_audio_library",
    licenseType: youtubeAudioLibraryLicenseType(attributionRequired),
    commercialUseAllowed: null,
    youtubeMonetizationAllowed: "unknown",
    attributionRequired,
    attributionText: attributionRequired ? "" : "",
    compositionRights: "unknown",
    recordingRights: "unknown",
    rightsComplete: false,
    proofAccessible: false,
    internalNotes: "Import template only. Rights stay unknown until proof is stored.",
  };
  return { ...track, rightsComplete: isRightsComplete(track) };
}
