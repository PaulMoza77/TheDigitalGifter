/**
 * Santa V1 production-hardening contracts.
 * Shared by unit tests; Edge copies the same rules in
 * supabase/functions/_shared/christmas/santaOps.ts.
 *
 * Production video path: ffmpeg still+TTS mux (mux-as-prod).
 * Lip-sync runs only when CHRISTMAS_SANTA_VIDEO_MODEL is set.
 * Live purchase stays founder-gated (purchasable=false, no invented prices).
 */

export const SANTA_PRODUCT_KEY = "christmas_santa_video" as const;
export const SANTA_VIDEO_PROD_MODE = "mux_as_prod" as const;

/** Final MP4 retention (days). Overridable via CHRISTMAS_SANTA_RETENTION_DAYS. */
export const SANTA_FINAL_VIDEO_RETENTION_DAYS = 365;
/** Speech audio + order-scoped still (days). */
export const SANTA_INTERMEDIATE_RETENTION_DAYS = 14;
/** Child personalization free-text (days). */
export const SANTA_PERSONALIZATION_RETENTION_DAYS = 90;

export const SANTA_REDACTED_FIRST_NAME = "redacted";

export type SantaRetryOrder = {
  payment_status?: string | null;
  product_key?: string | null;
};

export type SantaRetryJob = {
  script_status?: string | null;
  audio_status?: string | null;
  video_status?: string | null;
  job_status?: string | null;
  started_at?: string | null;
};

export type SantaRetryReset = {
  job_status: "queued";
  error_code: null;
  error_message_safe: null;
  recharge: false;
  script_status?: "pending";
  audio_status?: "pending";
  video_status?: "pending";
  reset_stages: Array<"script" | "audio" | "video">;
};

export function santaRetryEligibility(
  order: SantaRetryOrder,
): { ok: true } | { ok: false; code: "wrong_product" | "payment_required" } {
  if (order.product_key !== SANTA_PRODUCT_KEY) {
    return { ok: false, code: "wrong_product" };
  }
  if (order.payment_status !== "paid") {
    return { ok: false, code: "payment_required" };
  }
  return { ok: true };
}

export function planSantaRetryReset(job: SantaRetryJob): SantaRetryReset {
  const reset_stages: Array<"script" | "audio" | "video"> = [];
  const patch: SantaRetryReset = {
    job_status: "queued",
    error_code: null,
    error_message_safe: null,
    recharge: false,
    reset_stages,
  };
  if (job.script_status === "failed") {
    patch.script_status = "pending";
    reset_stages.push("script");
  }
  if (job.audio_status === "failed") {
    patch.audio_status = "pending";
    reset_stages.push("audio");
  }
  if (job.video_status === "failed") {
    patch.video_status = "pending";
    reset_stages.push("video");
  }
  return patch;
}

const STUCK_MS = 20 * 60 * 1000;

export function santaJobNeedsAdminRetry(
  job: SantaRetryJob | null,
  nowMs = Date.now(),
): boolean {
  if (!job) return false;
  if (job.job_status === "failed") return true;
  if (
    (job.job_status === "video_processing" ||
      job.job_status === "rendering" ||
      job.job_status === "audio_queued" ||
      job.job_status === "video_queued") &&
    job.started_at
  ) {
    const started = Date.parse(job.started_at);
    if (Number.isFinite(started) && nowMs - started > STUCK_MS) return true;
  }
  return false;
}

export type SantaRetentionJob = {
  order_id: string;
  completed_at?: string | null;
  created_at: string;
  retention_delete_after?: string | null;
  intermediates_purge_after?: string | null;
  personalization_purge_after?: string | null;
  intermediates_purged_at?: string | null;
  personalization_purged_at?: string | null;
  final_purged_at?: string | null;
  source_audio_path?: string | null;
  source_audio_bucket?: string | null;
  santa_still_path?: string | null;
  santa_still_bucket?: string | null;
  result_video_path?: string | null;
  result_video_bucket?: string | null;
  result_asset_id?: string | null;
};

export type SantaRetentionDue = {
  intermediates: boolean;
  personalization: boolean;
  finalVideo: boolean;
};

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 86400000);
}

