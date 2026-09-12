import {
  buildV4SequentialSteps,
  enforceMonotonicSequential,
  rankV4DropOffPoints,
  type V4DropOffPoint,
  type V4SequentialStep,
} from "./sequentialFunnel";
import {
  PET_V4_LAUNCH_DATE,
  PET_V4_META_CAMPAIGN_ID,
  type V4SequentialStage,
  V4_SEQUENTIAL_STAGES,
} from "./types";

export type V4DashboardReport = {
  campaignId: string;
  campaignName: string;
  launchAt: string;
  firstEventAt: string | null;
  sequentialSteps: V4SequentialStep[];
  dropOffs: V4DropOffPoint[];
  rawEventCounts: Record<string, number>;
  firstParty: {
    landing_sessions: number;
    unique_visitors: number;
    engaged_sessions: number;
    upload_starts: number;
    upload_completes: number;
    generations: number;
    teaser_views: number;
    offer_views: number;
    checkout_cta_clicks: number;
    stripe_checkout_sessions: number;
    purchases: number;
    revenue_cents: number;
  };
  behavior: {
    scroll_depth: Record<string, number>;
    engagement: {
      median_engaged_ms: number | null;
      avg_engaged_ms: number | null;
      bounced: number;
      single_action: number;
      multi_action: number;
    };
    ctas: Array<{ location: string; exposures: number; clicks: number; ctr: number | null }>;
    upload: Record<string, number>;
    generation: Record<string, number | null>;
    checkout: Record<string, number>;
  };
  timeToAction: Record<string, { median_sec: number | null; p75_sec: number | null }>;
  journeys: Array<{
    session_short: string;
    placement?: string | null;
    duration_seconds?: number | null;
    revenue_cents?: number | null;
    purchased?: boolean;
    reached_checkout?: boolean;
    uploaded?: boolean;
    bounced?: boolean;
    abandoned_offer?: boolean;
    events?: Array<{ event_name: string; created_at: string; scroll_pct?: number | null }>;
  }>;
  breakdowns: {
    device: Array<{ key: string; landing: number; uploads?: number; checkouts?: number; purchases?: number }>;
    browser: Array<{ key: string; landing: number; uploads?: number; checkouts?: number; purchases?: number }>;
    placement: Array<{ key: string; landing: number; uploads?: number; checkouts?: number; purchases?: number }>;
    country: Array<{ key: string; landing: number; uploads?: number; checkouts?: number; purchases?: number }>;
    ads: Array<{
      ad_id?: string;
      ad_name?: string;
      spend_cents?: number;
      landing?: number;
      uploads?: number;
      checkouts?: number;
      purchases?: number;
      cpa_cents?: number | null;
    }>;
  };
  recent60m: {
    visitors?: number;
    uploads?: number;
    offers?: number;
    checkout_clicks?: number;
    purchases?: number;
    last_event_at?: string | null;
  };
  dataQuality: {
    unattributed_sessions?: number;
    duplicate_events_detected?: number;
    checkout_sessions_without_click?: number;
    purchases_without_session?: number;
    first_party_freshness?: string | null;
    events_in_range?: number;
  };
  meta: {
    spend_cents: number;
    impressions: number;
    reach: number;
    link_clicks: number;
    landing_page_views: number;
    purchases: number;
    purchase_value_cents: number;
  };
  economics: {
    costPerLanding: number | null;
    costPerUpload: number | null;
    costPerCheckout: number | null;
    cpa: number | null;
    revenuePerVisitor: number | null;
    roas: number | null;
    ctr: number | null;
    cpc: number | null;
    cpm: number | null;
  };
};

function n(value: unknown): number {
  const x = Number(value);
  return Number.isFinite(x) ? x : 0;
}

