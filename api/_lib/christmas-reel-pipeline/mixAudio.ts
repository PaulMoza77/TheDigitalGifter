import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import { ffprobeFile, runCommand } from "../clip-factory/ffmpeg";

export async function mixReelWithMusic(input: {
  videoPath: string;
  musicPath: string;
  outputPath: string;
  videoDurationSeconds: number;
}): Promise<void> {
  await mkdir(dirname(input.outputPath), { recursive: true });
  const probe = await ffprobeFile(input.videoPath);
  const duration = Math.min(input.videoDurationSeconds || probe.duration, probe.duration);
  const hasSpeech = probe.hasAudio;
  const fadeIn = 1.2;
  const fadeOut = 2.0;
  const fadeOutStart = Math.max(0, duration - fadeOut);

  const musicChain = `[1:a]afade=t=in:st=0:d=${fadeIn},afade=t=out:st=${fadeOutStart}:d=${fadeOut},atrim=0:${duration},asetpts=PTS-STARTPTS`;
  const filterComplex = hasSpeech
    ? `${musicChain},volume=0.22[music];[0:a][music]sidechaincompress=threshold=0.08:ratio=8:attack=20:release=400[aout]`
    : `${musicChain},volume=0.85[aout]`;

  const args = [
    "-y",
    "-i",
    input.videoPath,
    "-i",
    input.musicPath,
    "-filter_complex",
    filterComplex,
    "-map",
    "0:v:0",
    "-map",
    "[aout]",
    "-t",
    String(duration),
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    input.outputPath,
  ];

  try {
    await runCommand("ffmpeg", args, 300_000);
  } catch (error) {
    if (!hasSpeech) throw error;
    await runCommand(
      "ffmpeg",
      [
        "-y",
        "-i",
        input.videoPath,
        "-i",
        input.musicPath,
        "-filter_complex",
        `[1:a]volume=0.2,afade=t=in:st=0:d=${fadeIn},afade=t=out:st=${fadeOutStart}:d=${fadeOut},atrim=0:${duration}[ma];[0:a][ma]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
        "-map",
        "0:v:0",
        "-map",
        "[aout]",
        "-t",
        String(duration),
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        input.outputPath,
      ],
      300_000,
    );
  }

  if (!existsSync(input.outputPath)) {
    throw new Error("ffmpeg_output_missing");
  }
}
