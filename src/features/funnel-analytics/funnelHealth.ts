/**
 * Funnel / channel health. The only legal states are healthy | degraded | unverified | disabled.
 * GA4 and Meta must never be marked healthy without delivered metric rows (sync config is not evidence).
 */

export const FUNNEL_HEALTH_STATES = ["healthy", "degraded", "unverified", "disabled"] as const;
export type FunnelHealthState = (typeof FUNNEL_HEALTH_STATES)[number];

export const CHANNEL_STALE_AFTER_MS = 72 * 60 * 60 * 1000;

export type ChannelSyncStatus = "success" | "error" | "running" | "skipped_unconfigured" | null;

export type ChannelDeliveryEvidence = {
  enabled: boolean;
  configured: boolean;
  /** Delivered rows in the warehouse table. Config / env alone is not evidence. */
  deliveredRowCount: number;
  lastSuccessAt: string | null;
  lastStatus: ChannelSyncStatus;
  lastRowsUpserted: number;
};

export type FirstPartyEvidence = {
  enabled: boolean;
  ingestWired: boolean;
  eventCount: number;
  recentFailureCount: number;
};

export function isFunnelHealthState(value: unknown): value is FunnelHealthState {
  return (
    value === "healthy" || value === "degraded" || value === "unverified" || value === "disabled"
  );
}

export function isSyncStale(lastSuccessAt: string | null, nowMs = Date.now()): boolean {
  if (!lastSuccessAt) return false;
  const ts = new Date(lastSuccessAt).getTime();
  if (!Number.isFinite(ts)) return false;
  return nowMs - ts > CHANNEL_STALE_AFTER_MS;
}

/**
 * Paid-media / GA4 health. Delivery evidence is required for healthy.
 * A successful sync that upserted 0 rows is still unverified.
 */
export function resolveChannelHealth(
  evidence: ChannelDeliveryEvidence,
  nowMs = Date.now(),
): FunnelHealthState {
  if (!evidence.enabled || !evidence.configured) return "disabled";
  if (evidence.deliveredRowCount <= 0) {
    if (evidence.lastStatus === "error") return "degraded";
    return "unverified";
  }
  if (evidence.lastStatus === "error") return "degraded";
  if (isSyncStale(evidence.lastSuccessAt, nowMs)) return "degraded";
  return "healthy";
}

export function resolveFirstPartyHealth(evidence: FirstPartyEvidence): FunnelHealthState {
  if (!evidence.enabled || !evidence.ingestWired) return "disabled";
  if (evidence.recentFailureCount > 0) return "degraded";
  if (evidence.eventCount <= 0) return "unverified";
  return "healthy";
}

/** Disabled channels do not drag an enabled funnel down. */
export function combineHealth(states: readonly FunnelHealthState[]): FunnelHealthState {
  const active = states.filter((state) => state !== "disabled");
  if (active.length === 0) return "disabled";
  if (active.includes("degraded")) return "degraded";
  if (active.includes("unverified")) return "unverified";
  return "healthy";
}
