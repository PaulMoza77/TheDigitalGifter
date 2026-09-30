import type { LibraryVideo } from "./catalog";

export const VOLOCAR_PRODUCT_MOTION_PRODUCTION_ID = "volocar-product-motion-20260930";

const VOLOCAR_PM_TAGS = [
  "volocar",
  "product-motion",
  "product-ui",
  "16:9",
  "AI-generated",
  "silent",
] as const;

type ConceptEntry = {
  sequence: number;
  name: string;
  sourceId: string;
  videoId: string;
  sourceFilename: string;
  videoFilename: string;
  sourceJobId: string;
  videoJobId: string;
  sourceCostUsd: number;
  videoCostUsd: number;
  sourceCreatedAt: string;
  videoCreatedAt: string;
  sourceFileSizeBytes: number;
  videoFileSizeBytes: number;
  durationSeconds: number;
};

const CONCEPTS: ConceptEntry[] = [
  {
    sequence: 1,
    name: "Zero Deposit",
    sourceId: "01_volocar_zero_deposit_source",
    videoId: "01_volocar_zero_deposit_5s",
    sourceFilename: "01_volocar_zero_deposit_source.jpg",
    videoFilename: "01_volocar_zero_deposit_5s.mp4",
    sourceJobId: "d429ba06-b92b-4935-aeb7-bc081e025fb7",
    videoJobId: "312be202-52f9-4a37-977f-3a6841dacf1a",
    sourceCostUsd: 0.21,
    videoCostUsd: 0.308,
    sourceCreatedAt: "2026-09-30T20:14:13.613893+00:00",
    videoCreatedAt: "2026-09-30T20:16:33.745105+00:00",
    sourceFileSizeBytes: 386394,
    videoFileSizeBytes: 5059223,
    durationSeconds: 5.04,
  },
  {
    sequence: 2,
    name: "Monthly",
    sourceId: "02_volocar_monthly_source",
    videoId: "02_volocar_monthly_5s",
    sourceFilename: "02_volocar_monthly_source.jpg",
    videoFilename: "02_volocar_monthly_5s.mp4",
    sourceJobId: "5d540dca-1f24-476e-aaf3-7d05c77e6d48",
    videoJobId: "93c6449c-4e21-48cf-904c-07b449b9818c",
    sourceCostUsd: 0.21,
    videoCostUsd: 0.308,
    sourceCreatedAt: "2026-09-30T20:14:32.938870+00:00",
    videoCreatedAt: "2026-09-30T20:16:54.752270+00:00",
    sourceFileSizeBytes: 1537713,
    videoFileSizeBytes: 6831511,
    durationSeconds: 5.04,
  },
  {
    sequence: 3,
    name: "Airport Delivery",
    sourceId: "03_volocar_airport_delivery_source",
    videoId: "03_volocar_airport_delivery_5s",
    sourceFilename: "03_volocar_airport_delivery_source.jpg",
    videoFilename: "03_volocar_airport_delivery_5s.mp4",
    sourceJobId: "ba6884cf-2238-4029-bf35-37ef0e575cea",
    videoJobId: "24e3e56b-53e2-47b6-90f2-b6ac6a8250ea",
    sourceCostUsd: 0.21,
    videoCostUsd: 0.308,
    sourceCreatedAt: "2026-09-30T20:14:52.463614+00:00",
    videoCreatedAt: "2026-09-30T20:17:26.608682+00:00",
    sourceFileSizeBytes: 1654917,
    videoFileSizeBytes: 14635038,
    durationSeconds: 5.04,
  },
  {
    sequence: 4,
    name: "Supercars",
    sourceId: "04_volocar_supercars_source",
    videoId: "04_volocar_supercars_5s",
    sourceFilename: "04_volocar_supercars_source.jpg",
    videoFilename: "04_volocar_supercars_5s.mp4",
    sourceJobId: "28a79ff5-f735-4a3b-a457-1b230dc270c4",
    videoJobId: "4dd0d0b2-58dd-427a-a1ef-21d7385acefa",
    sourceCostUsd: 0.21,
    videoCostUsd: 0.308,
    sourceCreatedAt: "2026-09-30T20:15:11.986354+00:00",
    videoCreatedAt: "2026-09-30T20:17:36.474550+00:00",
    sourceFileSizeBytes: 1689354,
    videoFileSizeBytes: 12869433,
    durationSeconds: 5.04,
  },
];

function productMotionPhoto(entry: ConceptEntry): LibraryVideo {
  const src = `/assets/volocar/product-motion/masters/${entry.sourceFilename}`;
  return {
    id: entry.sourceId,
    title: `VoloCar Product Motion · ${String(entry.sequence).padStart(2, "0")} · ${entry.name} · Source`,
    description: `16:9 master still · ${entry.name} · collection product_motion · zero-text product UI source.`,
    src,
    filename: entry.sourceFilename,
    category: "volocar_product_motion",
    kind: "photo",
    width: 2688,
    height: 1536,
    poster: src,
    fileSizeBytes: entry.sourceFileSizeBytes,
    tags: [...VOLOCAR_PM_TAGS, `sequence-${String(entry.sequence).padStart(2, "0")}`, "source"],
    model: "recraft/v4.1/pro/text-to-image",
    jobId: entry.sourceJobId,
    costUsd: entry.sourceCostUsd,
    productionId: VOLOCAR_PRODUCT_MOTION_PRODUCTION_ID,
    createdAt: entry.sourceCreatedAt,
  };
}

function productMotionVideo(entry: ConceptEntry): LibraryVideo {
  const src = `/assets/volocar/product-motion/masters/${entry.videoFilename}`;
  const poster = `/assets/volocar/product-motion/posters/${entry.videoFilename.replace(".mp4", ".jpg")}`;
  return {
    id: entry.videoId,
    title: `VoloCar Product Motion · ${String(entry.sequence).padStart(2, "0")} · ${entry.name} · 5s`,
    description: `Higgsfield Kling 3.0 Pro I2V, 5s, 1920×1080, silent. ${entry.name} product card master · zero-text overlay.`,
    src,
    filename: entry.videoFilename,
    category: "volocar_product_motion",
    kind: "short",
    durationSeconds: entry.durationSeconds,
    poster,
    width: 1920,
    height: 1080,
    fileSizeBytes: entry.videoFileSizeBytes,
    tags: [...VOLOCAR_PM_TAGS, `sequence-${String(entry.sequence).padStart(2, "0")}`, "master"],
    model: "kling-video/v3.0/pro/image-to-video",
    sourceImage: entry.sourceFilename,
    jobId: entry.videoJobId,
    costUsd: entry.videoCostUsd,
    productionId: VOLOCAR_PRODUCT_MOTION_PRODUCTION_ID,
    createdAt: entry.videoCreatedAt,
  };
}

/** VoloCar · Product Motion — 16:9 silent 5s masters + source stills. */
export const VOLOCAR_PRODUCT_MOTION_PHOTOS: LibraryVideo[] = CONCEPTS.map(productMotionPhoto);

export const VOLOCAR_PRODUCT_MOTION_VIDEOS: LibraryVideo[] = CONCEPTS.map(productMotionVideo);

export const VOLOCAR_PRODUCT_MOTION_LIBRARY: LibraryVideo[] = [
  ...VOLOCAR_PRODUCT_MOTION_VIDEOS,
  ...VOLOCAR_PRODUCT_MOTION_PHOTOS,
];