function nullableRatio(num: number, den: number): number | null {
  if (den <= 0) return null;
  return num / den;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeRawEventCounts(raw: unknown): Record<string, number> {
  if (Array.isArray(raw)) {
    const out: Record<string, number> = {};
    for (const row of raw) {
      const r = asRecord(row);
      const name = String(r.event_name || "");
      if (!name) continue;
      out[name] = n(r.unique_sessions ?? r.sessions ?? r.event_count);
    }
    return out;
  }
  const obj = asRecord(raw);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = n(v);
  return out;
}

function normalizeScrollDepth(raw: unknown, landing: number): Record<string, number> {
  if (Array.isArray(raw)) {
    const out: Record<string, number> = {};
    for (const row of raw) {
      const r = asRecord(row);
      const bucket = String(r.bucket || "");
      if (!bucket) continue;
      out[bucket] = n(r.pct_of_landing ?? (landing > 0 ? (n(r.sessions) / landing) * 100 : 0));
    }
    return out;
  }
  const obj = asRecord(raw);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = n(v);
  return out;
}

function normalizeBreakdown(raw: unknown): Array<{
  key: string;
  landing: number;
  uploads?: number;
  checkouts?: number;
  purchases?: number;
}> {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = asRecord(row);
    return {
      key: String(r.key || "unknown"),
      landing: n(r.landing ?? r.landing_sessions),
      uploads: n(r.uploads ?? r.upload_completes),
      checkouts: n(r.checkouts ?? r.checkout_clicks),
      purchases: n(r.purchases),
    };
  });
}

function normalizeTimeToAction(raw: unknown): Record<string, { median_sec: number | null; p75_sec: number | null }> {
  const obj = asRecord(raw);
  const keys = [
    "landing_to_first_interaction",
    "landing_to_upload",
    "upload_to_teaser",
    "teaser_to_offer",
    "offer_to_checkout_click",
    "landing_to_checkout",
    "landing_to_purchase",
  ] as const;
  const out: Record<string, { median_sec: number | null; p75_sec: number | null }> = {};
  for (const key of keys) {
    const nested = asRecord(obj[key]);
    if (Object.keys(nested).length) {
      out[key] = {
        median_sec: nested.median_sec == null ? null : n(nested.median_sec),
        p75_sec: nested.p75_sec == null ? null : n(nested.p75_sec),
      };
      continue;
    }
    const median = obj[`${key}_median_s`];
    const p75 = obj[`${key}_p75_s`];
    out[key] = {
      median_sec: median == null ? null : n(median),
      p75_sec: p75 == null ? null : n(p75),
    };
  }
  return out;
}

