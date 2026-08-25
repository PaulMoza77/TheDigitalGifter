import { sequentialConversionPct } from "./funnelEventContract";
import { emptyStepCounts, type FunnelStepCounts } from "./funnelDashboard";
import type { FirstPartyEventRow } from "./funnelCampaignAnalytics";

/** Primary V1 funnel stages used by the existing dashboard cards / bars. */
export const V1_PRIMARY_COHORT_STAGES = [
  "landing_view",
  "pet_name_submitted",
  "photo_upload_completed",
  "order_review_viewed",
  "initiate_checkout",
  "purchase",
] as const;

export type V1PrimaryCohortStage = (typeof V1_PRIMARY_COHORT_STAGES)[number];

/**
 * Name → photo diagnostic path (post PR #42).
 * Chained: each stage only counts sessions that reached the previous stage.
 */
export const V1_PHOTO_PATH_STAGES = [
  "pet_name_submitted",
  "photo_step_viewed",
  "photo_upload_started",
  "photo_upload_completed",
] as const;

export type V1PhotoPathStage = (typeof V1_PHOTO_PATH_STAGES)[number];

export type CohortStageRow = {
  eventName: string;
  sessions: number;
  fromPreviousPct: number | null;
  fromLandingPct: number | null;
};

export type LandingCohortSequentialResult = {
  /** Landing-cohort chained counts for the primary 6-step funnel. */
  cohortCounts: FunnelStepCounts;
  /** Independent distinct-session totals (uncapped raw activity). */
  rawCounts: FunnelStepCounts;
  primaryStages: CohortStageRow[];
  photoPathStages: CohortStageRow[];
  landingCohortSize: number;
  landingCohortSessionIds: string[];
};

export type LandingCohortOptions = {
  rangeFromIso: string;
  rangeToIso: string;
  measurementReliableFrom?: string | null;
  /** When set, only sessions whose first-touch campaign_id matches. */
  campaignId?: string | null;
  /** Exclude sessions whose first-touch campaign_id equals this (isolation tests). */
  excludeCampaignId?: string | null;
};

function inRange(iso: string, fromIso: string, toIso: string): boolean {
  const t = new Date(iso).getTime();
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (!Number.isFinite(t) || !Number.isFinite(from) || !Number.isFinite(to)) return false;
  return t >= from && t < to;
}

function afterReliable(iso: string, reliableFrom: string | null | undefined): boolean {
  if (!reliableFrom) return true;
  const t = new Date(iso).getTime();
  const r = new Date(reliableFrom).getTime();
  if (!Number.isFinite(t) || !Number.isFinite(r)) return true;
  return t >= r;
}

function sessionEventSets(
  events: FirstPartyEventRow[],
): Map<string, { events: Set<string>; firstCampaignId: string | null; landingAt: string | null }> {
  const bySession = new Map<
    string,
    { events: Set<string>; firstCampaignId: string | null; landingAt: string | null; ordered: FirstPartyEventRow[] }
  >();

  const ordered = [...events]
    .filter((row) => !row.isTest)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

  for (const row of ordered) {
    let entry = bySession.get(row.funnelSessionId);
    if (!entry) {
      entry = {
        events: new Set(),
        firstCampaignId: null,
        landingAt: null,
        ordered: [],
      };
      bySession.set(row.funnelSessionId, entry);
    }
    entry.events.add(row.eventName);
    entry.ordered.push(row);
    if (!entry.firstCampaignId && row.campaignId) {
      entry.firstCampaignId = String(row.campaignId);
    }
    if (row.eventName === "landing_view" && !entry.landingAt) {
      entry.landingAt = row.createdAt;
    }
  }

  return bySession;
}

function chainStage(
  previous: Set<string>,
  hasEvent: (sessionId: string) => boolean,
): Set<string> {
  const next = new Set<string>();
  for (const id of previous) {
    if (hasEvent(id)) next.add(id);
  }
  return next;
}

