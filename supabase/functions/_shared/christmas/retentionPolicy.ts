/**
 * Deno copy of src/features/christmas/retention/retentionPolicy.ts.
 * Keep constants and classifier in lockstep — tests assert both files match.
 * Pure module: no I/O, no mock runtime data.
 */

export const CHRISTMAS_SOURCE_BUCKET = "christmas-source";
export const CHRISTMAS_GENERATED_BUCKET = "christmas-generated";
export const UNPAID_UPLOAD_PREFIX = "uploads/";

export const DEFAULT_UNPAID_UPLOAD_TTL_DAYS = 7;
export const SANTA_FINAL_VIDEO_TTL_DAYS = 365;
export const SANTA_PERSONALIZATION_TTL_DAYS = 90;
export const SANTA_INTERMEDIATE_TTL_DAYS = 14;

export const CHRISTMAS_MEDIA_RETENTION = {
  policy: "policy_pending_founder_legal" as const,
  santaDefaultDaysEnv: "CHRISTMAS_SANTA_RETENTION_DAYS",
  unpaidUploadTtlDaysEnv: "CHRISTMAS_UNPAID_UPLOAD_TTL_DAYS",
  unpaidUploadPrefix: UNPAID_UPLOAD_PREFIX,
  sourceBucket: CHRISTMAS_SOURCE_BUCKET,
  generatedBucket: CHRISTMAS_GENERATED_BUCKET,
  note:
    "Ops purge deletes unpaid uploads/ only. Paid sources stay. Paid results and Santa/kids media wait for founder/legal TTL.",
} as const;

export type ChristmasRetentionPolicyStatus = typeof CHRISTMAS_MEDIA_RETENTION.policy;

export type StorageObjectRef = {
  bucket: string;
  path: string;
  createdAt: string;
};

export type OrderSourceRef = {
  sourcePath: string | null;
  sourceBucket: string | null;
  paymentStatus: string;
};

export type PurgeDecisionReason =
  | "paid_source"
  | "within_unpaid_ttl"
  | "outside_uploads_prefix"
  | "wrong_bucket"
  | "legal_hold_generated"
  | "unpaid_upload_expired";

export type PurgeDecision = {
  action: "keep" | "purge";
  reason: PurgeDecisionReason;
  path: string;
  bucket: string;
};

export function resolveUnpaidUploadTtlDays(raw: string | number | null | undefined): number {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
  if (!Number.isFinite(n) || n < 1 || n > 365) return DEFAULT_UNPAID_UPLOAD_TTL_DAYS;
  return Math.floor(n);
}

export function normalizeStoragePath(path: string | null | undefined): string {
  return String(path || "").replace(/^\/+/, "").trim();
}

export function isUnpaidUploadPath(path: string | null | undefined): boolean {
  const normalized = normalizeStoragePath(path);
  return normalized.startsWith(UNPAID_UPLOAD_PREFIX) && normalized.length > UNPAID_UPLOAD_PREFIX.length;
}

export function isPaidPaymentStatus(status: string | null | undefined): boolean {
  return String(status || "").trim().toLowerCase() === "paid";
}

export function orderSourceKey(bucket: string | null | undefined, path: string | null | undefined): string | null {
  const normalized = normalizeStoragePath(path);
  if (!normalized) return null;
  return `${bucket || CHRISTMAS_SOURCE_BUCKET}:${normalized}`;
}

export function paidSourceKeys(orders: readonly OrderSourceRef[]): Set<string> {
  const keys = new Set<string>();
  for (const order of orders) {
    if (!isPaidPaymentStatus(order.paymentStatus)) continue;
    const key = orderSourceKey(order.sourceBucket, order.sourcePath);
    if (key) keys.add(key);
  }
  return keys;
}

export function objectAgeMs(createdAt: string, nowMs: number): number {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, nowMs - created);
}

export function classifyRetentionObject(input: {
  object: StorageObjectRef;
  paidKeys: ReadonlySet<string>;
  nowMs: number;
  unpaidTtlDays?: number;
}): PurgeDecision {
  const path = normalizeStoragePath(input.object.path);
  const bucket = String(input.object.bucket || "").trim() || CHRISTMAS_SOURCE_BUCKET;
  const ttlDays = resolveUnpaidUploadTtlDays(input.unpaidTtlDays);
  const key = orderSourceKey(bucket, path);

  if (bucket === CHRISTMAS_GENERATED_BUCKET) {
    return { action: "keep", reason: "legal_hold_generated", path, bucket };
  }
  if (bucket !== CHRISTMAS_SOURCE_BUCKET) {
    return { action: "keep", reason: "wrong_bucket", path, bucket };
  }
  if (!isUnpaidUploadPath(path)) {
    return { action: "keep", reason: "outside_uploads_prefix", path, bucket };
  }
  if (key && input.paidKeys.has(key)) {
    return { action: "keep", reason: "paid_source", path, bucket };
  }
  const ttlMs = ttlDays * 86_400_000;
  if (objectAgeMs(input.object.createdAt, input.nowMs) < ttlMs) {
    return { action: "keep", reason: "within_unpaid_ttl", path, bucket };
  }
  return { action: "purge", reason: "unpaid_upload_expired", path, bucket };
}

export function planRetentionPurge(input: {
  objects: readonly StorageObjectRef[];
  orders: readonly OrderSourceRef[];
  nowMs: number;
  unpaidTtlDays?: number;
}): { keep: PurgeDecision[]; purge: PurgeDecision[] } {
  const paidKeys = paidSourceKeys(input.orders);
  const keep: PurgeDecision[] = [];
  const purge: PurgeDecision[] = [];
  for (const object of input.objects) {
    const decision = classifyRetentionObject({
      object,
      paidKeys,
      nowMs: input.nowMs,
      unpaidTtlDays: input.unpaidTtlDays,
    });
    if (decision.action === "purge") purge.push(decision);
    else keep.push(decision);
  }
  return { keep, purge };
}