export function parseV4AnalyticsPayload(raw: unknown): V4DashboardReport {
  const payload = asRecord(raw);
  const seqRaw = asRecord(payload.sequential);
  const seqCounts = enforceMonotonicSequential({
    landing: n(seqRaw.landing),
    upload_started: n(seqRaw.upload_started),
    upload_completed: n(seqRaw.upload_completed),
    generation_completed: n(seqRaw.generation_completed),
    teaser_viewed: n(seqRaw.teaser_viewed),
    offer_viewed: n(seqRaw.offer_viewed),
    checkout_clicked: n(seqRaw.checkout_clicked),
    checkout_session_created: n(seqRaw.checkout_session_created),
    purchase: n(seqRaw.purchase),
  });
  for (const stage of V4_SEQUENTIAL_STAGES) {
    if (seqCounts[stage as V4SequentialStage] == null) seqCounts[stage as V4SequentialStage] = 0;
  }
  const sequentialSteps = buildV4SequentialSteps(seqCounts);

  const dropRaw = Array.isArray(payload.drop_offs) ? payload.drop_offs : [];
  const dropOffs: V4DropOffPoint[] =
    dropRaw.length > 0
      ? dropRaw.map((row, idx) => {
          const r = asRecord(row);
          return {
            rank: n(r.rank) || idx + 1,
            from: String(r.from || r.from_stage || "") as V4SequentialStage,
            to: String(r.to || r.to_stage || "") as V4SequentialStage,
            fromLabel: String(r.from_label || r.from || r.from_stage || ""),
            toLabel: String(r.to_label || r.to || r.to_stage || ""),
            lost: n(r.lost),
            dropOffPct: n(r.drop_off_pct),
          };
        })
      : rankV4DropOffPoints(sequentialSteps);

  const fp = asRecord(payload.first_party);
  const firstParty = {
    landing_sessions: n(fp.landing_sessions),
    unique_visitors: n(fp.unique_visitors),
    engaged_sessions: n(fp.engaged_sessions),
    upload_starts: n(fp.upload_starts),
    upload_completes: n(fp.upload_completes),
    generations: n(fp.generations),
    teaser_views: n(fp.teaser_views),
    offer_views: n(fp.offer_views),
    checkout_cta_clicks: n(fp.checkout_cta_clicks),
    stripe_checkout_sessions: n(fp.stripe_checkout_sessions),
    purchases: n(fp.purchases),
    revenue_cents: n(fp.revenue_cents),
  };

  const behaviorRaw = asRecord(payload.behavior);
  const engagementRaw = asRecord(behaviorRaw.engagement);
  const uploadRaw = asRecord(behaviorRaw.upload);
  const generationRaw = asRecord(behaviorRaw.generation);
  const checkoutRaw = asRecord(behaviorRaw.checkout_intent || behaviorRaw.checkout);
  const ctaRaw = Array.isArray(behaviorRaw.cta)
    ? behaviorRaw.cta
    : Array.isArray(behaviorRaw.ctas)
      ? behaviorRaw.ctas
      : [];

  const behavior = {
    scroll_depth: normalizeScrollDepth(behaviorRaw.scroll_depth, firstParty.landing_sessions),
    engagement: {
      median_engaged_ms: engagementRaw.median_engaged_ms == null ? null : n(engagementRaw.median_engaged_ms),
      avg_engaged_ms: engagementRaw.avg_engaged_ms == null ? null : n(engagementRaw.avg_engaged_ms),
      bounced: n(engagementRaw.bounced ?? engagementRaw.bounce),
      single_action: n(engagementRaw.single_action ?? engagementRaw.single),
      multi_action: n(engagementRaw.multi_action ?? engagementRaw.multi),
    },
    ctas: ctaRaw.map((row) => {
      const r = asRecord(row);
      const exposures = n(r.exposures);
      const clicks = n(r.clicks);
      return {
        location: String(r.location || "unknown"),
        exposures,
        clicks,
        ctr: exposures > 0 ? clicks / exposures : null,
      };
    }),
    upload: {
      opened: n(uploadRaw.opened),
      started: n(uploadRaw.started),
      completed: n(uploadRaw.completed),
      failed: n(uploadRaw.failed),
      abandoned: n(uploadRaw.abandoned),
    },
    generation: {
      started: n(generationRaw.started),
      completed: n(generationRaw.completed),
      failed: n(generationRaw.failed),
      left_early: n(generationRaw.left_early),
      median_duration_ms: generationRaw.median_duration_ms == null ? null : n(generationRaw.median_duration_ms),
    },
    checkout: {
      clicked: n(checkoutRaw.clicked),
      session_created: n(checkoutRaw.session_created),
      opened: n(checkoutRaw.opened),
      abandoned: n(checkoutRaw.abandoned),
    },
  };

  const journeysRaw = Array.isArray(payload.journeys) ? payload.journeys : [];
  const journeys = journeysRaw.map((row) => {
    const r = asRecord(row);
    const timeline = Array.isArray(r.timeline) ? r.timeline : Array.isArray(r.events) ? r.events : [];
    return {
      session_short: String(r.session_short || "").toUpperCase(),
      placement: r.placement == null ? null : String(r.placement),
      duration_seconds: r.duration_seconds == null ? null : n(r.duration_seconds),
      revenue_cents: r.revenue_cents == null ? null : n(r.revenue_cents),
      purchased: Boolean(r.purchased),
      reached_checkout: Boolean(r.reached_checkout),
      uploaded: Boolean(r.uploaded),
      bounced: Boolean(r.bounced),
      abandoned_offer: Boolean(r.abandoned_offer),
      events: timeline.map((ev) => {
        const e = asRecord(ev);
        return {
          event_name: String(e.event_name || ""),
          created_at: String(e.created_at || ""),
          scroll_pct: e.scroll_pct == null ? null : n(e.scroll_pct),
        };
      }),
    };
  });

  const breakdownsRaw = asRecord(payload.breakdowns);
  const meta = asRecord(payload.meta);
  const metaNorm = {
    spend_cents: n(meta.spend_cents),
    impressions: n(meta.impressions),
    reach: n(meta.reach),
    link_clicks: n(meta.link_clicks),
    landing_page_views: n(meta.landing_page_views),
    purchases: n(meta.purchases),
    purchase_value_cents: n(meta.purchase_value_cents),
  };

  const spend = metaNorm.spend_cents;
  const economics = {
    costPerLanding: nullableRatio(spend, firstParty.landing_sessions),
    costPerUpload: nullableRatio(spend, firstParty.upload_completes),
    costPerCheckout: nullableRatio(spend, firstParty.checkout_cta_clicks),
    cpa: nullableRatio(spend, firstParty.purchases),
    revenuePerVisitor: nullableRatio(
      firstParty.revenue_cents,
      firstParty.unique_visitors || firstParty.landing_sessions,
    ),
    roas: nullableRatio(firstParty.revenue_cents, spend),
    ctr: nullableRatio(metaNorm.link_clicks, metaNorm.impressions),
    cpc: nullableRatio(spend, metaNorm.link_clicks),
    cpm: metaNorm.impressions > 0 ? (spend / metaNorm.impressions) * 1000 : null,
  };

  const dq = asRecord(payload.data_quality);
  const recent = asRecord(payload.recent_60m);

  return {
    campaignId: String(payload.campaign_id || PET_V4_META_CAMPAIGN_ID),
    campaignName: "New Sales Campaign",
    launchAt: payload.launch_at ? String(payload.launch_at) : `${PET_V4_LAUNCH_DATE}T00:00:00.000Z`,
    firstEventAt: payload.first_event_at ? String(payload.first_event_at) : null,
    sequentialSteps,
    dropOffs,
    rawEventCounts: normalizeRawEventCounts(payload.raw_event_counts),
    firstParty,
    behavior,
    timeToAction: normalizeTimeToAction(payload.time_to_action),
    journeys,
    breakdowns: {
      device: normalizeBreakdown(breakdownsRaw.device),
      browser: normalizeBreakdown(breakdownsRaw.browser),
      placement: normalizeBreakdown(breakdownsRaw.placement),
      country: normalizeBreakdown(breakdownsRaw.country),
      ads: Array.isArray(breakdownsRaw.ads)
        ? breakdownsRaw.ads.map((row) => {
            const r = asRecord(row);
            return {
              ad_id: r.ad_id ? String(r.ad_id) : undefined,
              ad_name: r.ad_name ? String(r.ad_name) : undefined,
              spend_cents: n(r.spend_cents),
              landing: n(r.landing ?? r.landing_sessions),
              uploads: n(r.uploads),
              checkouts: n(r.checkouts),
              purchases: n(r.purchases),
              cpa_cents: r.cpa_cents == null ? null : n(r.cpa_cents),
            };
          })
        : [],
    },
    recent60m: {
      visitors: n(recent.visitors),
      uploads: n(recent.uploads),
      offers: n(recent.offers),
      checkout_clicks: n(recent.checkout_clicks),
      purchases: n(recent.purchases),
      last_event_at: recent.last_event_at ? String(recent.last_event_at) : null,
    },
    dataQuality: {
      unattributed_sessions: n(dq.unattributed_sessions),
      duplicate_events_detected: n(dq.duplicate_events_detected ?? dq.duplicate_event_keys),
      checkout_sessions_without_click: n(dq.checkout_sessions_without_click),
      purchases_without_session: n(dq.purchases_without_session),
      first_party_freshness: dq.first_party_freshness ? String(dq.first_party_freshness) : null,
      events_in_range: n(dq.events_in_range),
    },
    meta: metaNorm,
    economics,
  };
}

export function formatDurationSec(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return "—";
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

export function minutesAgoLabel(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "no events yet";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const mins = Math.max(0, Math.round((now - t) / 60000));
  if (mins <= 0) return "just now";
  if (mins === 1) return "1 minute ago";
  return `${mins} minutes ago`;
}
