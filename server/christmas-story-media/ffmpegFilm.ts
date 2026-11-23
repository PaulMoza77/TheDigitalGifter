/**
 * Deterministic FFmpeg memory-film renderer (Mission 02D / 02E).
 * Secure argv-only spawn. No URL ingestion. No shell interpolation.
 * Typography plates via Pillow. warm_cinematic_v2 adds crossfades + Christmas grade.
 */
import { mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
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
const DEFAULT_SEC_PER_PHOTO = 3.6;
const TITLE_SEC_V1 = 2.4;
const END_SEC_V1 = 3.2;
const TITLE_SEC_V2 = 3.4;
const END_SEC_V2 = 4.6;
const XFADE_SEC = 0.7;
const RENDER_TIMEOUT_MS = 240_000;

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

const CHRISTMAS_GRADE =
  "eq=contrast=1.06:brightness=0.015:saturation=1.12," +
  "colorbalance=rs=0.05:gs=-0.02:bs=-0.06:rm=0.03:bm=-0.05," +
  "vignette=PI/5";

async function plateToClip(
  platePng: string,
  outMp4: string,
  seconds: number,
  fps: number,
  w: number,
  h: number,
  graded: boolean,
) {
  const vf = graded
    ? `scale=${w}:${h},fps=${fps},${CHRISTMAS_GRADE},format=yuv420p`
    : `scale=${w}:${h},fps=${fps},format=yuv420p`;
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
      vf,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "medium",
      "-crf",
      "18",
      "-an",
      outMp4,
    ],
    RENDER_TIMEOUT_MS,
  );
}

async function concatHardCuts(clipPaths: string[], listFile: string, silentMp4: string) {
  writeFileSync(
    listFile,
    clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n") + "\n",
    "utf8",
  );
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
      "medium",
      "-crf",
      "18",
      "-movflags",
      "+faststart",
      "-an",
      silentMp4,
    ],
    RENDER_TIMEOUT_MS,
  );
}

