import type { LibraryVideo } from "./catalog";

export const VOLOCAR_DUBAI_MOMENTS_PRODUCTION_ID = "volocar-dubai-moments-20260930";

const VOLOCAR_DUBAI_TAGS = [
  "volocar",
  "dubai",
  "dubai-moments",
  "16:9",
  "AI-generated",
  "experience-first",
] as const;

const VOLOCAR_CLIP_TAGS = [...VOLOCAR_DUBAI_TAGS, "short-clip", "kling-i2v", "silent"] as const;

function volocarPhoto(entry: {
  id: string;
  sequence: number;
  concept: string;
  filename: string;
  jobId?: string;
  costUsd?: number;
  createdAt?: string;
  fileSizeBytes: number;
}): LibraryVideo {
  const src = `/assets/volocar/dubai-moments/masters/${entry.filename}`;
  return {
    id: entry.id,
    title: `VoloCar Dubai Moments · ${String(entry.sequence).padStart(2, "0")} · ${entry.concept}`,
    description: `16:9 master still · ${entry.concept} · collection dubai_moments · pending human QC approval.`,
    src,
    filename: entry.filename,
    category: "volocar_dubai_moments",
    kind: "photo",
    width: 2688,
    height: 1536,
    poster: src,
    fileSizeBytes: entry.fileSizeBytes,
    tags: [...VOLOCAR_DUBAI_TAGS, "product-ui-image", `sequence-${String(entry.sequence).padStart(2, "0")}`],
    model: "recraft/v4.1/pro/text-to-image",
    jobId: entry.jobId,
    costUsd: entry.costUsd,
    productionId: VOLOCAR_DUBAI_MOMENTS_PRODUCTION_ID,
    createdAt: entry.createdAt,
  };
}

/** VoloCar · Dubai Moments — 16:9 product UI stills (masters in public/assets). */
export const VOLOCAR_DUBAI_MOMENTS_PHOTOS: LibraryVideo[] = [
  volocarPhoto({
    id: "01_volocar_dubai_moments_supercar_night",
    sequence: 1,
    concept: "Super Car Night",
    filename: "01_volocar_dubai_moments_supercar_night.jpg",
    jobId: "f2b2d01b-b52c-4df8-a0de-9126e41774b9",
    costUsd: 0.21,
    createdAt: "2026-09-30T18:13:54.614583+00:00",
    fileSizeBytes: 1744294,
  }),
  volocarPhoto({
    id: "02_volocar_dubai_moments_girls_night",
    sequence: 2,
    concept: "Girls' Night",
    filename: "02_volocar_dubai_moments_girls_night.jpg",
    jobId: "4acd31c3-57af-4730-8c26-00e4e9f4ac1f",
    costUsd: 0.21,
    createdAt: "2026-09-30T18:35:06.632934+00:00",
    fileSizeBytes: 1660457,
  }),
  volocarPhoto({
    id: "03_volocar_dubai_moments_the_arrival",
    sequence: 3,
    concept: "The Arrival",
    filename: "03_volocar_dubai_moments_the_arrival.jpg",
    jobId: "a3096323-c6e1-48a9-a1ab-40fc3e05f787",
    costUsd: 0.21,
    createdAt: "2026-09-30T18:35:25.185468+00:00",
    fileSizeBytes: 1695254,
  }),
  volocarPhoto({
    id: "04_volocar_dubai_moments_morning_escape",
    sequence: 4,
    concept: "Morning Escape",
    filename: "04_volocar_dubai_moments_morning_escape.jpg",
    jobId: "7565245b-91af-4e8b-9231-e0398a429d36",
    costUsd: 0.21,
    createdAt: "2026-09-30T18:35:48.057973+00:00",
    fileSizeBytes: 1207141,
  }),
  volocarPhoto({
    id: "05_volocar_dubai_moments_marina_night",
    sequence: 5,
    concept: "Marina Night",
    filename: "05_volocar_dubai_moments_marina_night.jpg",
    jobId: "e5e7ce03-f5ec-4548-a757-34e8b42f12d3",
    costUsd: 0.21,
    createdAt: "2026-09-30T18:36:06.485575+00:00",
    fileSizeBytes: 2022470,
  }),
  volocarPhoto({
    id: "06_volocar_dubai_moments_arrival_dubai",
    sequence: 6,
    concept: "Arrival in Dubai",
    filename: "06_volocar_dubai_moments_arrival_dubai.jpg",
    jobId: "529f7cde-e5e6-4a23-8168-9c2b761e37c9",
    costUsd: 0.21,
    createdAt: "2026-09-30T18:36:21.537899+00:00",
    fileSizeBytes: 1346108,
  }),
];

function volocarClip(entry: {
  id: string;
  sequence: number;
  concept: string;
  filename: string;
  sourceImageId: string;
  sourceImageFilename: string;
  jobId: string;
  costUsd: number;
  fileSizeBytes: number;
  durationSeconds: number;
}): LibraryVideo {
  const src = `/assets/volocar/dubai-moments/clips/${entry.filename}`;
  const poster = `/assets/volocar/dubai-moments/masters/${entry.sourceImageFilename}`;
  return {
    id: entry.id,
    title: `VoloCar Dubai Moments · ${String(entry.sequence).padStart(2, "0")} · ${entry.concept} · 5s I2V`,
    description: `Kling 3.0 Pro I2V, 5s silent · source ${entry.sourceImageId} · dubai_moments.`,
    src,
    filename: entry.filename,
    category: "volocar_dubai_moments",
    kind: "short",
    durationSeconds: entry.durationSeconds,
    poster,
    width: 1920,
    height: 1080,
    fileSizeBytes: entry.fileSizeBytes,
    tags: [...VOLOCAR_CLIP_TAGS, `sequence-${String(entry.sequence).padStart(2, "0")}`],
    model: "kling-video/v3.0/pro/image-to-video",
    jobId: entry.jobId,
    costUsd: entry.costUsd,
    sourceImage: entry.sourceImageFilename,
    productionId: VOLOCAR_DUBAI_MOMENTS_PRODUCTION_ID,
  };
}

