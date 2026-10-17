import type { LibraryCategoryId, LibraryKind } from "./catalog";

const KNOWN_CATEGORIES = new Set<LibraryCategoryId>([
  "clip_factory",
  "long_form",
  "christmas_reels",
  "christmas_marketing",
  "pet_dog",
  "pet_cat",
  "pet_other",
  "volocar_dubai_moments",
  "volocar_product_motion",
  "flavours_bistro",
]);

/** Map DB / Higgsfield category labels onto Admin Library chips. */
export function mapLibraryAssetCategory(
  category: string | null | undefined,
  filename = "",
  title = "",
): LibraryCategoryId {
  const raw = String(category || "").trim().toLowerCase();
  if (KNOWN_CATEGORIES.has(raw as LibraryCategoryId)) return raw as LibraryCategoryId;
  if (raw === "volocar_home") return "volocar_product_motion";
  if (raw === "volocar") {
    const hay = `${filename} ${title}`.toLowerCase();
    if (/monthly|airport|supercars|zero.?deposit|product|home|no.?deposit|explore/.test(hay)) {
      return "volocar_product_motion";
    }
    return "volocar_dubai_moments";
  }
  return "clip_factory";
}

/** Normalize DB kinds (`video`, etc.) to Library filter kinds. */
export function mapLibraryAssetKind(
  kind: string | null | undefined,
  filename = "",
  durationSeconds?: number | null,
): LibraryKind {
  const raw = String(kind || "").trim().toLowerCase();
  if (raw === "reel" || raw === "short" || raw === "photo" || raw === "long_form") return raw;
  if (/\.(jpe?g|png|webp)$/i.test(filename) || raw === "image" || raw === "still") return "photo";
  if (raw === "long-form" || raw === "longform" || raw === "ambiance" || raw === "ambience") return "long_form";
  if (raw === "video" || raw === "clip" || raw === "mp4" || !raw) {
    if (durationSeconds != null && Number.isFinite(durationSeconds) && durationSeconds > 0 && durationSeconds <= 8) {
      return "short";
    }
    return "reel";
  }
  return "reel";
}

/** Prefer an already-playable src; otherwise fall back to a signed Clip Factory render path. */
export function resolveLibraryAssetSrc(input: {
  src?: string | null;
  fallbackSignedSrc: string;
}): string {
  const existing = String(input.src || "").trim();
  if (!existing) return input.fallbackSignedSrc;
  if (existing.startsWith("/") || /^https?:\/\//i.test(existing)) return existing;
  return input.fallbackSignedSrc;
}