function parseTs(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function santaRetentionAnchor(job: SantaRetentionJob): Date {
  return parseTs(job.completed_at) || parseTs(job.created_at) || new Date(0);
}

export function santaRetentionDue(
  job: SantaRetentionJob,
  now: Date = new Date(),
  policy: {
    intermediateDays?: number;
    personalizationDays?: number;
    finalDays?: number;
  } = {},
): SantaRetentionDue {
  const anchor = santaRetentionAnchor(job);
  const intermediateAfter =
    parseTs(job.intermediates_purge_after) ||
    addDays(anchor, policy.intermediateDays ?? SANTA_INTERMEDIATE_RETENTION_DAYS);
  const personalizationAfter =
    parseTs(job.personalization_purge_after) ||
    addDays(anchor, policy.personalizationDays ?? SANTA_PERSONALIZATION_RETENTION_DAYS);
  const finalAfter =
    parseTs(job.retention_delete_after) ||
    addDays(anchor, policy.finalDays ?? SANTA_FINAL_VIDEO_RETENTION_DAYS);

  return {
    intermediates: !job.intermediates_purged_at && now.getTime() >= intermediateAfter.getTime(),
    personalization: !job.personalization_purged_at && now.getTime() >= personalizationAfter.getTime(),
    finalVideo: !job.final_purged_at && now.getTime() >= finalAfter.getTime(),
  };
}

/** Only delete order-scoped media — never the shared template still cache. */
export function isOrderScopedSantaPath(path: string | null | undefined, orderId: string): boolean {
  const p = String(path || "").trim();
  const id = String(orderId || "").trim();
  if (!p || !id) return false;
  return p.startsWith(`santa/${id}/`);
}

export function santaIntermediateStorageTargets(job: SantaRetentionJob): Array<{
  bucket: string;
  path: string;
}> {
  const out: Array<{ bucket: string; path: string }> = [];
  const seen = new Set<string>();
  const push = (bucket: string | null | undefined, path: string | null | undefined) => {
    const b = String(bucket || "").trim();
    const p = String(path || "").trim();
    if (!b || !p || !isOrderScopedSantaPath(p, job.order_id)) return;
    const key = `${b}:${p}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ bucket: b, path: p });
  };
  push(job.source_audio_bucket, job.source_audio_path);
  push(job.santa_still_bucket, job.santa_still_path);
  push("christmas-generated", `santa/${job.order_id}/composed.mp4`);
  push("christmas-generated", `santa/${job.order_id}/speech.mp3`);
  return out;
}

export function santaFinalStorageTargets(job: SantaRetentionJob): Array<{
  bucket: string;
  path: string;
}> {
  const out = santaIntermediateStorageTargets(job);
  const seen = new Set(out.map((x) => `${x.bucket}:${x.path}`));
  const resultBucket = String(job.result_video_bucket || "christmas-generated").trim();
  const resultPath = String(job.result_video_path || "").trim();
  if (resultPath && isOrderScopedSantaPath(resultPath, job.order_id)) {
    const key = `${resultBucket}:${resultPath}`;
    if (!seen.has(key)) out.push({ bucket: resultBucket, path: resultPath });
  }
  const fallback = `santa/${job.order_id}/result.mp4`;
  const fallbackKey = `christmas-generated:${fallback}`;
  if (!seen.has(fallbackKey) && isOrderScopedSantaPath(fallback, job.order_id)) {
    out.push({ bucket: "christmas-generated", path: fallback });
  }
  return out;
}

export function santaPersonalizationRedaction() {
  return {
    child_first_name: SANTA_REDACTED_FIRST_NAME,
    age: null,
    something_good: null,
    hobby_or_interest: null,
    christmas_wish: null,
    custom_fact: null,
    sender_name: null,
  };
}

/**
 * Lip-sync candidates. Production default is empty → mux-as-prod.
 * Only the founder-configured model (and optional extras) are tried.
 */
export function santaLipsyncModelCandidates(input: {
  primaryModel?: string | null;
  extraModels?: string | null;
} = {}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string | null | undefined) => {
    const model = String(raw || "").trim();
    if (!model || seen.has(model)) return;
    seen.add(model);
    out.push(model);
  };
  push(input.primaryModel);
  for (const part of String(input.extraModels || "").split(",")) {
    push(part);
  }
  return out;
}

export function isLipsyncModelMissing(status: number, body: unknown): boolean {
  if (status === 404) return true;
  const text = typeof body === "string" ? body : JSON.stringify(body ?? "");
  const lower = text.toLowerCase();
  return (
    lower.includes("could not be found") ||
    lower.includes("not found") ||
    lower.includes("does not exist")
  );
}

export function santaVideoProviderLabel(mode: "lipsync" | "still_audio_mux" | "mock"): string {
  if (mode === "lipsync") return "replicate";
  if (mode === "mock") return "mock";
  return "ffmpeg_compose";
}
