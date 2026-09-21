import type { MusicTrack } from "./types";
import { isRightsComplete } from "./musicRights";
import { youtubeAudioLibraryLicenseType } from "./musicRights";

function original(partial: {
  id: string;
  title: string;
  durationSeconds: number;
  genre: string;
  mood: string;
  filename: string;
}): MusicTrack {
  const track: MusicTrack = {
    ...partial,
    source: "original_owned",
    licenseType: "TDG original — owned recording and composition",
    commercialUseAllowed: true,
    youtubeMonetizationAllowed: "yes",
    attributionRequired: false,
    attributionText: "",
    compositionRights: "owned",
    recordingRights: "owned",
    artistSource: "The Digital Gifter",
    acquisitionDate: "2026-09-21",
    internalNotes: "Original TDG-owned recording generated for Long-Form Studio. Not a third-party Christmas master.",
    publicSrc: `/assets/long-form/music/${partial.filename}`,
    rightsComplete: false,
  };
  return { ...track, rightsComplete: isRightsComplete(track) };
}

/** Catalog of original owned tracks. Audio files are created by the studio renderer if missing. */
export const ORIGINAL_MUSIC_SEED: MusicTrack[] = [
  original({
    id: "tdg-orig-cozy-hearth",
    title: "Hearth Glow",
    durationSeconds: 180,
    genre: "ambient instrumental",
    mood: "cozy_instrumental",
    filename: "hearth_glow.m4a",
  }),
  original({
    id: "tdg-orig-jazz-ember",
    title: "Ember Lounge",
    durationSeconds: 180,
    genre: "christmas jazz",
    mood: "christmas_jazz",
    filename: "ember_lounge.m4a",
  }),
  original({
    id: "tdg-orig-piano-snowfall",
    title: "Snowfall Keys",
    durationSeconds: 180,
    genre: "piano",
    mood: "christmas_piano",
    filename: "snowfall_keys.m4a",
  }),
  original({
    id: "tdg-orig-classic-wreath",
    title: "Wreath Carol Air",
    durationSeconds: 180,
    genre: "classic instrumental",
    mood: "classic_christmas",
    filename: "wreath_carol_air.m4a",
  }),
  original({
    id: "tdg-orig-relax-window",
    title: "Window Quiet",
    durationSeconds: 180,
    genre: "ambient",
    mood: "relaxing_christmas",
    filename: "window_quiet.m4a",
  }),
  original({
    id: "tdg-orig-sleep-ember",
    title: "Sleeping Embers",
    durationSeconds: 240,
    genre: "sleep ambient",
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
    commercialUseAllowed: true,
    youtubeMonetizationAllowed: "yes",
    attributionRequired,
    attributionText: attributionRequired ? "Song Title — Artist (YouTube Audio Library)" : "",
    compositionRights: "licensed",
    recordingRights: "licensed",
    rightsComplete: false,
    internalNotes: "Imported by an admin from YouTube Audio Library. Do not scrape.",
  };
  return { ...track, rightsComplete: isRightsComplete(track) };
}
