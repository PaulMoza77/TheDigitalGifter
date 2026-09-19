import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

export function runCommand(bin: string, args: string[], timeoutMs = 180_000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${bin}_timeout`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
      if (stdout.length > 2_000_000) stdout = stdout.slice(-1_000_000);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
      if (stderr.length > 80_000) stderr = stderr.slice(-40_000);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${bin}_exit_${code}:${stderr.slice(-800)}`));
    });
  });
}

export type ProbeInfo = {
  duration: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  videoCodec: string | null;
  audioCodec: string | null;
  fileSize: number | null;
  orientation: "landscape" | "portrait" | "square";
};

export async function ffprobeFile(path: string): Promise<ProbeInfo> {
  const { stdout } = await runCommand("ffprobe", [
    "-v",
    "error",
    "-show_format",
    "-show_streams",
    "-print_format",
    "json",
    path,
  ]);
  const json = JSON.parse(stdout) as {
    format?: { duration?: string; size?: string };
    streams?: Array<Record<string, string>>;
  };
  const video = json.streams?.find((s) => s.codec_type === "video");
  const audio = json.streams?.find((s) => s.codec_type === "audio");
  const width = Number(video?.width || 0);
  const height = Number(video?.height || 0);
  const duration = Number(json.format?.duration || video?.duration || 0);
  const fpsRaw = String(video?.avg_frame_rate || video?.r_frame_rate || "0/1");
  const [n, d] = fpsRaw.split("/").map(Number);
  const fps = d ? n / d : Number(fpsRaw) || 0;
  const ratio = width / Math.max(1, height);
  return {
    duration,
    width,
    height,
    fps: Number(fps.toFixed(3)),
    hasAudio: Boolean(audio),
    videoCodec: video?.codec_name || null,
    audioCodec: audio?.codec_name || null,
    fileSize: json.format?.size ? Number(json.format.size) : null,
    orientation: ratio > 1.05 ? "landscape" : ratio < 0.95 ? "portrait" : "square",
  };
}

export async function extractAudioMp3(input: string, output: string): Promise<void> {
  await runCommand("ffmpeg", ["-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", output], 300_000);
}

export async function detectScenes(input: string): Promise<number[]> {
  try {
    const { stderr, stdout } = await runCommand(
      "ffmpeg",
      ["-i", input, "-filter:v", "select='gt(scene,0.32)',showinfo", "-an", "-f", "null", "-"],
      240_000,
    );
    const text = `${stdout}\n${stderr}`;
    const times: number[] = [];
    const re = /pts_time:(\d+\.?\d*)/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) {
      const t = Number(match[1]);
      if (Number.isFinite(t)) times.push(t);
    }
    return [...new Set(times.map((t) => Number(t.toFixed(3))))];
  } catch {
    return [];
  }
}

export async function extractJpeg(input: string, time: number, output: string): Promise<void> {
  await runCommand(
    "ffmpeg",
    ["-y", "-ss", String(Math.max(0, time)), "-i", input, "-frames:v", "1", "-vf", "scale=512:-2", "-q:v", "5", output],
    60_000,
  );
}

export function findCaptionFont(): string {
  const candidates = [
    process.env.CLIP_FACTORY_FONT,
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/ttf/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  ].filter(Boolean) as string[];
  return candidates.find((p) => existsSync(p)) || "DejaVu Sans";
}

export async function renderVerticalClip(input: {
  source: string;
  output: string;
  start: number;
  duration: number;
  filter: string;
  assPath?: string;
  hasAudio: boolean;
}): Promise<void> {
  const args = ["-y", "-ss", String(Math.max(0, input.start)), "-i", input.source, "-t", String(input.duration)];
  let vf = input.filter;
  if (input.assPath) {
    const fontsdir = findCaptionFont().replace(/\/[^/]+$/, "");
    const ass = input.assPath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
    vf = `${vf},subtitles='${ass}':fontsdir='${fontsdir.replace(/:/g, "\\:")}'`;
  }
  args.push("-vf", vf, "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30");
  if (input.hasAudio) {
    args.push("-c:a", "aac", "-b:a", "160k", "-ac", "2", "-ar", "48000", "-af", "aresample=async=1:first_pts=0");
  } else {
    args.push("-an");
  }
  args.push("-movflags", "+faststart", "-avoid_negative_ts", "make_zero", input.output);
  await runCommand("ffmpeg", args, 420_000);
}

export async function extractThumbnail(input: string, time: number, output: string): Promise<void> {
  await runCommand(
    "ffmpeg",
    ["-y", "-ss", String(Math.max(0.08, time)), "-i", input, "-frames:v", "1", "-q:v", "3", output],
    60_000,
  );
}
