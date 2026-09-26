import type { ProbeInfo } from "../clip-factory/ffmpeg";
import type { AutopilotMusicTrack, PublishChecks, PlatformMetadata } from "./types";

export function evaluateReadiness(input: {
  videoProbe: ProbeInfo | null;
  musicTrack: AutopilotMusicTrack | null;
  musicProbe: ProbeInfo | null;
  audioRenderOk: boolean;
  finalProbe: ProbeInfo | null;
  metadata: PlatformMetadata | null;
}): { ok: boolean; checks: PublishChecks; errors: string[] } {
  const checks: PublishChecks = {};
  const errors: string[] = [];

  const videoValid =
    Boolean(input.videoProbe) &&
    input.videoProbe!.duration > 2 &&
    input.videoProbe!.width >= 720 &&
    input.videoProbe!.height >= 720 &&
    input.videoProbe!.orientation === "portrait";
  checks.videoValid = videoValid;
  if (!videoValid) errors.push("source_video_invalid");

  const musicLicenseVerified =
    Boolean(input.musicTrack) &&
    input.musicTrack!.approvedForAutopilot &&
    input.musicTrack!.commercialUseAllowed === true;
  checks.musicLicenseVerified = musicLicenseVerified;
  if (!musicLicenseVerified) errors.push("music_not_verified");

  const musicFileValid =
    Boolean(input.musicProbe) && input.musicProbe!.duration > 5 && Boolean(input.musicProbe!.audioCodec);
  checks.musicFileValid = musicFileValid;
  if (!musicFileValid) errors.push("music_file_invalid");

  checks.audioRenderSuccess = input.audioRenderOk;
  if (!input.audioRenderOk) errors.push("audio_render_failed");

  const finalVideoValid =
    Boolean(input.finalProbe) &&
    input.finalProbe!.duration > 2 &&
    input.finalProbe!.width >= 720 &&
    input.finalProbe!.height >= 720 &&
    input.finalProbe!.orientation === "portrait" &&
    (input.finalProbe!.videoCodec === "h264" || input.finalProbe!.videoCodec === "hevc" || input.finalProbe!.videoCodec === "av1");
  checks.finalVideoValid = finalVideoValid;
  if (!finalVideoValid) errors.push("final_video_invalid");

  const metadataGenerated = Boolean(
    input.metadata?.instagram?.caption && input.metadata?.youtube?.title && input.metadata?.youtube?.description,
  );
  checks.metadataGenerated = metadataGenerated;
  if (!metadataGenerated) errors.push("metadata_missing");

  const platformRequirementsValid =
    finalVideoValid &&
    metadataGenerated &&
    Boolean(input.metadata?.youtube?.title && input.metadata.youtube.title.length <= 100);
  checks.platformRequirementsValid = platformRequirementsValid;
  if (!platformRequirementsValid) errors.push("platform_requirements_invalid");

  const ok = errors.length === 0;
  return { ok, checks, errors };
}

export function publishReadyFromStatus(status: string): boolean {
  return status === "ready_to_publish" || status === "legacy";
}
