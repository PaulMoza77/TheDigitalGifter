import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { extractThumbnail, runCommand } from "../clip-factory/ffmpeg";
import { animateStillToAmbience } from "./animate";
import { ensureOriginalMusicFile, isOriginalMusicFilename } from "./originalMusic";
import { assertLongFormOutput } from "./validate";
import type { MusicTrack, PlaylistEntry, StylePreset } from "../../../src/features/long-form-studio/types";

export type SceneInput = {
  id: string;
  title: string;
  src: string;
  kind: string;
  filename: string;
};

export type RenderProgress = (stage: string, progress: number, label: string) => Promise<void> | void;

function publicPath(src: string, root: string): string {
  const clean = src.split("?")[0] || src;
  if (clean.startsWith("/")) return resolve(root, "public", clean.slice(1));
  return resolve(root, clean);
}

function landscapeVf(variant: number): string {
  const bright = [-0.02, 0.0, 0.025, 0.01][variant % 4];
  const sat = [1.02, 1.08, 0.98, 1.05][variant % 4];
  const y = ["(ih-oh)/2", "(ih-oh)/2-40", "(ih-oh)/2+36", "(ih-oh)/2-18"][variant % 4];
  return `scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080:0:${y},eq=brightness=${bright}:saturation=${sat},fps=24,format=yuv420p`;
}

async function encodeSegment(source: string, dest: string, seconds: number, variant: number, isImage: boolean) {
  if (isImage) {
    await animateStillToAmbience({ imagePath: source, outputPath: dest, seconds, style: variant % 2 ? "snowy" : "cozy" });
    return;
  }
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-stream_loop",
      "8",
      "-i",
      source,
      "-t",
      String(seconds),
      "-vf",
      landscapeVf(variant),
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "19",
      "-pix_fmt",
      "yuv420p",
      dest,
    ],
    180_000,
  );
}

