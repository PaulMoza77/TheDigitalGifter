import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { runCommand } from "../clip-factory/ffmpeg";

/** Subtle loop-friendly motion from a still. No provider jargon in caller UI. */
export async function animateStillToAmbience(input: {
  imagePath: string;
  outputPath: string;
  seconds?: number;
  style?: string;
}): Promise<void> {
  const seconds = Math.max(12, Math.min(24, input.seconds ?? 16));
  const frames = seconds * 24;
  const zoom = input.style === "snowy" ? 0.00055 : 0.00038;
  await mkdir(dirname(input.outputPath), { recursive: true });
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-loop",
      "1",
      "-i",
      input.imagePath,
      "-t",
      String(seconds),
      "-vf",
      `scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='min(zoom+${zoom},1.1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1920x1080:fps=24,format=yuv420p`,
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      input.outputPath,
    ],
    180_000,
  );
}

export async function writeAnimatePromptNote(dir: string, sceneTitle: string): Promise<void> {
  await writeFile(
    join(dir, "animate-intent.txt"),
    `Subtle realistic ambience for “${sceneTitle}”: fireplace movement, falling snow, tree lights, slow camera, steam, snow outside a window. Avoid aggressive AI motion. Loop-friendly.`,
    "utf8",
  );
}
