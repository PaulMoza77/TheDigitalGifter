export function conversionRate(signups: number | null | undefined, uniqueUsers: number | null | undefined): number | null {
  if (signups == null || !Number.isFinite(signups) || signups < 0) return null;
  if (uniqueUsers == null || !Number.isFinite(uniqueUsers) || uniqueUsers <= 0) return null;
  return (signups / uniqueUsers) * 100;
}

export function stepConversionPct(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || current < 0) return null;
  if (!Number.isFinite(previous) || previous <= 0) return null;
  return (current / previous) * 100;
}

export function formatPct(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

export type FunnelStep = {
  key: "visitors" | "join_started" | "joined" | "returned";
  label: string;
  count: number | null;
  fromPreviousPct: number | null;
  ofBasePct: number | null;
};

export function buildCountdownFunnel(input: {
  visitors: number | null;
  joinStarted: number | null;
  joined: number | null;
  returned: number | null;
}): FunnelStep[] {
  const visitors = input.visitors;
  const started = input.joinStarted;
  const joined = input.joined;
  const returned = input.returned;
  return [
    {
      key: "visitors",
      label: "Visitors",
      count: visitors,
      fromPreviousPct: null,
      ofBasePct: null,
    },
    {
      key: "join_started",
      label: "Join Started",
      count: started,
      fromPreviousPct: started == null || visitors == null ? null : stepConversionPct(started, visitors),
      ofBasePct: started == null || visitors == null ? null : stepConversionPct(started, visitors),
    },
    {
      key: "joined",
      label: "Joined",
      count: joined,
      fromPreviousPct: joined == null || started == null ? null : stepConversionPct(joined, started),
      ofBasePct: joined == null || visitors == null ? null : stepConversionPct(joined, visitors),
    },
    {
      key: "returned",
      label: "Returned",
      count: returned,
      fromPreviousPct: returned == null || joined == null ? null : stepConversionPct(returned, joined),
      ofBasePct: returned == null || visitors == null ? null : stepConversionPct(returned, visitors),
    },
  ];
}

export type NamedCount = { key: string; label: string; users: number; views: number };

export function topN(rows: NamedCount[], n = 8): NamedCount[] {
  return [...rows]
    .filter((row) => row.users > 0 || row.views > 0)
    .sort((a, b) => b.users - a.users || b.views - a.views)
    .slice(0, n);
}

export type DailyPoint = { date: string; views: number; users: number };

export function mergeDailyPoints(rows: DailyPoint[]): DailyPoint[] {
  const map = new Map<string, DailyPoint>();
  for (const row of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) continue;
    const existing = map.get(row.date) || { date: row.date, views: 0, users: 0 };
    existing.views += Math.max(0, row.views);
    existing.users += Math.max(0, row.users);
    map.set(row.date, existing);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function yyyymmddToIso(raw: string): string {
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  return raw;
}

export function mapGa4DimensionMetricRow(row: {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
}): { dimensions: string[]; metrics: number[] } {
  const dimensions = (row.dimensionValues || []).map((d) => String(d?.value || "").trim() || "(not set)");
  const metrics = (row.metricValues || []).map((m) => {
    const n = Number(m?.value);
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
  return { dimensions, metrics };
}

export type SignupMethodCounts = { email: number; google: number; total: number };

export function signupMethodCounts(rows: Array<{ signup_method?: string | null }>): SignupMethodCounts {
  let email = 0;
  let google = 0;
  for (const row of rows) {
    const method = String(row.signup_method || "").toLowerCase();
    if (method === "google") google += 1;
    else if (method === "email") email += 1;
  }
  return { email, google, total: email + google };
}

export function userStatusLabel(row: { user_id?: string | null }): "account" | "email-only" {
  return row.user_id ? "account" : "email-only";
}

export function returningLabel(row: { created_at?: string | null; last_seen_at?: string | null }): "returning" | "new" {
  const created = Date.parse(String(row.created_at || ""));
  const seen = Date.parse(String(row.last_seen_at || ""));
  if (!Number.isFinite(created) || !Number.isFinite(seen)) return "new";
  return seen - created > 12 * 60 * 60 * 1000 ? "returning" : "new";
}