/** Soft crossfade chain for premium pacing (v2). */
async function concatWithXfade(
  clipPaths: string[],
  clipDurations: number[],
  silentMp4: string,
  work: string,
  fps: number,
) {
  if (clipPaths.length === 1) {
    await runCommand(
      "ffmpeg",
      ["-y", "-i", clipPaths[0]!, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "18", "-movflags", "+faststart", "-an", silentMp4],
      RENDER_TIMEOUT_MS,
    );
    return;
  }

  const inputs: string[] = [];
  for (const p of clipPaths) {
    inputs.push("-i", p);
  }

  const xfade = Math.min(XFADE_SEC, Math.min(...clipDurations) * 0.35);
  let filter = "";
  let offset = clipDurations[0]! - xfade;
  let lastLabel = "[0:v]";
  for (let i = 1; i < clipPaths.length; i++) {
    const out = i === clipPaths.length - 1 ? "[vout]" : `[v${i}]`;
    filter += `${lastLabel}[${i}:v]xfade=transition=fade:duration=${xfade.toFixed(3)}:offset=${offset.toFixed(3)}${out};`;
    lastLabel = out;
    if (i < clipPaths.length - 1) {
      offset += clipDurations[i]! - xfade;
    }
  }
  filter += `[vout]fps=${fps},format=yuv420p[vfinal]`;

  const args = [
    "-y",
    ...inputs,
    "-filter_complex",
    filter,
    "-map",
    "[vfinal]",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-movflags",
    "+faststart",
    "-an",
    silentMp4,
  ];
  // Write filter for debugging without shell interpolation of media paths
  writeFileSync(join(work, "xfade.filter.txt"), filter, "utf8");
  await runCommand("ffmpeg", args, RENDER_TIMEOUT_MS);
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

  const template = input.template || "warm_cinematic_v1";
  const v2 = template === "warm_cinematic_v2";
  const { w, h } = dims(input.aspect || "landscape");
  const fps = Math.min(30, Math.max(24, input.fps || DEFAULT_FPS));
  const defaultSec = v2 ? 4.0 : DEFAULT_SEC_PER_PHOTO;
  const secPer = Math.min(5.5, Math.max(2.5, input.secondsPerPhoto || defaultSec));
  const framesPer = Math.round(secPer * fps);
  const titleSec = v2 ? TITLE_SEC_V2 : TITLE_SEC_V1;
  const endSec = v2 ? END_SEC_V2 : END_SEC_V1;

  const work = join(outDir, safeJobFileName(input.jobId, "work"));
  mkdirSync(work, { recursive: true });

  const clipPaths: string[] = [];
  const clipDurations: number[] = [];
  const recipient = String(input.recipientName || "you").slice(0, 48);
  const dedication = String(input.dedication || "With love").slice(0, 140);

  // Title plate — warmer, layered copy for v2
  const titlePng = join(work, "title.png");
  renderTextPlate({
    outPath: titlePng,
    width: w,
    height: h,
    background: v2 ? "#120c09" : "#1a120e",
    lines: v2
      ? [
          { text: "Our Christmas Story", size: Math.round(w * 0.026), color: "#c9a66b", yRatio: 0.38 },
          { text: `For ${recipient}`, size: Math.round(w * 0.062), color: "#f7ead7", yRatio: 0.5 },
          { text: "a gift made from memory", size: Math.round(w * 0.022), color: "#b9a48a", yRatio: 0.62 },
        ]
      : [
          { text: `For ${recipient}`, size: Math.round(w * 0.05), color: "#f5e6d3", yRatio: 0.46 },
          { text: "Our Christmas Story", size: Math.round(w * 0.028), color: "#d4b896", yRatio: 0.56 },
        ],
  });
  const titlePath = join(work, "title.mp4");
  await plateToClip(titlePng, titlePath, titleSec, fps, w, h, v2);
  clipPaths.push(titlePath);
  clipDurations.push(titleSec);

  // Photo clips with restrained zoompan (+ Christmas grade for v2)
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]!;
    const clip = join(work, `clip_${String(i).padStart(2, "0")}.mp4`);
    const caption = String(input.captions?.[i] || "").slice(0, 80);
    const zoomSpeed = v2 ? 0.0007 : 0.0009;
    const vfParts = [
      `scale=${w * 2}:${h * 2}:force_original_aspect_ratio=increase`,
      `crop=${w * 2}:${h * 2}`,
      "setsar=1",
      `zoompan=z='min(1.0+${zoomSpeed}*on,1.10)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${w}x${h}:fps=${fps}`,
    ];
    if (v2) vfParts.push(CHRISTMAS_GRADE);
    vfParts.push("format=yuv420p");

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
        "medium",
        "-crf",
        "18",
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
        height: Math.max(90, Math.round(h * 0.14)),
        background: "#000000",
        lines: [{ text: caption, size: Math.round(w * 0.028), color: "#f5e6d3", yRatio: 0.5 }],
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
          `[1:v]format=rgba,colorchannelmixer=aa=0.62[c];[0:v][c]overlay=0:H-h-20`,
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          "-preset",
          "medium",
          "-crf",
          "18",
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
    clipDurations.push(secPer);
  }

  // Ending dedication plate
  const endPng = join(work, "end.png");
  renderTextPlate({
    outPath: endPng,
    width: w,
    height: h,
    background: v2 ? "#0e0a08" : "#140e0a",
    lines: v2
      ? [
          { text: dedication, size: Math.round(w * 0.034), color: "#f7ead7", yRatio: 0.46 },
          { text: "Merry Christmas", size: Math.round(w * 0.024), color: "#c9a66b", yRatio: 0.6 },
        ]
      : [{ text: dedication, size: Math.round(w * 0.032), color: "#f5e6d3", yRatio: 0.5 }],
  });
  const endPath = join(work, "end.mp4");
  await plateToClip(endPng, endPath, endSec, fps, w, h, v2);
  clipPaths.push(endPath);
  clipDurations.push(endSec);

  const silentMp4 = join(work, "silent.mp4");
  if (v2 && clipPaths.length >= 2) {
    await concatWithXfade(clipPaths, clipDurations, silentMp4, work, fps);
  } else {
    await concatHardCuts(clipPaths, join(work, "concat.txt"), silentMp4);
  }

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
      [
        "-y",
        "-i",
        silentMp4,
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-movflags",
        "+faststart",
        "-an",
        finalMp4,
      ],
      RENDER_TIMEOUT_MS,
    );
  }

  const size = statSync(finalMp4).size;
  if (size <= 0 || size > MAX_OUTPUT_BYTES) {
    throw new Error("output_size_invalid");
  }

  const posterPath = join(outDir, safeJobFileName(input.jobId, "poster.jpg"));
  // Poster from a mid photo beat when possible (not title plate)
  const posterSs = Math.min(titleSec + secPer * 0.45, Math.max(1.2, size > 0 ? titleSec + 1.2 : 0.8));
  await runCommand(
    "ffmpeg",
    ["-y", "-ss", String(posterSs), "-i", finalMp4, "-frames:v", "1", "-q:v", "2", posterPath],
    60_000,
  );

  const previewMp4Path = join(outDir, safeJobFileName(input.jobId, "preview.mp4"));
  const previewArgs = [
    "-y",
    "-i",
    finalMp4,
    "-t",
    "12",
    "-vf",
    `scale=${Math.round(w / 2)}:${Math.round(h / 2)}`,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "veryfast",
    "-crf",
    "26",
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
  if (probe.pixFmt && !/^yuvj?420p$/.test(probe.pixFmt)) throw new Error(`output_pix_fmt_invalid:${probe.pixFmt}`);
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
