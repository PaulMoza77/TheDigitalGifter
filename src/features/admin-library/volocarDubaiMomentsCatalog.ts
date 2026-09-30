import type { LibraryVideo } from "./catalog";

export const VOLOCAR_DUBAI_MOMENTS_PRODUCTION_ID = "volocar-dubai-moments-20260930";

const VOLOCAR_DUBAI_TAGS = [
  "volocar",
  "dubai",
  "dubai-moments",
  "product-ui-image",
  "16:9",
  "AI-generated",
  "experience-first",
] as const;

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
    tags: [...VOLOCAR_DUBAI_TAGS, `sequence-${String(entry.sequence).padStart(2, "0")}`],
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
