import type { FunnelDatasetId } from "./funnelDatasetConfig";

type HealthRow = Record<string, unknown>;

function asNullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Map RPC tracking_health to the active dataset.
 * V3 has no dedicated health fields yet — never fall through to V1/V2 values.
 * V1/V2 key selection matches the verified dashboard mapping.
 */
export function resolveDatasetTrackingHealth(input: {
  datasetId: FunnelDatasetId;
  health: HealthRow | null | undefined;
  firstEventAtFallback: string | null;
}): {
  failedWrites: number | null;
  rejectedRequests: number | null;
  latestFirstPartyAt: string | null;
  unavailableReason: string | null;
} {
  if (input.datasetId === "v3") {
    return {
      failedWrites: null,
      rejectedRequests: null,
      latestFirstPartyAt: null,
      unavailableReason: "V3 tracking health is not available yet",
    };
  }

  const health = input.health && typeof input.health === "object" ? input.health : null;
  if (!health) {
    return {
      failedWrites: null,
      rejectedRequests: null,
      latestFirstPartyAt: input.firstEventAtFallback,
      unavailableReason: null,
    };
  }

  const failedKey = input.datasetId === "v2" ? "v2_failed_write_count" : "v1_failed_write_count";
  const rejectedKey =
    input.datasetId === "v2" ? "v2_rejected_request_count" : "v1_rejected_request_count";
  const latestKey = input.datasetId === "v2" ? "latest_v2_event_at" : "latest_v1_event_at";

  const failedWrites = asNullableNumber(
    health[failedKey] ??
      health.v2_failed_write_count ??
      health.v1_failed_write_count ??
      health.failed_write_count,
  );
  const rejectedRequests = asNullableNumber(
    health[rejectedKey] ??
      health.v2_rejected_request_count ??
      health.v1_rejected_request_count ??
      health.rejected_request_count,
  );
  const latestRaw =
    health[latestKey] ??
    health.latest_v2_event_at ??
    health.latest_v1_event_at ??
    health.latest_first_party_event_at;
  const latestFirstPartyAt = latestRaw ? String(latestRaw) : input.firstEventAtFallback;

  return {
    failedWrites,
    rejectedRequests,
    latestFirstPartyAt,
    unavailableReason: null,
  };
}
