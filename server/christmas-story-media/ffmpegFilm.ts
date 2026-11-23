/**
 * Deterministic FFmpeg memory-film renderer (Mission 02D).
 * Secure argv-only spawn. No URL ingestion. No shell interpolation.
 * Typography plates are generated with Pillow when FFmpeg lacks drawtext.
 */
import { mkdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import type { FilmRenderInput, FilmRenderResult } from "./types.ts";
import {
  MAX_OUTPUT_BYTES,
  resolveUnderRoot,
  safeJobFileName,
  sha256File,
  validateAudioFile,
  validatePhotoList,
} from "./safePaths.ts";
import { ffprobeJson, runCommand } from "./runCommand.ts";
import { renderTextPlate } from "./textPlate.ts";

const DEFAULT_FPS = 30;
const DEFAULT_SEC_PER_PHOTO = 3.2;
const TITLE_SEC = 2.4;
const END_SEC = 3.2;
const RENDER_TIMEOUT_MS = 180_000;

function dims(aspect: "landscape" | "portrait"): { w: number; h: number } {
  return aspect === "portrait" ? { w: 720, h: 1280 } : { w: 1280, h: 720 };
}

function peakRssMb(): number | null {
  try {
    const rss = process.resourceUsage?.().maxRSS;
    if (typeof rss === "number" && rss > 0) {
      return rss > 1_000_000 ? Math.round(rss / (1024 * 1024)) : Math.round(rss / 1024);
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function probeMedia(path: string): Promise<{
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  videoCodec: string | null;
  pixFmt: string | null;
}> {
  const json = await ffprobeJson(path);
  const streams = (json.streams as Array<Record<string, unknown>> | undefined) || [];
  const video = streams.find((s) => s.codec_type === "video");
  const audio = streams.find((s) => s.codec_type === "audio");
  const format = (json.format as Record<string, unknown> | undefined) || {};
  return {
    duration: Number(format.duration || 0),
    width: Number(video?.width || 0),
    height: Number(video?.height || 0),
    hasAudio: Boolean(audio),
    videoCodec: video?.codec_name ? String(video.codec_name) : null,
    pixFmt: video?.pix_fmt ? String(video.pix_fmt) : null,
  };
}

async function plateToClip(
  platePng: string,
  outMp4: string,
  seconds: number,
  fps: number,
  w: number,
  h: number,
) {
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-loop",
      "1",
      "-t",
      String(seconds),
      "-i",
      platePng,
      "-vf",
      `scale=${w}:${h},fps=${fps},format=yuv420p`,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-an",
      outMp4,
    ],
    RENDER_TIMEOUT_MS,
  );
}

/**
 * Render a warm cinematic photo film.
 * Photos are scaled/cropped (never face-warped). Motion is slow zoom only.
 */
export async function renderMemoryFilm(
  input: FilmRenderInput,
  workspaceRoot: string,
): Promise<FilmRenderResult> {
  const started = performance.now();
  const photos = validatePhotoList(input.photos, workspaceRoot);
  const outDir = resolveUnderRoot(workspaceRoot, input.outDir);
  mkdirSync(outDir, { recursive: true });

  let audioPath: string | null = null;
  if (input.audioPath) {
    audioPath = resolveUnderRoot(workspaceRoot, input.audioPath);
    validateAudioFile(audioPath);
  }

  const { w, h } = dims(input.aspect || "landscape");
  const fps = Math.min(30, Math.max(24, input.fps || DEFAULT_FPS));
  const secPer = Math.min(5, Math.max(2.5, input.secondsPerPhoto || DEFAULT_SEC_PER_PHOTO));
  const framesPer = Math.round(secPer * fps);

  const work = join(outDir, safeJobFileName(input.jobId, "work"));
  mkdirSync(work, { recursive: true });

  const clipPaths: string[] = [];
  const recipient = String(input.recipientName || "you").slice(0, 48);
  const dedication = String(input.dedication || "With love").slice(0, 140);

  // Title plate
  const titlePng = join(work, "title.png");
  renderTextPlate({
    outPath: titlePng,
    width: w,
    height: h,
    background: "#1a120e",
    lines: [
      { text: `For ${recipient}`, size: Math.round(w * 0.05), color: "#f5e6d3", yRatio: 0.46 },
      { text: "Our Christmas Story", size: Math.round(w * 0.028), color: "#d4b896", yRatio: 0.56 },
    ],
  });
  const titlePath = join(work, "title.mp4");
  await plateToClip(titlePng, titlePath, TITLE_SEC, fps, w, h);
  clipPaths.push(titlePath);

  // Photo clips with restrained zoompan
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]!;
    const clip = join(work, `clip_${String(i).padStart(2, "0")}.mp4`);
    const caption = String(input.captions?.[i] || "").slice(0, 80);
    // zoompan d=1 + -t/-frames:v keeps duration deterministic (avoids runaway frame counts).
    const vfParts = [
      `scale=${w * 2}:${h * 2}:force_original_aspect_ratio=increase`,
      `crop=${w * 2}:${h * 2}`,
      "setsar=1",
      `zoompan=z='min(1.0+0.0009*on,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${w}x${h}:fps=${fps}`,
      "format=yuv420p",
    ];
    await runCommand(
      "ffmpeg",
      [
        "-y",
        "-loop",
        "1",
        "-i",
        photo,
        "-t",
        String(secPer),
        "-vf",
        vfParts.join(","),
        "-frames:v",
        String(framesPer),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-an",
        clip,
      ],
      RENDER_TIMEOUT_MS,
    );

    if (caption) {
      const capPng = join(work, `cap_${i}.png`);
      renderTextPlate({
        outPath: capPng,
        width: w,
        height: Math.max(80, Math.round(h * 0.12)),
        background: "#000000",
        lines: [{ text: caption, size: Math.round(w * 0.025), color: "#f5e6d3", yRatio: 0.5 }],
      });
      const withCap = join(work, `clip_${String(i).padStart(2, "0")}_cap.mp4`);
      await runCommand(
        "ffmpeg",
        [
          "-y",
          "-i",
          clip,
          "-i",
          capPng,
          "-filter_complex",
          `[1:v]format=rgba,colorchannelmixer=aa=0.72[c];[0:v][c]overlay=0:H-h-24`,
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          "-preset",
          "veryfast",
          "-crf",
          "20",
          "-an",
          "-shortest",
          withCap,
        ],
        RENDER_TIMEOUT_MS,
      );
      clipPaths.push(withCap);
    } else {
      clipPaths.push(clip);
    }
  }

  // Ending dedication plate
  const endPng = join(work, "end.png");
  renderTextPlate({
    outPath: endPng,
    width: w,
    height: h,
    background: "#140e0a",
    lines: [
      { text: dedication, size: Math.round(w * 0.032), color: "#f5e6d3", yRatio: 0.5 },
    ],
  });
  const endPath = join(work, "end.mp4");
  await plateToClip(endPng, endPath, END_SEC, fps, w, h);
  clipPaths.push(endPath);

  // Concat demuxer list
  const listFile = join(work, "concat.txt");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(
    listFile,
    clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n") + "\n",
    "utf8",
  );

  const silentMp4 = join(work, "silent.mp4");
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listFile,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-movflags",
      "+faststart",
      "-an",
      silentMp4,
    ],
    RENDER_TIMEOUT_MS,
  );

  const finalMp4 = join(outDir, safeJobFileName(input.jobId, "film.mp4"));
  if (audioPath) {
    await runCommand(
      "ffmpeg",
      [
        "-y",
        "-i",
        silentMp4,
        "-i",
        audioPath,
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-ac",
        "2",
        "-ar",
        "48000",
        "-shortest",
        "-movflags",
        "+faststart",
        finalMp4,
      ],
      RENDER_TIMEOUT_MS,
    );
  } else {
    await runCommand(
      "ffmpeg",
      ["-y", "-i", silentMp4, "-c", "copy", "-movflags", "+faststart", finalMp4],
      60_000,
    );
  }

  const size = statSync(finalMp4).size;
  if (size <= 0 || size > MAX_OUTPUT_BYTES) {
    throw new Error("output_size_invalid");
  }

  const posterPath = join(outDir, safeJobFileName(input.jobId, "poster.jpg"));
  await runCommand(
    "ffmpeg",
    ["-y", "-ss", "0.8", "-i", finalMp4, "-frames:v", "1", "-q:v", "3", posterPath],
    60_000,
  );

  const previewMp4Path = join(outDir, safeJobFileName(input.jobId, "preview.mp4"));
  const previewArgs = [
    "-y",
    "-i",
    finalMp4,
    "-vf",
    `scale=${Math.round(w / 2)}:${Math.round(h / 2)}`,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "veryfast",
    "-crf",
    "28",
    "-movflags",
    "+faststart",
  ];
  if (audioPath) {
    previewArgs.push("-c:a", "aac", "-b:a", "96k");
  } else {
    previewArgs.push("-an");
  }
  previewArgs.push(previewMp4Path);
  await runCommand("ffmpeg", previewArgs, RENDER_TIMEOUT_MS);

  const probe = await probeMedia(finalMp4);
  if (probe.videoCodec !== "h264") throw new Error("output_codec_invalid");
  if (probe.pixFmt && probe.pixFmt !== "yuv420p") throw new Error("output_pix_fmt_invalid");
  if (probe.width < 320 || probe.height < 320) throw new Error("output_dims_invalid");

  const checksum = sha256File(finalMp4);
  const renderMs = Math.round(performance.now() - started);

  try {
    rmSync(work, { recursive: true, force: true });
  } catch {
    /* best-effort */
  }

  return {
    mp4Path: finalMp4,
    posterPath,
    previewMp4Path,
    checksumSha256: checksum,
    durationSec: probe.duration,
    width: probe.width,
    height: probe.height,
    hasAudio: probe.hasAudio,
    fileSizeBytes: size,
    renderMs,
    peakRssMb: peakRssMb(),
  };
}
