/**
 * Gift Tree media URLs. Query `v=` is a content stamp so production can use
 * long-lived Cache-Control without trapping stale bytes after asset updates.
 * Do not manually fetch() these — let <video>/<img> own the network path.
 */
export const GIFT_TREE_MEDIA_V = "20260905c";

function withV(path: string): string {
  return `${path}?v=${GIFT_TREE_MEDIA_V}`;
}

export const GIFT_TREE_SCENE = {
  desktopMp4: withV("/christmas/gifts/scene-desktop.mp4"),
  mobileMp4: withV("/christmas/gifts/scene-mobile.mp4"),
  /** Optimized poster (~180KB) — prefer over the full-size JPG. */
  desktopPosterJpg: withV("/christmas/gifts/scene-desktop.poster.jpg"),
  mobilePosterJpg: withV("/christmas/gifts/scene-mobile.poster.jpg"),
  desktopPosterWebp: withV("/christmas/gifts/scene-desktop.poster.webp"),
  mobilePosterWebp: withV("/christmas/gifts/scene-mobile.poster.webp"),
  giftOpenMp4: withV("/christmas/gifts/gift-open.mp4"),
} as const;
