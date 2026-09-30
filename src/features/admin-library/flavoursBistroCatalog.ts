import type { LibraryVideo } from "./catalog";

export const FLAVOURS_BISTRO_PRODUCTION_ID = "flavours-bistro-mixed-grill-20260930";

const FLAVOURS_TAGS = [
  "flavours-bistro",
  "food",
  "meta-ads",
  "mixed-grill",
  "9:16",
  "AI-generated",
  "silent",
  "product-faithful",
] as const;

const BASE = "/assets/flavours-bistro/mixed-grill-platter";

/** Flavours Bistro — mixed grill Meta ad masters (same Higgsfield generation, reframed crops). */
export const FLAVOURS_BISTRO_VIDEOS: LibraryVideo[] = [
  {
    id: "flavours-bistro-mixed-grill-photo",
    title: "Flavours Bistro · Mixed grill platter (source)",
    description:
      "Original product photograph — ground truth for the Impossible Platter Meta ad image-to-video master.",
    src: `${BASE}/flavours_bistro_mixed_grill_platter_original.jpg`,
    filename: "flavours_bistro_mixed_grill_platter_original.jpg",
    category: "flavours_bistro",
    kind: "photo",
    width: 1600,
    height: 1600,
    poster: `${BASE}/flavours_bistro_mixed_grill_platter_original.jpg`,
    tags: [...FLAVOURS_TAGS, "source-still"],
    productionId: FLAVOURS_BISTRO_PRODUCTION_ID,
    createdAt: "2026-09-30T20:30:00.000Z",
  },
  {
    id: "flavours-bistro-impossible-platter-master-9x16",
    title: "Flavours Bistro · The Impossible Platter · 9:16 master",
    description:
      "8s silent Kling 3.0 Pro I2V (attempt 01) · visual QC FAIL — tray morph / garnish morph; top up Higgsfield credits and regenerate before paid Meta use.",
    src: `${BASE}/final/flavours_bistro_impossible_platter_master_9x16_1080x1920.mp4`,
    filename: "flavours_bistro_impossible_platter_master_9x16_1080x1920.mp4",
    category: "flavours_bistro",
    kind: "reel",
    durationSeconds: 8,
    width: 1080,
    height: 1920,
    poster: `${BASE}/posters/flavours_bistro_impossible_platter_hero.jpg`,
    model: "kling-video/v3.0/pro/image-to-video",
    jobId: "7207e1e1-0e31-4845-9978-f4f33d7bd6f8",
    costUsd: 0.493,
    fileSizeBytes: 11206007,
    productionId: FLAVOURS_BISTRO_PRODUCTION_ID,
    sourceImage: "flavours_bistro_mixed_grill_platter_original.jpg",
    tags: [...FLAVOURS_TAGS, "kling-i2v", "master", "9:16", "qc-fail-needs-regen"],
    createdAt: "2026-09-30T20:33:37.531Z",
  },
  {
    id: "flavours-bistro-impossible-platter-meta-4x5",
    title: "Flavours Bistro · The Impossible Platter · 4:5 Meta Feed",
    description: "Center crop from the same 9:16 master · 1080×1350 · no separate regeneration.",
    src: `${BASE}/final/flavours_bistro_impossible_platter_meta_4x5_1080x1350.mp4`,
    filename: "flavours_bistro_impossible_platter_meta_4x5_1080x1350.mp4",
    category: "flavours_bistro",
    kind: "reel",
    durationSeconds: 8,
    width: 1080,
    height: 1350,
    poster: `${BASE}/posters/flavours_bistro_impossible_platter_hero.jpg`,
    tags: [...FLAVOURS_TAGS, "crop", "4:5", "meta-feed"],
    model: "kling-video/v3.0/pro/image-to-video",
    productionId: FLAVOURS_BISTRO_PRODUCTION_ID,
    clipsUsed: ["flavours-bistro-impossible-platter-master-9x16"],
    createdAt: "2026-09-30T20:30:00.000Z",
  },
  {
    id: "flavours-bistro-impossible-platter-meta-1x1",
    title: "Flavours Bistro · The Impossible Platter · 1:1 Meta Feed",
    description: "Center crop from the same 9:16 master · 1080×1080 · no separate regeneration.",
    src: `${BASE}/final/flavours_bistro_impossible_platter_meta_1x1_1080x1080.mp4`,
    filename: "flavours_bistro_impossible_platter_meta_1x1_1080x1080.mp4",
    category: "flavours_bistro",
    kind: "reel",
    durationSeconds: 8,
    width: 1080,
    height: 1080,
    poster: `${BASE}/posters/flavours_bistro_impossible_platter_hero.jpg`,
    tags: [...FLAVOURS_TAGS, "crop", "1:1", "meta-feed"],
    model: "kling-video/v3.0/pro/image-to-video",
    productionId: FLAVOURS_BISTRO_PRODUCTION_ID,
    clipsUsed: ["flavours-bistro-impossible-platter-master-9x16"],
    createdAt: "2026-09-30T20:30:00.000Z",
  },
];
