/** Christmas Story media pipeline — Mission 02D types. */

export type FilmAspect = "landscape" | "portrait";

export type FilmRenderInput = {
  photos: string[];
  recipientName: string;
  dedication: string;
  captions?: string[];
  audioPath?: string | null;
  aspect: FilmAspect;
  secondsPerPhoto?: number;
  fps?: number;
  outDir: string;
  jobId: string;
  template?: "warm_cinematic_v1";
};

export type FilmRenderResult = {
  mp4Path: string;
  posterPath: string;
  previewMp4Path: string | null;
  checksumSha256: string;
  durationSec: number;
  width: number;
  height: number;
  hasAudio: boolean;
  fileSizeBytes: number;
  renderMs: number;
  peakRssMb: number | null;
};

export type MediaJobStatus =
  | "queued"
  | "generating"
  | "awaiting_manual"
  | "ready"
  | "failed"
  | "cancelled";

export type SongProductionState =
  | "awaiting_song_production"
  | "in_production"
  | "song_uploaded"
  | "rights_verification_pending"
  | "ready_for_buyer_review"
  | "revision_requested"
  | "approved"
  | "failed";

export type MediaJobRecord = {
  id: string;
  orderId: string;
  jobType: "film" | "song" | "story" | "lyrics" | "print";
  provider: "mock" | "manual" | "authorized_api" | "ffmpeg";
  status: MediaJobStatus;
  attempts: number;
  maxAttempts: number;
  workerId: string | null;
  leasedUntil: string | null;
  heartbeatAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  nextRetryAt: string | null;
  inputChecksum: string | null;
  outputChecksum: string | null;
  errorCode: string | null;
  errorClass: string | null;
  productionState: SongProductionState | null;
  metadata: Record<string, unknown>;
  resultAssetPath: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MediaCostModel = {
  note: string;
  vpsComputeCentsEstimate: number | null;
  manualSongLaborCentsEstimate: number | null;
  storageCentsEstimate: number | null;
  measuredRenderMs: number | null;
  measuredOutputBytes: number | null;
  measuredPeakRssMb: number | null;
};
