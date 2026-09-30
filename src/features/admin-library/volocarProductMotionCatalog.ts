import type { LibraryVideo } from "./catalog";

export const VOLOCAR_PRODUCT_MOTION_PRODUCTION_ID = "volocar-product-motion-20260930";

const VOLOCAR_PM_TAGS = [
  "volocar",
  "product-motion",
  "product-ui",
  "16:9",
  "AI-generated",
  "silent",
  "kling-3-pro",
] as const;

function sourcePhoto(entry: {
  id: string;
  label: string;
  filename: string;
  jobId?: string;
  costUsd?: number;
  createdAt?: string;
  fileSizeBytes: number;
  reused?: boolean;
}): LibraryVideo {
  const src = `/assets/volocar/product-motion/masters/${entry.filename}`;
  return {
    id: entry.id,
    title: `VoloCar Product Motion · ${entry.label} · source`,
    description: `16:9 master still · ${entry.label} · collection VoloCar / Product Motion · zero on-image text.`,
    src,
    filename: entry.filename,
    category: "volocar_product_motion",
    kind: "photo",
    width: 2688,
    height: 1536,
    poster: src,
    fileSizeBytes: entry.fileSizeBytes,
    tags: [...VOLOCAR_PM_TAGS, "source-still"],
    model: entry.reused ? undefined : "recraft/v4.1/pro/text-to-image",
    jobId: entry.jobId,
    costUsd: entry.costUsd,
    productionId: VOLOCAR_PRODUCT_MOTION_PRODUCTION_ID,
    createdAt: entry.createdAt,
  };
}

function motionMaster(entry: {
  id: string;
  label: string;
  filename: string;
  sourceFilename: string;
  jobId: string;
  costUsd: number;
  fileSizeBytes: number;
  createdAt: string;
}): LibraryVideo {
  const src = `/assets/volocar/product-motion/masters/${entry.filename}`;
  const posterPath = `/assets/volocar/product-motion/posters/${entry.id.replace(/_5s$/, "")}.jpg`;
  return {
    id: entry.id,
    title: `VoloCar Product Motion · ${entry.label} · 5s master`,
    description: `Higgsfield Kling 3.0 Pro I2V · 5s · 1920×1080 · silent · ${entry.label} · product UI motion master.`,
    src,
    filename: entry.filename,
    category: "volocar_product_motion",
    kind: "short",
    durationSeconds: 5.04,
    poster: posterPath,
    width: 1920,
    height: 1080,
    tags: [...VOLOCAR_PM_TAGS, "product-motion-master"],
    model: "kling-video/v3.0/pro/image-to-video",
    sourceImage: entry.sourceFilename,
    jobId: entry.jobId,
    costUsd: entry.costUsd,
    fileSizeBytes: entry.fileSizeBytes,
    productionId: VOLOCAR_PRODUCT_MOTION_PRODUCTION_ID,
    createdAt: entry.createdAt,
  };
}

/** VoloCar · Product Motion — 16:9 source stills + 5s silent masters (public/assets). */
export const VOLOCAR_PRODUCT_MOTION_SOURCES: LibraryVideo[] = [
  sourcePhoto({
    id: "01_volocar_zero_deposit_source",
    label: "Zero Deposit",
    filename: "01_volocar_zero_deposit_source.jpg",
    jobId: "996cfa8c-0ba6-438b-8ff7-9f24b4e2fe37",
    costUsd: 0.21,
    createdAt: "2026-09-30T20:05:30+00:00",
    fileSizeBytes: 297653,
  }),
  sourcePhoto({
    id: "02_volocar_monthly_source",
    label: "Monthly",
    filename: "02_volocar_monthly_source.jpg",
    jobId: "84997e27-f593-4b54-9d2d-06f8a6829cbf",
    costUsd: 0.21,
    createdAt: "2026-09-30T20:07:00+00:00",
    fileSizeBytes: 2560155,
  }),
  sourcePhoto({
    id: "03_volocar_airport_delivery_source",
    label: "Airport Delivery",
    filename: "03_volocar_airport_delivery_source.jpg",
    costUsd: 0,
    createdAt: "2026-09-30T20:09:00+00:00",
    fileSizeBytes: 1346108,
    reused: true,
  }),
  sourcePhoto({
    id: "04_volocar_supercars_source",
    label: "Supercars",
    filename: "04_volocar_supercars_source.jpg",
    jobId: "9449a3a1-ba07-46ea-add9-d26eb09e7d8e",
    costUsd: 0.21,
    createdAt: "2026-09-30T20:12:00+00:00",
    fileSizeBytes: 1450116,
  }),
];

export const VOLOCAR_PRODUCT_MOTION_MASTERS: LibraryVideo[] = [
  motionMaster({
    id: "01_volocar_zero_deposit_5s",
    label: "Zero Deposit",
    filename: "01_volocar_zero_deposit_5s.mp4",
    sourceFilename: "01_volocar_zero_deposit_source.jpg",
    jobId: "6daed2b2-6268-4b77-a3a6-c0295b52a792",
    costUsd: 0.308,
    fileSizeBytes: 3529037,
    createdAt: "2026-09-30T20:07:00+00:00",
  }),
  motionMaster({
    id: "02_volocar_monthly_5s",
    label: "Monthly",
    filename: "02_volocar_monthly_5s.mp4",
    sourceFilename: "02_volocar_monthly_source.jpg",
    jobId: "65d21a19-6424-4766-9f1a-8f93a8308338",
    costUsd: 0.308,
    fileSizeBytes: 9443589,
    createdAt: "2026-09-30T20:09:00+00:00",
  }),
  motionMaster({
    id: "03_volocar_airport_delivery_5s",
    label: "Airport Delivery",
    filename: "03_volocar_airport_delivery_5s.mp4",
    sourceFilename: "03_volocar_airport_delivery_source.jpg",
    jobId: "801313a3-98d2-4d03-b804-14a2fd87ef45",
    costUsd: 0.308,
    fileSizeBytes: 11557677,
    createdAt: "2026-09-30T20:11:00+00:00",
  }),
  motionMaster({
    id: "04_volocar_supercars_5s",
    label: "Supercars",
    filename: "04_volocar_supercars_5s.mp4",
    sourceFilename: "04_volocar_supercars_source.jpg",
    jobId: "16303c7f-276e-4422-8372-0d047f519d07",
    costUsd: 0.308,
    fileSizeBytes: 13248371,
    createdAt: "2026-09-30T20:14:00+00:00",
  }),
];

export const VOLOCAR_PRODUCT_MOTION_LIBRARY: LibraryVideo[] = [
  ...VOLOCAR_PRODUCT_MOTION_SOURCES,
  ...VOLOCAR_PRODUCT_MOTION_MASTERS,
];
