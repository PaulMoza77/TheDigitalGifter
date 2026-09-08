/**
 * GA4 Data API helpers for the public /christmas hub.
 * Reuses the same service-account env vars as pet analytics.
 * Never log private keys. Never expose to the browser.
 */
import { ga4ConfigStatus, googleAccessToken } from "../pet/ga4Data.ts";

const CHRISTMAS_PATHS = ["/christmas", "/christmas/"];
const CUSTOM_EVENTS = [
  "christmas_page_view",
  "christmas_join_started",
  "christmas_join_completed",
  "christmas_google_auth_started",
  "christmas_google_auth_completed",
  "christmas_return_visit",
] as const;

type Ga4Row = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
};

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function toInt(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function dim(values: Array<{ value?: string }> | undefined, index: number, fallback = "(not set)"): string {
  const v = asString(values?.[index]?.value);
  return v || fallback;
}

function yyyymmddToIso(raw: string): string {
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  return raw;
}

function christmasPathFilter() {
  return {
    orGroup: {
      expressions: CHRISTMAS_PATHS.map((value) => ({
        filter: {
          fieldName: "pagePath",
          stringFilter: { matchType: "EXACT", value, caseSensitive: false },
        },
      })),
    },
  };
}

async function runReport(body: Record<string, unknown>): Promise<Ga4Row[]> {
  const status = ga4ConfigStatus();
  if (!status.configured || !status.propertyId) {
    throw new Error(`GA4 not configured: missing ${status.missing.join(", ")}`);
  }
  const token = await googleAccessToken();
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${status.propertyId}:runReport`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 runReport failed (${res.status}): ${text.slice(0, 220)}`);
  }
  const json = (await res.json()) as { rows?: Ga4Row[] };
  return json.rows || [];
}

async function runRealtime(body: Record<string, unknown>): Promise<Ga4Row[]> {
  const status = ga4ConfigStatus();
  if (!status.configured || !status.propertyId) {
    throw new Error(`GA4 not configured: missing ${status.missing.join(", ")}`);
  }
  const token = await googleAccessToken();
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${status.propertyId}:runRealtimeReport`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 realtime failed (${res.status}): ${text.slice(0, 220)}`);
  }
  const json = (await res.json()) as { rows?: Ga4Row[] };
  return json.rows || [];
}

export type ChristmasGa4Totals = {
  pageViews: number;
  totalUsers: number;
  sessions: number;
  engagedSessions: number | null;
  engagementRate: number | null;
  averageEngagementTimeSec: number | null;
  returningUsers: number | null;
  newUsers: number | null;
};

export type ChristmasGa4Breakdown = { key: string; users: number; views: number };

export type ChristmasGa4Daily = { date: string; views: number; users: number };

export type ChristmasGa4EventCounts = Record<(typeof CUSTOM_EVENTS)[number], number>;

export type ChristmasGa4Report = {
  totals: ChristmasGa4Totals;
  daily: ChristmasGa4Daily[];
  countries: ChristmasGa4Breakdown[];
  cities: ChristmasGa4Breakdown[];
  devices: ChristmasGa4Breakdown[];
  sources: ChristmasGa4Breakdown[];
  sourceMedium: ChristmasGa4Breakdown[];
  campaigns: ChristmasGa4Breakdown[];
  referrers: ChristmasGa4Breakdown[];
  eventCounts: ChristmasGa4EventCounts | null;
  eventMetricsAvailable: boolean;
};

function emptyEvents(): ChristmasGa4EventCounts {
  return {
    christmas_page_view: 0,
    christmas_join_started: 0,
    christmas_join_completed: 0,
    christmas_google_auth_started: 0,
    christmas_google_auth_completed: 0,
    christmas_return_visit: 0,
  };
}

function breakdownFromRows(rows: Ga4Row[], usersIndex = 0, viewsIndex = 1): ChristmasGa4Breakdown[] {
  const map = new Map<string, ChristmasGa4Breakdown>();
  for (const row of rows) {
    const key = dim(row.dimensionValues, 0);
    const existing = map.get(key) || { key, users: 0, views: 0 };
    existing.users += toInt(row.metricValues?.[usersIndex]?.value);
    existing.views += toInt(row.metricValues?.[viewsIndex]?.value);
    map.set(key, existing);
  }
  return [...map.values()].sort((a, b) => b.users - a.users || b.views - a.views).slice(0, 10);
}

