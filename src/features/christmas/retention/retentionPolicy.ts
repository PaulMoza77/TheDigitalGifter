/**
 * Christmas media retention — ops TTL + purge classifier (pure, no I/O).
 *
 * Ops job: keep paid sources; purge abandoned unpaid objects under uploads/.
 * Legal/product TTL for paid results and Santa/kids media remains
 * policy_pending_founder_legal (GAP privacy branch). This module must not
 * invent a legal duration or authorize paid-result deletion.
 */

export const CHRISTMAS_SOURCE_BUCKET = "christmas-source";
export const CHRISTMAS_GENERATED_BUCKET = "christmas-generated";
export const UNPAID_UPLOAD_PREFIX = "uploads/";

/** Default ops TTL for abandoned unpaid uploads (days). Overridable via env. */
export const DEFAULT_UNPAID_UPLOAD_TTL_DAYS = 7;

/** Existing Santa operational defaults (documented; not auto-purged here). */
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

/** Paid order source objects — never purge, even when they still live under uploads/. */
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

export function documentedRetentionMatrix(): Array<{
  surface: string;
  opsTtl: string;
  legalTtl: ChristmasRetentionPolicyStatus;
  purgeJob: string;
}> {
  return [
    {
      surface: "Unpaid portrait uploads (christmas-source / uploads/)",
      opsTtl: `${DEFAULT_UNPAID_UPLOAD_TTL_DAYS}d (CHRISTMAS_UNPAID_UPLOAD_TTL_DAYS)`,
      legalTtl: CHRISTMAS_MEDIA_RETENTION.policy,
      purgeJob: "purge after ops TTL unless referenced by a paid order",
    },
    {
      surface: "Paid portrait sources",
      opsTtl: "retain",
      legalTtl: CHRISTMAS_MEDIA_RETENTION.policy,
      purgeJob: "never delete",
    },
    {
      surface: "Paid portrait / Santa results (christmas-generated)",
      opsTtl: "retain",
      legalTtl: CHRISTMAS_MEDIA_RETENTION.policy,
      purgeJob: "never delete — founder/legal TTL required",
    },
    {
      surface: "Santa final video",
      opsTtl: `${SANTA_FINAL_VIDEO_TTL_DAYS}d documented (${CHRISTMAS_MEDIA_RETENTION.santaDefaultDaysEnv})`,
      legalTtl: CHRISTMAS_MEDIA_RETENTION.policy,
      purgeJob: "not auto-purged; retention_delete_after is informational until legal TTL",
    },
    {
      surface: "Santa personalization / intermediates",
      opsTtl: `${SANTA_PERSONALIZATION_TTL_DAYS}d personalization / ${SANTA_INTERMEDIATE_TTL_DAYS}d intermediates`,
      legalTtl: CHRISTMAS_MEDIA_RETENTION.policy,
      purgeJob: "not auto-purged until founder/legal TTL",
    },
    {
      surface: "Kids Christmas media",
      opsTtl: "same as portrait (unpaid uploads/ purge; paid retain)",
      legalTtl: CHRISTMAS_MEDIA_RETENTION.policy,
      purgeJob: "no kids-specific auto-delete; commercial kids still founder-gated",
    },
  ];
}