function stageRows(
  stageNames: readonly string[],
  reached: Map<string, Set<string>>,
  landingSize: number,
): CohortStageRow[] {
  return stageNames.map((eventName, index) => {
    const sessions = reached.get(eventName)?.size ?? 0;
    const previousName = index === 0 ? null : stageNames[index - 1];
    const previous = previousName ? reached.get(previousName)?.size ?? 0 : null;
    return {
      eventName,
      sessions,
      fromPreviousPct: previous == null ? null : sequentialConversionPct(sessions, previous),
      fromLandingPct:
        landingSize > 0 ? sequentialConversionPct(sessions, landingSize) : null,
    };
  });
}

/**
 * Same-session landing-cohort sequential funnel.
 *
 * Qualifying cohort = non-test sessions with `landing_view` inside the reporting
 * interval and on/after measurementReliableFrom (and optional campaign filter).
 *
 * Each later stage only counts sessions that reached every prior stage in the chain.
 */
export function buildLandingCohortSequential(
  events: FirstPartyEventRow[],
  options: LandingCohortOptions,
): LandingCohortSequentialResult {
  const bySession = sessionEventSets(events);
  const landingCohort = new Set<string>();

  for (const [sessionId, info] of bySession) {
    if (!info.landingAt) continue;
    if (!inRange(info.landingAt, options.rangeFromIso, options.rangeToIso)) continue;
    if (!afterReliable(info.landingAt, options.measurementReliableFrom)) continue;
    if (options.campaignId && info.firstCampaignId !== options.campaignId) continue;
    if (options.excludeCampaignId && info.firstCampaignId === options.excludeCampaignId) continue;
    landingCohort.add(sessionId);
  }

  const has = (eventName: string) => (sessionId: string) =>
    bySession.get(sessionId)?.events.has(eventName) === true;

  const reachedPrimary = new Map<string, Set<string>>();
  let cursor = new Set(landingCohort);
  for (const stage of V1_PRIMARY_COHORT_STAGES) {
    if (stage === "landing_view") {
      reachedPrimary.set(stage, new Set(cursor));
      continue;
    }
    cursor = chainStage(cursor, has(stage));
    reachedPrimary.set(stage, cursor);
  }

  const cohortCounts = emptyStepCounts();
  for (const stage of V1_PRIMARY_COHORT_STAGES) {
    cohortCounts[stage] = reachedPrimary.get(stage)?.size ?? 0;
  }

  const rawCounts = emptyStepCounts();
  for (const stage of V1_PRIMARY_COHORT_STAGES) {
    const ids = new Set<string>();
    for (const [sessionId, info] of bySession) {
      if (!info.events.has(stage)) continue;
      // Raw = independent distincts among non-test rows in the reporting window
      const touchedInRange = info.ordered.some(
        (row) => row.eventName === stage && inRange(row.createdAt, options.rangeFromIso, options.rangeToIso),
      );
      if (touchedInRange) ids.add(sessionId);
    }
    rawCounts[stage] = ids.size;
  }

  // Photo diagnostic path: start from landing-cohort sessions that submitted a name.
  const photoReached = new Map<string, Set<string>>();
  let photoCursor = chainStage(landingCohort, has("pet_name_submitted"));
  for (const stage of V1_PHOTO_PATH_STAGES) {
    if (stage === "pet_name_submitted") {
      photoReached.set(stage, new Set(photoCursor));
      continue;
    }
    photoCursor = chainStage(photoCursor, has(stage));
    photoReached.set(stage, photoCursor);
  }

  const landingSize = landingCohort.size;

  return {
    cohortCounts,
    rawCounts,
    primaryStages: stageRows(V1_PRIMARY_COHORT_STAGES, reachedPrimary, landingSize),
    photoPathStages: stageRows(V1_PHOTO_PATH_STAGES, photoReached, landingSize),
    landingCohortSize: landingSize,
    landingCohortSessionIds: [...landingCohort],
  };
}

/** Map cohort primary stages onto FunnelStepCounts for existing dashboard builders. */
export function cohortCountsToFunnelStepCounts(stages: CohortStageRow[]): FunnelStepCounts {
  const counts = emptyStepCounts();
  for (const stage of stages) {
    if (stage.eventName in counts) {
      counts[stage.eventName as keyof FunnelStepCounts] = stage.sessions;
    }
  }
  return counts;
}