export const VOLOCAR_DUBAI_MOMENTS_CLIPS: LibraryVideo[] = [
  volocarClip({
    id: "01_volocar_dubai_moments_supercar_night_5s",
    sequence: 1,
    concept: "Super Car Night",
    filename: "01_volocar_dubai_moments_supercar_night_5s.mp4",
    sourceImageId: "01_volocar_dubai_moments_supercar_night",
    sourceImageFilename: "01_volocar_dubai_moments_supercar_night.jpg",
    jobId: "04e1f9ae-f510-4195-91a4-bea1793c692f",
    costUsd: 0.308,
    fileSizeBytes: 12456082,
    durationSeconds: 5.04,
  }),
  volocarClip({
    id: "02_volocar_dubai_moments_girls_night_5s",
    sequence: 2,
    concept: "Girls' Night",
    filename: "02_volocar_dubai_moments_girls_night_5s.mp4",
    sourceImageId: "02_volocar_dubai_moments_girls_night",
    sourceImageFilename: "02_volocar_dubai_moments_girls_night.jpg",
    jobId: "b75ef14c-2a2d-4b36-a784-721aa70afcd4",
    costUsd: 0.308,
    fileSizeBytes: 14354348,
    durationSeconds: 5.04,
  }),
  volocarClip({
    id: "03_volocar_dubai_moments_the_arrival_5s",
    sequence: 3,
    concept: "The Arrival",
    filename: "03_volocar_dubai_moments_the_arrival_5s.mp4",
    sourceImageId: "03_volocar_dubai_moments_the_arrival",
    sourceImageFilename: "03_volocar_dubai_moments_the_arrival.jpg",
    jobId: "3e33000d-5492-4844-ad5f-3f9488e5a31e",
    costUsd: 0.308,
    fileSizeBytes: 10879923,
    durationSeconds: 5.04,
  }),
  volocarClip({
    id: "04_volocar_dubai_moments_morning_escape_5s",
    sequence: 4,
    concept: "Morning Escape",
    filename: "04_volocar_dubai_moments_morning_escape_5s.mp4",
    sourceImageId: "04_volocar_dubai_moments_morning_escape",
    sourceImageFilename: "04_volocar_dubai_moments_morning_escape.jpg",
    jobId: "83ebde8a-25a4-465b-b70b-d25b7d02c250",
    costUsd: 0.308,
    fileSizeBytes: 8467204,
    durationSeconds: 5.04,
  }),
  volocarClip({
    id: "05_volocar_dubai_moments_marina_night_5s",
    sequence: 5,
    concept: "Marina Night",
    filename: "05_volocar_dubai_moments_marina_night_5s.mp4",
    sourceImageId: "05_volocar_dubai_moments_marina_night",
    sourceImageFilename: "05_volocar_dubai_moments_marina_night.jpg",
    jobId: "b37f96f6-5d1c-4f73-bbf8-40f6535039c6",
    costUsd: 0.308,
    fileSizeBytes: 15988238,
    durationSeconds: 5.04,
  }),
  volocarClip({
    id: "06_volocar_dubai_moments_arrival_dubai_5s",
    sequence: 6,
    concept: "Arrival in Dubai",
    filename: "06_volocar_dubai_moments_arrival_dubai_5s.mp4",
    sourceImageId: "06_volocar_dubai_moments_arrival_dubai",
    sourceImageFilename: "06_volocar_dubai_moments_arrival_dubai.jpg",
    jobId: "408854d1-3e99-444b-a6f1-1a76386ee2a8",
    costUsd: 0.308,
    fileSizeBytes: 12413099,
    durationSeconds: 5.04,
  }),
];

export const VOLOCAR_DUBAI_MOMENTS_REEL: LibraryVideo = {
  id: "volocar_dubai_moments_reel_v1_master",
  title: "VoloCar Dubai Moments · Reel v1",
  description: "Silent 1920×1080 master reel · ~22s · hard-cut trim from six 5s I2V clips · dubai_moments.",
  src: "/assets/volocar/dubai-moments/final/volocar_dubai_moments_reel_v1_master.mp4",
  filename: "volocar_dubai_moments_reel_v1_master.mp4",
  category: "volocar_dubai_moments",
  kind: "reel",
  durationSeconds: 21.6,
  poster: "/assets/volocar/dubai-moments/posters/volocar_dubai_moments_reel_v1_master.jpg",
  width: 1920,
  height: 1080,
  fileSizeBytes: 22733395,
  tags: [...VOLOCAR_DUBAI_TAGS, "reel", "silent", "master"],
  productionId: VOLOCAR_DUBAI_MOMENTS_PRODUCTION_ID,
  clipsUsed: VOLOCAR_DUBAI_MOMENTS_CLIPS.map((c) => c.id),
};
