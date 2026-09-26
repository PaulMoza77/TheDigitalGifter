import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runCommand } from "../clip-factory/ffmpeg";

function ffmpeg(args: string[]) {
  return runCommand("ffmpeg", args, 300_000);
}

export async function assembleSilentReel(input: {
  workDir: string;
  clipPaths: string[];
  outputPath: string;
}): Promise<void> {
  await mkdir(input.workDir, { recursive: true });
  const trimmed: string[] = [];
  for (let i = 0; i < input.clipPaths.length; i += 1) {
    const src = input.clipPaths[i];
    const part = join(input.workDir, `part_${i}.mp4`);
    await ffmpeg([
      "-y",
      "-i",
      src,
      "-ss",
      "0.08",
      "-t",
      "4.75",
      "-vf",
      "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "19",
      "-pix_fmt",
      "yuv420p",
      part,
    ]);
    trimmed.push(part);
  }
  const listPath = join(input.workDir, "concat.txt");
  await writeFile(listPath, trimmed.map((path) => `file '${path.replace(/'/g, "'\\''")}'`).join("\n"));
  await ffmpeg([
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "19",
    "-pix_fmt",
    "yuv420p",
    input.outputPath,
  ]);
}
