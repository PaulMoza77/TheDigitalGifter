import { LIBRARY_VIDEOS, isLibraryPhoto } from "../../../src/features/admin-library/catalog";
import { contentTypeFromLibraryKind } from "../../../src/features/publisher/destinations";
import type { PublisherContentType, PublisherLibraryAsset } from "../../../src/features/publisher/types";
import { getServiceClient } from "../christmas/supabaseClient";

export function catalogContentType(kind: string, filename: string): PublisherContentType {
  return contentTypeFromLibraryKind(kind, filename);
}

export async function loadPublisherAssets(): Promise<PublisherLibraryAsset[]> {
  const service = getServiceClient();
  const [{ data: dbAssets }, { data: states }] = await Promise.all([
    service.from("library_assets").select("*").limit(500),
    service.from("publisher_asset_state").select("*"),
  ]);
  const stateById = new Map((states || []).map((row) => [String(row.library_asset_id), row]));

  const fromCatalog: PublisherLibraryAsset[] = LIBRARY_VIDEOS.map((video) => {
    const state = stateById.get(video.id);
    const contentType =
      (state?.content_type as PublisherContentType | undefined) || catalogContentType(video.kind, video.filename);
    return {
      id: video.id,
      title: video.title,
      src: video.src,
      filename: video.filename,
      kind: video.kind,
      category: video.category,
      tags: [...(video.tags || []), ...((state?.tags as string[]) || [])],
      poster: video.poster || null,
      durationSeconds: video.durationSeconds ?? null,
      width: video.width ?? null,
      height: video.height ?? null,
      exists: true,
      ready: true,
      processing: false,
      failed: false,
      excluded: Boolean(state?.excluded),
      eligible: state?.eligible !== false,
      contentType: isLibraryPhoto(video) ? "image" : contentType,
      lastUsedByDestination: (state?.last_used_by_destination as Record<string, string>) || {},
      publishStatus: "legacy",
      platformMetadata: {},
    };
  });

  const fromDb: PublisherLibraryAsset[] = (dbAssets || [])
    .filter((row) => !row.provenance?.invalid)
    .map((row) => {
      const state = stateById.get(String(row.id));
      const filename = String(row.filename || "asset");
      const kind = String(row.kind || "reel");
      return {
        id: String(row.id),
        title: String(row.title || "Library asset"),
        src: String(row.src || ""),
        filename,
        kind,
        category: String(row.category || "clip_factory"),
        tags: [...((row.publisher_tags as string[]) || []), ...((state?.tags as string[]) || [])],
        poster: row.poster_src || null,
        durationSeconds: row.duration_seconds ?? null,
        width: row.width ?? null,
        height: row.height ?? null,
        exists: Boolean(row.src || row.storage_path),
        ready: true,
        processing: false,
        failed: Boolean(row.provenance?.invalid),
        excluded: Boolean(row.publisher_excluded || state?.excluded),
        eligible: row.publisher_eligible !== false && state?.eligible !== false,
        contentType:
          (row.publisher_content_type as PublisherContentType | undefined) ||
          (state?.content_type as PublisherContentType | undefined) ||
          catalogContentType(kind, filename),
        lastUsedByDestination: (state?.last_used_by_destination as Record<string, string>) || {},
        publishStatus: String(row.publish_status || "legacy"),
        platformMetadata: (row.platform_metadata as Record<string, unknown>) || {},
      };
    });

  const merged = new Map<string, PublisherLibraryAsset>();
  for (const asset of [...fromCatalog, ...fromDb]) merged.set(asset.id, asset);
  return [...merged.values()];
}
