import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { assessMediaQuality, type MediaQualityFailure } from "../../../src/features/clip-factory/mediaQuality";
import { extractJpeg, ffprobeFile, type ProbeInfo } from "./ffmpeg";
import { IngestError } from "./ingest";

export async function sampleJpegSizes(sourcePath: string, duration: number, count = 4): Promise<number[]> {
  const dir = join(tmpdir(), `tdg-frames-${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  const sizes: number[] = [];
  try {
    const times = [];
    for (let i = 0; i < count; i += 1) {
      const t = Math.min(Math.max(0.12, (duration * (i + 0.5)) / count), Math.max(0.12, duration - 0.12));
      times.push(Number(t.toFixed(3)));
    }
    for (const t of times) {
      const dest = join(dir, `${t}.jpg`);
      try {
        await extractJpeg(sourcePath, t, dest);
        const stat = await fs.stat(dest);
        sizes.push(stat.size);
      } catch {
        sizes.push(0);
      }
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
  return sizes;
}

export async function assertUsableSourceMedia(input: {
  path: string;
  expectedDurationSeconds?: number | null;
  mediaHash?: string | null;
}): Promise<ProbeInfo> {
  let probe: ProbeInfo;
  try {
    probe = await ffprobeFile(input.path);
  } catch {
    throw new IngestError("corrupt_file", "This file could not be read as video. Try MP4/H.264.");
  }
  const jpegSampleBytes = await sampleJpegSizes(input.path, probe.duration);
  const quality = assessMediaQuality({
    durationSeconds: probe.duration,
    width: probe.width,
    height: probe.height,
    fileSizeBytes: probe.fileSize || 0,
    hasVideo: Boolean(probe.videoCodec),
    hasAudio: probe.hasAudio,
    videoCodec: probe.videoCodec,
    expectedDurationSeconds: input.expectedDurationSeconds,
    jpegSampleBytes,
    mediaHash: input.mediaHash,
  });
  if (!quality.ok) {
    const fail = quality as MediaQualityFailure;
    throw new IngestError(fail.code, fail.message);
  }
  return probe;
}

export async function assertUsableRenderedClip(input: {
  path: string;
  expectedDuration: number;
  expectedWidth?: number;
  expectedHeight?: number;
}): Promise<ProbeInfo> {
  let probe: ProbeInfo;
  try {
    probe = await ffprobeFile(input.path);
  } catch {
    throw new IngestError("render_failure", "Rendered clip could not be decoded.");
  }
  if (probe.width !== (input.expectedWidth || 1080) || probe.height !== (input.expectedHeight || 1920)) {
    throw new IngestError("render_failure", `Rendered clip is ${probe.width}×${probe.height}, expected 1080×1920.`);
  }
  if (!probe.hasAudio) {
    throw new IngestError("render_failure", "Rendered clip has no audio stream.");
  }
  if (Math.abs(probe.duration - input.expectedDuration) > 1.25) {
    throw new IngestError(
      "render_failure",
      `Rendered clip duration ${probe.duration.toFixed(2)}s does not match the selected ${input.expectedDuration.toFixed(2)}s window.`,
    );
  }
  const jpegs = await sampleJpegSizes(input.path, probe.duration, 3);
  if (jpegs.length >= 3 && jpegs.every((n) => n > 0 && n < 9000)) {
    throw new IngestError("uniform_frames", "Rendered clip frames are uniform/empty. Refusing to mark this clip ready.");
  }
  return probe;
}
