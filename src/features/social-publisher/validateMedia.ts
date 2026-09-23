import { PLATFORM_CONSTRAINTS } from "./platforms";
import type { LibraryAssetSnapshot, MediaIssue, MediaValidationResult, SocialPlatform } from "./types";

function containerOf(filename: string, explicit?: string | null): string {
  if (explicit) return explicit.toLowerCase().replace(/^\./, "");
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
}

function aspectRatio(width: number, height: number): number {
  return width / height;
}

const TARGET_ASPECT = 9 / 16;

export function validateLibraryAssetForPlatforms(
  asset: LibraryAssetSnapshot,
  platforms: SocialPlatform[],
): MediaValidationResult {
  const issues: MediaIssue[] = [];

  if (asset.exists === false) {
    issues.push({ code: "media_missing", message: `Video file is missing: ${asset.src}` });
    return { ok: false, issues };
  }

  const container = containerOf(asset.filename, asset.container);
  const duration = asset.durationSeconds ?? null;
  const width = asset.width ?? null;
  const height = asset.height ?? null;
  const codec = (asset.codec || "").toLowerCase();
  const size = asset.fileSizeBytes ?? null;

  if (!platforms.length) {
    issues.push({ code: "no_platforms", message: "Select at least one platform." });
  }

  for (const platform of platforms) {
    const spec = PLATFORM_CONSTRAINTS[platform];
    if (!spec) {
      issues.push({ code: "unknown_platform", message: `Unknown platform: ${platform}` });
      continue;
    }

    const isPhotoAsset = asset.kind === "photo" || ["jpg", "jpeg", "png", "webp"].includes(container);
    if (spec.kind === "photo" && !isPhotoAsset) {
      issues.push({
        code: "not_a_photo",
        platform,
        message: `${spec.label} needs an image file.`,
      });
      continue;
    }
    if (spec.kind !== "photo" && isPhotoAsset) {
      issues.push({
        code: "not_a_reel",
        platform,
        message: "Photos cannot be published as Reels. Choose a Reel asset.",
      });
      continue;
    }

    if (spec.kind !== "photo" && duration != null) {
      if (duration < spec.minDurationSeconds) {
        issues.push({
          code: "too_short",
          platform,
          message: `${spec.label} requires at least ${spec.minDurationSeconds}s (this file is ${duration}s).`,
        });
      }
      if (duration > spec.maxDurationSeconds) {
        issues.push({
          code: "too_long",
          platform,
          message: `${spec.label} allows at most ${spec.maxDurationSeconds}s (this file is ${duration}s).`,
        });
      }
    }

    if (spec.aspect !== "any" && width != null && height != null) {
      if (width < spec.minWidth || height < spec.minHeight) {
        issues.push({
          code: "resolution_low",
          platform,
          message: `${spec.label} needs at least ${spec.minWidth}×${spec.minHeight} (this file is ${width}×${height}).`,
        });
      }
      const ratio = aspectRatio(width, height);
      if (Math.abs(ratio - TARGET_ASPECT) > spec.aspectTolerance) {
        issues.push({
          code: "aspect_ratio",
          platform,
          message: `${spec.label} requires vertical 9:16. This file is ${width}×${height}.`,
        });
      }
    }

    if (container && !spec.containers.includes(container)) {
      issues.push({
        code: "container",
        platform,
        message: `${spec.label} does not accept .${container}. Use ${spec.containers.join(" / ")}.`,
      });
    }

    if (codec && spec.codecs.length > 0 && !spec.codecs.some((item) => codec.includes(item))) {
      issues.push({
        code: "codec",
        platform,
        message: `${spec.label} expects H.264 (or listed codecs). Detected: ${codec}.`,
      });
    }

    if (size != null && size > spec.maxFileSizeBytes) {
      const mb = (size / (1024 * 1024)).toFixed(1);
      const cap = (spec.maxFileSizeBytes / (1024 * 1024)).toFixed(0);
      issues.push({
        code: "file_size",
        platform,
        message: `${spec.label} max file size is ${cap} MB (this file is ${mb} MB).`,
      });
    }
  }

  return { ok: issues.length === 0, issues };
}

export function snapshotFromCatalog(video: {
  id: string;
  title: string;
  src: string;
  filename: string;
  kind: LibraryAssetSnapshot["kind"];
  durationSeconds?: number;
  width?: number;
  height?: number;
  container?: string;
  codec?: string;
}): LibraryAssetSnapshot {
  const isPhoto = video.kind === "photo" || /\.(jpe?g|png|webp)$/i.test(video.filename);
  return {
    id: video.id,
    title: video.title,
    src: video.src,
    filename: video.filename,
    kind: isPhoto ? "photo" : video.kind,
    durationSeconds: video.durationSeconds ?? null,
    width: video.width ?? (isPhoto ? null : 1080),
    height: video.height ?? (isPhoto ? null : 1920),
    container: video.container ?? (isPhoto ? null : "mp4"),
    codec: video.codec ?? (isPhoto ? null : "h264"),
    exists: true,
  };
}
