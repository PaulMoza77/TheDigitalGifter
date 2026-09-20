import { directMediaAdapter } from "./adapters/directMedia";
import { tiktokAdapter } from "./adapters/restricted";
import { vimeoAdapter } from "./adapters/vimeo";
import { youtubeAdapter } from "./adapters/youtube";
import type { VideoSourceAdapter } from "./types";

/** Provider adapters only. Clip Factory talks to this registry, not hostnames. */
export const URL_SOURCE_ADAPTERS: VideoSourceAdapter[] = [
  youtubeAdapter,
  vimeoAdapter,
  tiktokAdapter,
  directMediaAdapter,
];

export function detectUrlAdapter(raw: string): VideoSourceAdapter | null {
  for (const adapter of URL_SOURCE_ADAPTERS) {
    if (adapter.detect(raw)) return adapter;
  }
  return null;
}

export function adapterById(id: string): VideoSourceAdapter | null {
  return URL_SOURCE_ADAPTERS.find((adapter) => adapter.id === id) || null;
}