export async function fetchChristmasGa4Report(input: { since: string; until: string }): Promise<ChristmasGa4Report> {
  const dateRanges = [{ startDate: input.since, endDate: input.until }];
  const pathFilter = christmasPathFilter();

  const [totalsRows, dailyRows, countryRows, cityRows, deviceRows, sourceRows, sourceMediumRows, campaignRows, referrerRows] =
    await Promise.all([
      runReport({
        dateRanges,
        metrics: [
          { name: "screenPageViews" },
          { name: "totalUsers" },
          { name: "sessions" },
          { name: "engagedSessions" },
          { name: "engagementRate" },
          { name: "userEngagementDuration" },
        ],
        dimensionFilter: pathFilter,
        limit: 10,
      }),
      runReport({
        dateRanges,
        dimensions: [{ name: "date" }],
        metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }],
        dimensionFilter: pathFilter,
        orderBys: [{ dimension: { dimensionName: "date" } }],
        limit: 400,
      }),
      runReport({
        dateRanges,
        dimensions: [{ name: "country" }],
        metrics: [{ name: "totalUsers" }, { name: "screenPageViews" }],
        dimensionFilter: pathFilter,
        limit: 15,
      }),
      runReport({
        dateRanges,
        dimensions: [{ name: "city" }],
        metrics: [{ name: "totalUsers" }, { name: "screenPageViews" }],
        dimensionFilter: pathFilter,
        limit: 15,
      }),
      runReport({
        dateRanges,
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "totalUsers" }, { name: "screenPageViews" }],
        dimensionFilter: pathFilter,
        limit: 10,
      }),
      runReport({
        dateRanges,
        dimensions: [{ name: "sessionSource" }],
        metrics: [{ name: "totalUsers" }, { name: "screenPageViews" }],
        dimensionFilter: pathFilter,
        limit: 15,
      }),
      runReport({
        dateRanges,
        dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
        metrics: [{ name: "totalUsers" }, { name: "screenPageViews" }],
        dimensionFilter: pathFilter,
        limit: 15,
      }),
      runReport({
        dateRanges,
        dimensions: [{ name: "sessionCampaignName" }],
        metrics: [{ name: "totalUsers" }, { name: "screenPageViews" }],
        dimensionFilter: pathFilter,
        limit: 15,
      }),
      runReport({
        dateRanges,
        dimensions: [{ name: "pageReferrer" }],
        metrics: [{ name: "totalUsers" }, { name: "screenPageViews" }],
        dimensionFilter: pathFilter,
        limit: 15,
      }),
    ]);

  const totalsRow = totalsRows[0];
  const pageViews = toInt(totalsRow?.metricValues?.[0]?.value);
  const totalUsers = toInt(totalsRow?.metricValues?.[1]?.value);
  const sessions = toInt(totalsRow?.metricValues?.[2]?.value);
  const engagedSessions = totalsRow ? toInt(totalsRow.metricValues?.[3]?.value) : null;
  const engagementRateRaw = totalsRow ? Number(totalsRow.metricValues?.[4]?.value) : null;
  const engagementDuration = totalsRow ? toInt(totalsRow.metricValues?.[5]?.value) : 0;

  let returningUsers: number | null = null;
  let newUsers: number | null = null;
  try {
    const nvRows = await runReport({
      dateRanges,
      dimensions: [{ name: "newVsReturning" }],
      metrics: [{ name: "totalUsers" }],
      dimensionFilter: pathFilter,
      limit: 10,
    });
    newUsers = 0;
    returningUsers = 0;
    for (const row of nvRows) {
      const label = dim(row.dimensionValues, 0).toLowerCase();
      const users = toInt(row.metricValues?.[0]?.value);
      if (label.includes("return")) returningUsers += users;
      else if (label.includes("new")) newUsers += users;
    }
  } catch {
    returningUsers = null;
    newUsers = null;
  }

  let eventCounts: ChristmasGa4EventCounts | null = null;
  let eventMetricsAvailable = false;
  try {
    const eventRows = await runReport({
      dateRanges,
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            pathFilter,
            {
              filter: {
                fieldName: "eventName",
                inListFilter: { values: [...CUSTOM_EVENTS] },
              },
            },
          ],
        },
      },
      limit: 50,
    });
    eventCounts = emptyEvents();
    eventMetricsAvailable = true;
    for (const row of eventRows) {
      const name = dim(row.dimensionValues, 0) as keyof ChristmasGa4EventCounts;
      if (name in eventCounts) eventCounts[name] = toInt(row.metricValues?.[0]?.value);
    }
  } catch {
    eventCounts = null;
    eventMetricsAvailable = false;
  }

  const sourceMedium = sourceMediumRows.map((row) => {
    const source = dim(row.dimensionValues, 0);
    const medium = dim(row.dimensionValues, 1);
    return {
      key: `${source} / ${medium}`,
      users: toInt(row.metricValues?.[0]?.value),
      views: toInt(row.metricValues?.[1]?.value),
    };
  }).sort((a, b) => b.users - a.users).slice(0, 10);

  return {
    totals: {
      pageViews,
      totalUsers,
      sessions,
      engagedSessions,
      engagementRate:
        engagementRateRaw != null && Number.isFinite(engagementRateRaw) ? engagementRateRaw * 100 : null,
      averageEngagementTimeSec:
        totalUsers > 0 && engagementDuration > 0 ? Math.round(engagementDuration / Math.max(totalUsers, 1)) : null,
      returningUsers,
      newUsers,
    },
    daily: dailyRows.map((row) => ({
      date: yyyymmddToIso(dim(row.dimensionValues, 0, "")),
      views: toInt(row.metricValues?.[0]?.value),
      users: toInt(row.metricValues?.[1]?.value),
    })).filter((row) => row.date),
    countries: breakdownFromRows(countryRows),
    cities: breakdownFromRows(cityRows).filter((row) => row.key.toLowerCase() !== "(not set)"),
    devices: breakdownFromRows(deviceRows),
    sources: breakdownFromRows(sourceRows),
    sourceMedium,
    campaigns: breakdownFromRows(campaignRows).filter((row) => row.key.toLowerCase() !== "(not set)" && row.key.toLowerCase() !== "(direct)"),
    referrers: breakdownFromRows(referrerRows).filter((row) => {
      const key = row.key.toLowerCase();
      return key && key !== "(not set)" && key !== "(direct)" && !key.includes("thedigitalgifter.com");
    }),
    eventCounts,
    eventMetricsAvailable,
  };
}

