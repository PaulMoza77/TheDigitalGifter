/**
 * Production media cannot be a demo/fixture encode.
 *
 * A small file or a dark scene is not, by itself, proof of invalid media.
 * Reject only when the file cannot be a camera/editor original:
 * - known poisoned hashes
 * - no video stream / unreadable
 * - duration far from the declared source duration
 * - sampled frames that are solid-color (tiny JPEGs), not merely dark/textured night
 */

export const KNOWN_INVALID_MEDIA_HASHES = [
  // 12.6s 1280×720 ~174KB dark/uniform file stored against https://youtu.be/pV9UPP7n0Po
  "1035c4690f0871aab131142f8b39fb055b82eaea8fe38706519dcc377d0b2c33",
];

export type MediaQualityInput = {
  durationSeconds: number;
  width: number;
  height: number;
  fileSizeBytes: number;
  hasVideo?: boolean;
  hasAudio?: boolean;
  videoCodec?: string | null;
  expectedDurationSeconds?: number | null;
  jpegSampleBytes?: number[];
  mediaHash?: string | null;
};

export type MediaQualityFailure = {
  ok: false;
  code: "corrupt_file" | "very_short_video" | "low_resolution" | "duration_mismatch" | "synthetic_or_empty" | "uniform_frames";
  message: string;
};

export type MediaQualityOk = { ok: true };

const MIN_DURATION = 3;
const MIN_EDGE = 240;
const DURATION_TOLERANCE = 0.12;
const DURATION_ABS_SLACK = 2.5;
/** Solid-color ffmpeg JPEGs are a few KB; textured dark footage is typically 15–80KB. */
const UNIFORM_JPEG_MAX_BYTES = 9_000;

export function durationMatchesExpected(actual: number, expected: number | null | undefined): boolean {
  if (expected == null || !Number.isFinite(expected) || expected <= 0) return true;
  if (!Number.isFinite(actual) || actual <= 0) return false;
  const slack = Math.max(DURATION_ABS_SLACK, expected * DURATION_TOLERANCE);
  return Math.abs(actual - expected) <= slack;
}

export function isKnownInvalidMediaHash(hash: string | null | undefined): boolean {
  return Boolean(hash && KNOWN_INVALID_MEDIA_HASHES.includes(hash));
}

export function assessMediaQuality(input: MediaQualityInput): MediaQualityOk | MediaQualityFailure {
  if (isKnownInvalidMediaHash(input.mediaHash)) {
    return {
      ok: false,
      code: "synthetic_or_empty",
      message:
        "This stored file is a known invalid Clip Factory sample (12s dark/uniform encode), not the YouTube source. Upload the original video.",
    };
  }
  if (!input.hasVideo && input.hasVideo !== undefined) {
    return { ok: false, code: "corrupt_file", message: "This file has no video stream." };
  }
  if (!input.durationSeconds || input.durationSeconds < MIN_DURATION) {
    return {
      ok: false,
      code: "very_short_video",
      message: `Video is too short (${(input.durationSeconds || 0).toFixed(1)}s). Use a clip of at least 3 seconds.`,
    };
  }
  if (input.width < MIN_EDGE || input.height < MIN_EDGE) {
    return {
      ok: false,
      code: "low_resolution",
      message: `Resolution ${input.width}×${input.height} is too low for a good vertical crop.`,
    };
  }
  if (!durationMatchesExpected(input.durationSeconds, input.expectedDurationSeconds)) {
    return {
      ok: false,
      code: "duration_mismatch",
      message: `Imported file is ${input.durationSeconds.toFixed(1)}s but the source is ${Number(input.expectedDurationSeconds).toFixed(1)}s. The file is not the original video. Upload the original instead of using a preview or placeholder.`,
    };
  }
  const jpegs = input.jpegSampleBytes || [];
  if (jpegs.length >= 3 && jpegs.every((n) => n > 0 && n < UNIFORM_JPEG_MAX_BYTES)) {
    return {
      ok: false,
      code: "uniform_frames",
      message:
        "Sampled frames are solid-color/empty (not just dark). This file is a placeholder encode, not the original video.",
    };
  }
  return { ok: true };
}

export function candidateTextGrounded(input: {
  start: number;
  end: number;
  title: string;
  summary: string;
  hook: string;
  transcriptText: string;
  visualNotes: Array<{ t: number; note: string }>;
}): boolean {
  const windowNotes = input.visualNotes.filter((n) => n.t >= input.start - 0.5 && n.t <= input.end + 0.5);
  const notes = windowNotes.length ? windowNotes : input.visualNotes;
  const emptyVisual = notes.length
    ? notes.every((n) => /no visible|mostly dark|scene sample|solid|uniform|empty frame/i.test(n.note || ""))
    : false;
  const speech = String(input.transcriptText || "").trim();
  if (speech.length < 12 && emptyVisual) return false;
  if (speech.length < 12) return !emptyVisual;
  const blob = `${input.title} ${input.summary} ${input.hook}`.toLowerCase();
  const tokens = speech
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const unique = [...new Set(tokens)].slice(0, 80);
  const hits = unique.filter((w) => blob.includes(w)).length;
  if (unique.length >= 8 && hits < 1 && emptyVisual) return false;
  return true;
}
