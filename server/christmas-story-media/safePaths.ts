import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, extname, isAbsolute, resolve, sep } from "node:path";

export const MAX_PHOTOS = 8;
export const MIN_PHOTOS = 2;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 40 * 1024 * 1024;
export const MAX_OUTPUT_BYTES = 80 * 1024 * 1024;
export const ALLOWED_IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
export const ALLOWED_AUDIO_EXT = new Set([".mp3", ".wav", ".m4a", ".aac"]);

const JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const WEBP_RIFF = Buffer.from("RIFF");
const WEBP_WEBP = Buffer.from("WEBP");
const ID3 = Buffer.from("ID3");
const MP3_FF = 0xff;
const WAV = Buffer.from("RIFF");

export function assertNoUrl(input: string) {
  const s = String(input || "").trim().toLowerCase();
  if (/^https?:\/\//.test(s) || s.startsWith("file:") || s.startsWith("ftp:")) {
    throw new Error("url_inputs_forbidden");
  }
}

export function resolveUnderRoot(root: string, maybeRelative: string): string {
  assertNoUrl(maybeRelative);
  const rootAbs = resolve(root);
  const candidate = isAbsolute(maybeRelative)
    ? resolve(maybeRelative)
    : resolve(rootAbs, maybeRelative);
  const prefix = rootAbs.endsWith(sep) ? rootAbs : rootAbs + sep;
  if (candidate !== rootAbs && !candidate.startsWith(prefix)) {
    throw new Error("path_escape_forbidden");
  }
  return candidate;
}

export function detectImageKind(buf: Buffer): "jpeg" | "png" | "webp" | null {
  if (buf.length >= 3 && buf.subarray(0, 3).equals(JPEG)) return "jpeg";
  if (buf.length >= 4 && buf.subarray(0, 4).equals(PNG)) return "png";
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).equals(WEBP_RIFF) &&
    buf.subarray(8, 12).equals(WEBP_WEBP)
  ) {
    return "webp";
  }
  return null;
}

export function detectAudioKind(buf: Buffer): "mp3" | "wav" | "m4a" | null {
  if (buf.length >= 3 && buf.subarray(0, 3).equals(ID3)) return "mp3";
  if (buf.length >= 2 && buf[0] === MP3_FF && (buf[1] & 0xe0) === 0xe0) return "mp3";
  if (buf.length >= 12 && buf.subarray(0, 4).equals(WAV) && buf.subarray(8, 12).toString() === "WAVE") {
    return "wav";
  }
  // ftyp.... for m4a/mp4
  if (buf.length >= 8 && buf.subarray(4, 8).toString() === "ftyp") return "m4a";
  return null;
}

export function validatePhotoFile(absPath: string): { bytes: number; kind: string } {
  assertNoUrl(absPath);
  if (!existsSync(absPath)) throw new Error("photo_missing");
  const st = statSync(absPath);
  if (!st.isFile()) throw new Error("photo_not_file");
  if (st.size <= 0 || st.size > MAX_PHOTO_BYTES) throw new Error("photo_size_invalid");
  const ext = extname(absPath).toLowerCase();
  if (!ALLOWED_IMAGE_EXT.has(ext)) throw new Error("photo_ext_invalid");
  const head = readFileSync(absPath).subarray(0, 16);
  const kind = detectImageKind(head);
  if (!kind) throw new Error("photo_magic_invalid");
  // Corrupt / truncated PNG/JPEG: require minimum payload
  if (st.size < 64) throw new Error("photo_corrupt_small");
  return { bytes: st.size, kind };
}

export function validateAudioFile(absPath: string): { bytes: number; kind: string } {
  assertNoUrl(absPath);
  if (!existsSync(absPath)) throw new Error("audio_missing");
  const st = statSync(absPath);
  if (!st.isFile()) throw new Error("audio_not_file");
  if (st.size <= 0 || st.size > MAX_AUDIO_BYTES) throw new Error("audio_size_invalid");
  const ext = extname(absPath).toLowerCase();
  if (!ALLOWED_AUDIO_EXT.has(ext)) throw new Error("audio_ext_invalid");
  const head = readFileSync(absPath).subarray(0, 16);
  const kind = detectAudioKind(head);
  if (!kind) throw new Error("audio_magic_invalid");
  return { bytes: st.size, kind };
}

export function validatePhotoList(paths: string[], workspaceRoot: string): string[] {
  if (paths.length < MIN_PHOTOS || paths.length > MAX_PHOTOS) {
    throw new Error("photo_count_invalid");
  }
  const resolved: string[] = [];
  for (const p of paths) {
    const abs = resolveUnderRoot(workspaceRoot, p);
    validatePhotoFile(abs);
    resolved.push(abs);
  }
  return resolved;
}

export function sha256File(absPath: string): string {
  const hash = createHash("sha256");
  hash.update(readFileSync(absPath));
  return hash.digest("hex");
}

export function safeJobFileName(jobId: string, suffix: string): string {
  const id = String(jobId || "job").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "job";
  const cleanSuffix = basename(suffix).replace(/[^a-zA-Z0-9._-]/g, "");
  return `${id}-${cleanSuffix}`;
}

export function escapeDrawtext(text: string, max = 120): string {
  return String(text || "")
    .slice(0, max)
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%")
    .replace(/\n/g, " ");
}
