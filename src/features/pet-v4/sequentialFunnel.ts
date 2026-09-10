/**
 * Pure sequential cohort math for V4.
 * A later stage NEVER exceeds an earlier stage — impossible funnels are clamped.
 */

import {
  V4_SEQUENTIAL_EVENT_BY_STAGE,
  V4_SEQUENTIAL_LABELS,
  V4_SEQUENTIAL_STAGES,
  type PetV4EventName,
  type V4SequentialStage,
} from "./types";

export type V4SequentialStep = {
  stage: V4SequentialStage;
  label: string;
  eventName: PetV4EventName;
  users: number;
  toNextPct: number | null;
  dropOffUsers: number | null;
  dropOffPct: number | null;
};

export type V4DropOffPoint = {
  rank: number;
  from: V4SequentialStage;
  to: V4SequentialStage;
  fromLabel: string;
  toLabel: string;
  lost: number;
  dropOffPct: number;
};

/** Build cohort-chained counts: each stage ⊆ previous stage sessions. */
export function buildV4SequentialCohort(
  sessionsByEvent: Record<string, Set<string>>,
): Record<V4SequentialStage, number> {
  const landing = sessionsByEvent.v4_landing_view || new Set<string>();
  let current = landing;
  const out = {} as Record<V4SequentialStage, number>;
  out.landing = current.size;

  for (let i = 1; i < V4_SEQUENTIAL_STAGES.length; i++) {
    const stage = V4_SEQUENTIAL_STAGES[i];
    const eventName = V4_SEQUENTIAL_EVENT_BY_STAGE[stage];
    const nextSet = sessionsByEvent[eventName] || new Set<string>();
    current = new Set([...current].filter((id) => nextSet.has(id)));
    out[stage] = current.size;
  }
  return out;
}

/** Enforce monotonic non-increasing counts (defense in depth for UI). */
export function enforceMonotonicSequential(
  counts: Record<V4SequentialStage, number>,
): Record<V4SequentialStage, number> {
  const out = { ...counts };
  let floor = Number.POSITIVE_INFINITY;
  for (const stage of V4_SEQUENTIAL_STAGES) {
    const n = Math.max(0, Math.floor(Number(out[stage]) || 0));
    const clamped = Math.min(n, Number.isFinite(floor) ? floor : n);
    out[stage] = clamped;
    floor = clamped;
  }
  return out;
}

export function buildV4SequentialSteps(
  countsInput: Record<V4SequentialStage, number>,
): V4SequentialStep[] {
  const counts = enforceMonotonicSequential(countsInput);
  return V4_SEQUENTIAL_STAGES.map((stage, index) => {
    const users = counts[stage];
    const nextStage = V4_SEQUENTIAL_STAGES[index + 1];
    const nextUsers = nextStage ? counts[nextStage] : null;
    const toNextPct =
      nextUsers == null || users <= 0 ? null : Math.round((nextUsers / users) * 1000) / 10;
    const dropOffUsers = nextUsers == null ? null : Math.max(0, users - nextUsers);
    const dropOffPct =
      dropOffUsers == null || users <= 0 ? null : Math.round((dropOffUsers / users) * 1000) / 10;
    return {
      stage,
      label: V4_SEQUENTIAL_LABELS[stage],
      eventName: V4_SEQUENTIAL_EVENT_BY_STAGE[stage],
      users,
      toNextPct,
      dropOffUsers,
      dropOffPct,
    };
  });
}

export function rankV4DropOffPoints(steps: V4SequentialStep[]): V4DropOffPoint[] {
  const points: V4DropOffPoint[] = [];
  for (let i = 0; i < steps.length - 1; i++) {
    const from = steps[i];
    const to = steps[i + 1];
    if (from.dropOffUsers == null || from.dropOffPct == null) continue;
    if (from.users <= 0) continue;
    points.push({
      rank: 0,
      from: from.stage,
      to: to.stage,
      fromLabel: from.label,
      toLabel: to.label,
      lost: from.dropOffUsers,
      dropOffPct: from.dropOffPct,
    });
  }
  points.sort((a, b) => b.dropOffPct - a.dropOffPct || b.lost - a.lost);
  return points.map((p, idx) => ({ ...p, rank: idx + 1 }));
}

/** Median of a numeric array (empty → null). */
export function medianNumber(values: number[]): number | null {
  const sorted = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

export function percentileNumber(values: number[], p: number): number | null {
  const sorted = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export function mapV2EventToV4(eventName: string): PetV4EventName | null {
  const map: Record<string, PetV4EventName> = {
    v2_landing_view: "v4_landing_view",
    v2_upload_started: "v4_upload_started",
    v2_upload_completed: "v4_upload_completed",
    v2_upload_failed: "v4_upload_failed",
    v2_teaser_generation_started: "v4_generation_started",
    v2_teaser_generation_completed: "v4_generation_completed",
    v2_teaser_generation_failed: "v4_generation_failed",
    v2_teaser_viewed: "v4_teaser_viewed",
    v2_offer_viewed: "v4_offer_viewed",
    v2_begin_checkout: "v4_checkout_clicked",
    v2_checkout_session_created: "v4_checkout_session_created",
    v2_checkout_abandoned: "v4_checkout_abandoned",
    v2_purchase: "v4_purchase",
    v2_payment_ui_visible: "v4_checkout_opened",
  };
  return map[eventName] || null;
}
