/**
 * First-party Christmas countdown KPIs.
 * Called only after assertAdmin. Prefers the admin RPC, then service-role table
 * reads so a SECURITY DEFINER is_admin() check against the service JWT cannot
 * blank the dashboard with "forbidden".
 */

export type ChristmasFirstPartyKpis = {
  signups_total: number;
  signups_email: number;
  signups_google: number;
  signups_returning: number;
  first_party_page_view_sessions: number;
  join_started_sessions: number;
  join_completed_sessions: number;
  google_auth_started_sessions: number;
  google_auth_completed_sessions: number;
  return_visit_sessions: number;
};

function emptyKpis(): ChristmasFirstPartyKpis {
  return {
    signups_total: 0,
    signups_email: 0,
    signups_google: 0,
    signups_returning: 0,
    first_party_page_view_sessions: 0,
    join_started_sessions: 0,
    join_completed_sessions: 0,
    google_auth_started_sessions: 0,
    google_auth_completed_sessions: 0,
    return_visit_sessions: 0,
  };
}

function asInt(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

export function normalizeChristmasFirstPartyKpis(raw: unknown): ChristmasFirstPartyKpis | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (!("signups_total" in row) && !("signups_email" in row)) return null;
  return {
    signups_total: asInt(row.signups_total),
    signups_email: asInt(row.signups_email),
    signups_google: asInt(row.signups_google),
    signups_returning: asInt(row.signups_returning),
    first_party_page_view_sessions: asInt(row.first_party_page_view_sessions),
    join_started_sessions: asInt(row.join_started_sessions),
    join_completed_sessions: asInt(row.join_completed_sessions),
    google_auth_started_sessions: asInt(row.google_auth_started_sessions),
    google_auth_completed_sessions: asInt(row.google_auth_completed_sessions),
    return_visit_sessions: asInt(row.return_visit_sessions),
  };
}

function distinctSessions(
  rows: Array<{ event_name?: string | null; funnel_session_id?: string | null; pathname?: string | null }>,
  eventName: string,
  christmasPathOnly = false,
): number {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.event_name !== eventName) continue;
    if (christmasPathOnly) {
      const path = String(row.pathname || "");
      if (path !== "/christmas" && path !== "/christmas/") continue;
    }
    if (row.funnel_session_id) ids.add(String(row.funnel_session_id));
  }
  return ids.size;
}

export function kpisFromSignupAndEventRows(
  signups: Array<{ signup_method?: string | null; created_at?: string | null; last_seen_at?: string | null }>,
  events: Array<{ event_name?: string | null; funnel_session_id?: string | null; pathname?: string | null }>,
): ChristmasFirstPartyKpis {
  const kpis = emptyKpis();
  kpis.signups_total = signups.length;
  kpis.signups_email = signups.filter((row) => row.signup_method === "email").length;
  kpis.signups_google = signups.filter((row) => row.signup_method === "google").length;
  kpis.signups_returning = signups.filter((row) => {
    const created = Date.parse(String(row.created_at || ""));
    const seen = Date.parse(String(row.last_seen_at || ""));
    return Number.isFinite(created) && Number.isFinite(seen) && seen - created > 12 * 60 * 60 * 1000;
  }).length;
  kpis.first_party_page_view_sessions = distinctSessions(events, "christmas_page_view", true);
  kpis.join_started_sessions = distinctSessions(events, "christmas_join_started");
  kpis.join_completed_sessions = distinctSessions(events, "christmas_join_completed");
  kpis.google_auth_started_sessions = distinctSessions(events, "christmas_google_auth_started");
  kpis.google_auth_completed_sessions = distinctSessions(events, "christmas_google_auth_completed");
  kpis.return_visit_sessions = distinctSessions(events, "christmas_return_visit");
  return kpis;
}

// deno-lint-ignore no-explicit-any
export async function loadChristmasFirstPartyKpis(
  service: any,
  input: { fromIso: string; toIso: string; campaignYear: number },
): Promise<{ data: ChristmasFirstPartyKpis | null; error: string | null }> {
  const rpc = await service.rpc("admin_christmas_countdown_kpis", {
    p_from: input.fromIso,
    p_to: input.toIso,
    p_campaign_year: input.campaignYear,
  });
  if (!rpc.error) {
    const normalized = normalizeChristmasFirstPartyKpis(rpc.data);
    if (normalized) return { data: normalized, error: null };
  }

  const signupsRes = await service
    .from("christmas_countdown_signups")
    .select("signup_method,created_at,last_seen_at")
    .eq("campaign_year", input.campaignYear)
    .gte("created_at", input.fromIso)
    .lte("created_at", input.toIso);

  if (signupsRes.error) {
    return {
      data: null,
      error: signupsRes.error.message || rpc.error?.message || "Signup query failed",
    };
  }

  const eventsRes = await service
    .from("christmas_funnel_events")
    .select("event_name,funnel_session_id,pathname")
    .gte("created_at", input.fromIso)
    .lte("created_at", input.toIso)
    .eq("is_test", false);

  const events = eventsRes.error ? [] : eventsRes.data || [];
  return {
    data: kpisFromSignupAndEventRows(signupsRes.data || [], events),
    error: null,
  };
}
