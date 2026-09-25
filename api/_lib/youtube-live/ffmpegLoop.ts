import type { ProbeInfo } from "../clip-factory/ffmpeg";

export function youtubeRtmpCopySafe(probe: ProbeInfo): boolean {
  const video = String(probe.videoCodec || "").toLowerCase();
  const audio = String(probe.audioCodec || "").toLowerCase();
  const h264 = video === "h264" || video === "avc1" || video.includes("h264");
  const aac = audio === "aac" || audio === "mp4a" || audio.includes("aac");
  return Boolean(h264 && aac && probe.hasAudio && probe.width > 0 && probe.height > 0);
}

export function assertLiveSourceProbe(probe: ProbeInfo, path: string): void {
  if (!probe.width || !probe.height) {
    throw Object.assign(new Error(`Source has no video track: ${path}`), { status: 400 });
  }
  if (!probe.hasAudio) {
    throw Object.assign(new Error(`Source has no audio track: ${path}`), { status: 400 });
  }
}

export function buildFfmpegLiveArgs(input: { sourcePath: string; ingestUrl: string; copy: boolean }): string[] {
  const common = ["-hide_banner", "-loglevel", "error", "-re", "-stream_loop", "-1", "-i", input.sourcePath];
  if (input.copy) {
    return [...common, "-c", "copy", "-f", "flv", input.ingestUrl];
  }
  return [
    ...common,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-tune",
    "zerolatency",
    "-pix_fmt",
    "yuv420p",
    "-b:v",
    "4500k",
    "-maxrate",
    "5000k",
    "-bufsize",
    "10000k",
    "-g",
    "60",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ar",
    "44100",
    "-ac",
    "2",
    "-f",
    "flv",
    input.ingestUrl,
  ];
}

export function ffmpegLiveSummary(args: string[]): string[] {
  if (!args.length) return args;
  return [...args.slice(0, -1), "[rtmp]"];
}