export type ChristmasRealtime = {
  activeUsers: number;
  viewsLast30m: number | null;
  countries: Array<{ key: string; users: number }>;
};

export async function fetchChristmasGa4Realtime(): Promise<ChristmasRealtime> {
  const rows = await runRealtime({
    dimensions: [{ name: "country" }],
    metrics: [{ name: "activeUsers" }],
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        stringFilter: { matchType: "EXACT", value: "christmas_page_view" },
      },
    },
    limit: 10,
  });
  let activeUsers = 0;
  const countries: Array<{ key: string; users: number }> = [];
  for (const row of rows) {
    const users = toInt(row.metricValues?.[0]?.value);
    activeUsers += users;
    countries.push({ key: dim(row.dimensionValues, 0), users });
  }
  countries.sort((a, b) => b.users - a.users);

  let viewsLast30m: number | null = 0;
  try {
    const viewRows = await runRealtime({
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          stringFilter: { matchType: "EXACT", value: "christmas_page_view" },
        },
      },
      limit: 5,
    });
    viewsLast30m = toInt(viewRows[0]?.metricValues?.[0]?.value);
  } catch {
    viewsLast30m = null;
  }

  return { activeUsers, viewsLast30m, countries: countries.slice(0, 5) };
}

export { ga4ConfigStatus };
