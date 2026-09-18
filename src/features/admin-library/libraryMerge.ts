import { LIBRARY_VIDEOS, searchLibraryVideos, type LibraryKind, type LibraryVideo } from "./catalog";

export type GeneratedLibraryItem = LibraryVideo & {
  source: "generated";
  jobId?: string;
  modelKey?: string;
  prompt?: string;
};

export function mergeLibraryVideos(generated: LibraryVideo[] = []): LibraryVideo[] {
  const seen = new Set(LIBRARY_VIDEOS.map((item) => item.id));
  const extra: LibraryVideo[] = [];
  for (const item of generated) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    extra.push(item);
  }
  return [...extra, ...LIBRARY_VIDEOS];
}

export function searchMergedLibrary(
  query: string,
  categoryId: Parameters<typeof searchLibraryVideos>[1],
  kind: LibraryKind | "all",
  generated: LibraryVideo[] = [],
): LibraryVideo[] {
  const merged = mergeLibraryVideos(generated);
  const needle = query.trim().toLowerCase();
  let list = categoryId === "all" ? merged : merged.filter((item) => item.category === categoryId);
  if (kind !== "all") list = list.filter((item) => item.kind === kind);
  if (!needle) return list;
  return list.filter((video) =>
    [video.title, video.description, video.filename, video.id].join(" ").toLowerCase().includes(needle),
  );
}

export function libraryPhotos(): LibraryVideo[] {
  return LIBRARY_VIDEOS.filter((item) => item.kind === "photo");
}

export function findLibraryPhoto(idOrFilename: string): LibraryVideo | null {
  const needle = idOrFilename.trim().toLowerCase();
  if (!needle) return null;
  return (
    LIBRARY_VIDEOS.find(
      (item) =>
        item.kind === "photo" &&
        (item.id.toLowerCase() === needle ||
          item.filename.toLowerCase() === needle ||
          item.src.toLowerCase().endsWith(`/${needle}`)),
    ) ?? null
  );
}
