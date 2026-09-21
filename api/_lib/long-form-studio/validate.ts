import { sampleJpegSizes } from "../clip-factory/validateMedia";
import { ffprobeFile, type ProbeInfo } from "../clip-factory/ffmpeg";

export class LongFormRenderError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function assertLongFormOutput(input: {
  path: string;
  expectedDuration: number;
  minWidth?: number;
  minHeight?: number;
}): Promise<ProbeInfo> {
  let probe: ProbeInfo;
  try {
    probe = await ffprobeFile(input.path);
  } catch {
    throw new LongFormRenderError("invalid_video", "The finished video could not be read.");
  }
  const minW = input.minWidth ?? 1920;
  const minH = input.minHeight ?? 1080;
  if (!probe.videoCodec) {
    throw new LongFormRenderError("invalid_video", "The finished file has no picture stream.");
  }
  if (!probe.hasAudio || !probe.audioCodec) {
    throw new LongFormRenderError("invalid_audio", "The finished file has no soundtrack.");
  }
  if (probe.width < minW || probe.height < minH) {
    throw new LongFormRenderError(
      "resolution",
      `Expected at least ${minW}×${minH}, got ${probe.width}×${probe.height}.`,
    );
  }
  if (Math.abs(probe.duration - input.expectedDuration) > 2.5) {
    throw new LongFormRenderError(
      "duration",
      `Expected about ${input.expectedDuration}s, got ${probe.duration.toFixed(2)}s.`,
    );
  }
  const frames = await sampleJpegSizes(input.path, probe.duration, 4);
  if (frames.length >= 3 && frames.every((n) => n > 0 && n < 9000)) {
    throw new LongFormRenderError("corrupt", "Picture frames look empty or corrupted.");
  }
  const audioEndSlack = Math.abs(probe.duration - input.expectedDuration);
  if (audioEndSlack > 2.5) {
    throw new LongFormRenderError("sync", "Picture and soundtrack lengths do not match.");
  }
  return probe;
}