async function xfadeConcat(clips: string[], dest: string): Promise<number> {
  if (clips.length === 1) {
    await runCommand("ffmpeg", ["-y", "-i", clips[0]!, "-c", "copy", dest], 60_000);
    return 16;
  }
  const durationEach = 16;
  const fade = 1.4;
  const inputs: string[] = [];
  for (const clip of clips) inputs.push("-i", clip);
  let filter = "";
  let last = "0:v";
  let offset = durationEach - fade;
  for (let i = 1; i < clips.length; i += 1) {
    const out = i === clips.length - 1 ? "vout" : `v${i}`;
    filter += `[${last}][${i}:v]xfade=transition=fade:duration=${fade}:offset=${offset.toFixed(3)}[${out}];`;
    last = out;
    offset += durationEach - fade;
  }
  filter = filter.replace(/;$/, "");
  await runCommand(
    "ffmpeg",
    ["-y", ...inputs, "-filter_complex", filter, "-map", "[vout]", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p", dest],
    300_000,
  );
  return offset + fade;
}

async function loopVideoToDuration(master: string, dest: string, targetSeconds: number) {
  try {
    await runCommand(
      "ffmpeg",
      ["-y", "-stream_loop", "-1", "-i", master, "-t", String(targetSeconds), "-c", "copy", dest],
      180_000,
    );
  } catch {
    const list = `${dest}.concat.txt`;
    const copies = Math.max(2, Math.ceil(targetSeconds / 20) + 1);
    const escaped = master.replace(/'/g, "'\\''");
    await writeFile(list, `${Array.from({ length: Math.min(copies, 80) }, () => `file '${escaped}'`).join("\n")}\n`, "utf8");
    await runCommand(
      "ffmpeg",
      ["-y", "-f", "concat", "-safe", "0", "-i", list, "-t", String(targetSeconds), "-c", "copy", dest],
      180_000,
    );
  }
}

function trackFile(track: MusicTrack, root: string): string {
  const candidates: string[] = [];
  if (track.filename) {
    candidates.push(join("/tmp/tdg-long-form/music", track.filename));
    candidates.push(join(root, "public/assets/long-form/music", track.filename));
  }
  if (track.publicSrc) candidates.push(publicPath(track.publicSrc, root));
  const found = candidates.find((path) => existsSync(path));
  if (found) return found;
  throw new Error(`No audio file for track ${track.id}`);
}

async function mixSoundtrack(input: {
  tracksById: Map<string, MusicTrack>;
  entries: PlaylistEntry[];
  dest: string;
  root: string;
  targetSeconds: number;
}) {
  const files: string[] = [];
  for (const entry of input.entries) {
    const track = input.tracksById.get(entry.trackId);
    if (!track) throw new Error(`Missing track ${entry.trackId}`);
    if (track.filename && isOriginalMusicFilename(track.filename)) {
      files.push(await ensureOriginalMusicFile(track.filename, input.root));
      continue;
    }
    files.push(trackFile(track, input.root));
  }
  const uniqueFiles = [...new Set(files)];
  const fadeOutAt = Math.max(1, input.targetSeconds - 3);
  if (uniqueFiles.length === 1) {
    await runCommand(
      "ffmpeg",
      [
        "-y",
        "-stream_loop",
        "-1",
        "-i",
        uniqueFiles[0]!,
        "-t",
        String(input.targetSeconds),
        "-af",
        `dynaudnorm=f=150:g=12,afade=t=in:st=0:d=2,afade=t=out:st=${fadeOutAt}:d=3`,
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-ac",
        "2",
        "-ar",
        "48000",
        input.dest,
      ],
      600_000,
    );
    return;
  }
  const args: string[] = ["-y"];
  for (const file of files) args.push("-i", file);
  let filter = "";
  let last = "0:a";
  for (let i = 1; i < files.length; i += 1) {
    const label = `a${i}`;
    filter += `[${last}][${i}:a]acrossfade=d=3:c1=tri:c2=tri[${label}];`;
    last = label;
  }
  filter += `[${last}]dynaudnorm=f=150:g=12,atrim=0:${input.targetSeconds},afade=t=in:st=0:d=1.5,afade=t=out:st=${fadeOutAt}:d=3[aout]`;
  args.push("-filter_complex", filter, "-map", "[aout]", "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", "48000", input.dest);
  await runCommand("ffmpeg", args, 900_000);
}

export function visualTreatmentId(style: StylePreset, sceneIds: string[]): string {
  return `${style}:${sceneIds.join(">")}:xfade+light+crop`;
}

export async function renderLongFormVideo(input: {
  workDir: string;
  root?: string;
  scenes: SceneInput[];
  tracks: MusicTrack[];
  playlist: PlaylistEntry[];
  durationSeconds: number;
  style: StylePreset;
  onProgress?: RenderProgress;
}): Promise<{
  outputPath: string;
  thumbnailPath: string;
  probe: Awaited<ReturnType<typeof assertLongFormOutput>>;
  masterSeconds: number;
}> {
  const root = input.root ?? process.cwd();
  const dir = input.workDir;
  await mkdir(dir, { recursive: true });
  const report = async (stage: string, progress: number, label: string) => {
    await input.onProgress?.(stage, progress, label);
  };

  await report("preparing_scene", 8, "Preparing scene");
  const segments: string[] = [];
  let variant = 0;
  const sceneList = input.scenes.length ? input.scenes : [];
  if (!sceneList.length) throw new Error("Choose a scene from the Library first.");
  for (const scene of sceneList) {
    const source = publicPath(scene.src, root);
    if (!existsSync(source)) throw new Error(`Scene file missing: ${scene.title}`);
    const isImage = scene.kind === "photo" || /\.(jpe?g|png|webp)$/i.test(scene.filename);
    for (let copy = 0; copy < 2; copy += 1) {
      const dest = join(dir, `seg-${variant}.mp4`);
      await encodeSegment(source, dest, 16, variant, isImage);
      segments.push(dest);
      variant += 1;
    }
  }
  if (segments.length < 3 && sceneList[0]) {
    const extra = join(dir, "seg-extra.mp4");
    const first = sceneList[0];
    const isImage = first.kind === "photo" || /\.(jpe?g|png|webp)$/i.test(first.filename);
    await encodeSegment(publicPath(first.src, root), extra, 16, 3, isImage);
    segments.push(extra);
  }

  await report("creating_ambience", 28, "Creating ambience");
  const master = join(dir, "ambience-master.mp4");
  const masterSeconds = await xfadeConcat(segments, master);

  await report("building_soundtrack", 46, "Building soundtrack");
  const byId = new Map(input.tracks.map((t) => [t.id, t]));
  const audio = join(dir, "soundtrack.m4a");
  await mixSoundtrack({
    tracksById: byId,
    entries: input.playlist,
    dest: audio,
    root,
    targetSeconds: input.durationSeconds,
  });

  await report("rendering", 68, "Rendering");
  const looped = join(dir, "picture-loop.mp4");
  await loopVideoToDuration(master, looped, input.durationSeconds);
  const output = join(dir, "final.mp4");
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-i",
      looped,
      "-i",
      audio,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-shortest",
      "-t",
      String(input.durationSeconds),
      "-movflags",
      "+faststart",
      output,
    ],
    600_000,
  );

  await report("final_checks", 88, "Final checks");
  const probe = await assertLongFormOutput({ path: output, expectedDuration: input.durationSeconds });
  const thumbnailPath = join(dir, "thumb.jpg");
  await extractThumbnail(output, Math.min(8, probe.duration / 5), thumbnailPath);
  return { outputPath: output, thumbnailPath, probe, masterSeconds };
}

export function ensureParent(path: string) {
  return mkdir(dirname(path), { recursive: true });
}
