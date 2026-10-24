import { extname, resolve, sep } from "node:path";
import { signedPlaybackPath } from "./mediaSign";
import { mediaRoot } from "./vpsMedia";

export type LibraryAssetMedia = {
  id: string;
  storage_bucket?: string | null;
  storage_path?: string | null;
  thumbnail_path?: string | null;
  poster_src?: string | null;
  provenance?: { invalid?: boolean } | null;
};

export function libraryAssetPlayback(row: LibraryAssetMedia) {
  return {
    src: signedPlaybackPath("asset", row.id),
    poster: row.thumbnail_path
      ? signedPlaybackPath("asset-thumb", row.id)
      : row.poster_src?.startsWith("/assets/") ? row.poster_src : undefined,
  };
}

export function libraryAssetLocation(row: LibraryAssetMedia, thumbnail = false) {
  const path = thumbnail ? row.thumbnail_path : row.storage_path;
  if (row.provenance?.invalid || !path || !row.storage_bucket) return null;
  const types: Record<string, string> = {
    ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".webp": "image/webp", ".gif": "image/gif", ".avif": "image/avif",
  };
  const contentType = types[extname(path).toLowerCase()];
  if (!contentType) return null;
  return {
    path,
    bucket: row.storage_bucket,
    contentType,
    root: path.startsWith("productions/")
      ? process.env.LONG_FORM_DATA_DIR || "/data/long-form"
      : mediaRoot(),
  };
}

export function resolveLibraryAssetPath(path: string, root: string): string {
  if (!root || !path || path.startsWith("/") || path.includes("\\") || path.includes("\0") ||
      path.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("unsafe library media path");
  }
  const base = resolve(root);
  const absolute = resolve(base, path);
  if (!absolute.startsWith(`${base}${sep}`)) throw new Error("unsafe library media path");
  return absolute;
}
