import { clarityReport } from "./santaClarityReporting.ts";
import {
  type Integration,
  type Metric,
  type ReportRange,
  trafficGroup,
} from "./santaAnalyticsModel.ts";

type Env = (key: string) => string | undefined;
type GaRow = {
  dimensionValues?: Array<{ value: string }>;
  metricValues?: Array<{ value: string }>;
};
type GaReport = {
  rows?: GaRow[];
  rowCount?: number;
  metadata?: {
    timeZone?: string;
    subjectToThresholding?: boolean;
    dataLossFromOtherRow?: boolean;
    samplingMetadatas?: unknown[];
  };
};
const GA = "GA4 · 550164226";
const now = () => new Date().toISOString();
export function unavailable(source: string, detail: string): Integration {
  return {
    source,
    status: "unavailable",
    detail,
    updatedAt: null,
    metrics: [],
  };
}
const number = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error("invalid_metric");
  return n;
};
async function request(url: string, init: RequestInit): Promise<any> {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(12000) });
  // Provider error bodies can contain account identifiers or credentials; never return them.
  if (!r.ok) throw new Error(`provider_http_${r.status}`);
  return r.json();
}
function b64(data: Uint8Array) {
  return btoa(Array.from(data, (n) => String.fromCharCode(n)).join(""))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
async function googleToken(raw: string) {
  const account = JSON.parse(raw);
  if (!account.client_email || !account.private_key)
    throw new Error("invalid_service_account");
  const issued = Math.floor(Date.now() / 1000);
  const encode = (v: unknown) =>
    b64(new TextEncoder().encode(JSON.stringify(v)));
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iss: account.client_email, scope: "https://www.googleapis.com/auth/analytics.readonly", aud: "https://oauth2.googleapis.com/token", iat: issued, exp: issued + 3600 })}`;
  const pem = String(account.private_key)
    .replace(/\\n/g, "\n")
    .replace(/-----[^-]+-----|\s/g, "");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const result = await request("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${b64(new Uint8Array(signature))}`,
    }),
  });
  if (typeof result.access_token !== "string") throw new Error("token_missing");
  return result.access_token;
}
export const gaPathFilter = {
  filter: {
    fieldName: "pagePath",
    stringFilter: {
      matchType: "FULL_REGEXP",
      value: "^/(ro/)?christmas/santa-call/?$",
      caseSensitive: false,
    },
  },
};
export function validateGaReport(report: GaReport) {
  if (report.metadata?.timeZone !== "Europe/Bucharest")
    throw new Error("property_timezone_must_be_Europe_Bucharest");
  if ((report.rowCount || 0) > (report.rows || []).length)
    throw new Error("report_row_limit_exceeded");
  if (
    report.metadata?.dataLossFromOtherRow ||
    report.metadata?.subjectToThresholding ||
    report.metadata?.samplingMetadatas?.length
  )
    throw new Error("report_thresholded_or_sampled");
}
export async function ga4Report(
  range: ReportRange,
  env: Env,
): Promise<Integration> {
  const raw =
    env("SANTA_GA4_SERVICE_ACCOUNT_JSON") || env("GA4_SERVICE_ACCOUNT_JSON");
  if (!raw)
    return unavailable(
      GA,
      "Requires server-side SANTA_GA4_SERVICE_ACCOUNT_JSON with Viewer access to property 550164226 and Analytics Data API enabled. A ChatGPT connector does not automatically grant this application access.",
    );
  try {
    const token = await googleToken(raw);
    const run = async (
      dimensions: string[],
      metrics: string[],
      events?: string[],
    ) => {
      const eventFilter = {
        filter: { fieldName: "eventName", inListFilter: { values: events } },
      };
      const result: GaReport = await request(
        "https://analyticsdata.googleapis.com/v1beta/properties/550164226:runReport",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            dateRanges: [{ startDate: range.start, endDate: range.end }],
            dimensions: dimensions.map((name) => ({ name })),
            metrics: metrics.map((name) => ({ name })),
            dimensionFilter: events
              ? { andGroup: { expressions: [gaPathFilter, eventFilter] } }
              : gaPathFilter,
            limit: 2000,
          }),
        },
      );
      validateGaReport(result);
      return result.rows || [];
    };
    const [totals, events, daily, devices] = await Promise.all([
      run([], ["screenPageViews", "totalUsers", "sessions"]),
      run(["eventName"], ["eventCount"]),
      run(["date"], ["screenPageViews"]),
      run(["deviceCategory"], ["sessions"]),
    ]);
    const dimensions = [
      "sessionSource",
      "sessionMedium",
      "sessionCampaignName",
    ];
    const [traffic, checkouts, purchases] = await Promise.all([
      run(dimensions, ["totalUsers", "sessions"]),
      run(dimensions, ["eventCount"], ["begin_checkout"]),
      run(dimensions, ["eventCount"], ["purchase"]),
    ]);
    const updatedAt = now();
    const make = (
      id: string,
      label: string,
      value: number | null,
      definition: string,
      missing?: string,
    ): Metric => ({
      id,
      label,
      value,
      unit: "count",
      source: GA,
      definition,
      updatedAt,
      unavailable: missing,
    });
    const counts = new Map(
      events.map((r) => [
        r.dimensionValues?.[0]?.value,
        number(r.metricValues?.[0]?.value),
      ]),
    );
    // Canonical names replace legacy names; a browser sends one name, never both aliases.
    const count = (...keys: string[]) =>
      keys.reduce((n, k) => n + (counts.get(k) || 0), 0);
    const custom = (id: string, label: string, keys: string[]) => {
      const observed = keys.some((k) => counts.has(k));
      return make(
        id,
        label,
        observed ? count(...keys) : null,
        `Observed GA4 event count: ${keys.join(" + ")}. Consent-dependent; not a unique-user cohort.`,
        observed
          ? undefined
          : "Event not observed; absence is not proof of instrumentation coverage",
      );
    };
    const key = (r: GaRow) =>
      JSON.stringify(r.dimensionValues?.map((d) => d.value));
    const lookup = (rows: GaRow[]) =>
      new Map(rows.map((r) => [key(r), number(r.metricValues?.[0]?.value)]));
    const checkoutMap = lookup(checkouts),
      purchaseMap = lookup(purchases);
    return {
      status: "connected",
      source: GA,
      detail:
        "Exact Santa landing pagePath (query excluded); session campaign dimensions retained separately. GA4 processing may lag 24–48 hours. Users are queried for the full interval, never summed by day. Purchases here are GA4-attributed, not the payment ledger.",
      updatedAt,
      metrics: [
        make(
          "page_views",
          "Page views",
          number(totals[0]?.metricValues?.[0]?.value || 0),
          "GA4 screenPageViews on the Santa landing path.",
        ),
        make(
          "visitors",
          "Unique visitors",
          number(totals[0]?.metricValues?.[1]?.value || 0),
          "GA4 totalUsers across the complete selected range; consent and GA identity rules apply.",
        ),
        make(
          "sessions",
          "Sessions",
          number(totals[0]?.metricValues?.[2]?.value || 0),
          "GA4 sessions with a Santa landing-page event; not Stripe sessions.",
        ),
        custom("cta", "CTA clicks", ["santa_cta_click", "santa_call_cta"]),
        custom("form_start", "Form started", ["santa_form_start"]),
        custom("form_complete", "Form completed", ["santa_form_complete"]),
        make(
          "ga_checkout",
          "Checkout initiated (GA4)",
          count("begin_checkout"),
          "GA4 begin_checkout count on the Santa landing. Consent-dependent; separate from server-created sessions.",
        ),
      ],
      daily: daily
        .map((r) => {
          const d = r.dimensionValues![0].value;
          return {
            date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
            value: number(r.metricValues![0].value),
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date)),
      devices: devices.map((r) => ({
        device: r.dimensionValues![0].value,
        sessions: number(r.metricValues![0].value),
      })),
      traffic: traffic.map((r) => {
        const [source, medium, campaign] = r.dimensionValues!.map(
          (d) => d.value,
        );
        return {
          source,
          medium,
          campaign,
          group: trafficGroup(source, medium),
          visitors: number(r.metricValues![0].value),
          sessions: number(r.metricValues![1].value),
          checkouts: checkoutMap.get(key(r)) || 0,
          purchases: purchaseMap.get(key(r)) || 0,
        };
      }),
    };
  } catch (e) {
    return {
      ...unavailable(
        GA,
        `Reporting failed: ${safeError(e)}. No unfiltered or estimated fallback used.`,
      ),
      status: "error",
    };
  }
}
function safeError(e: unknown) {
  const m = e instanceof Error ? e.message : "unknown";
  return /^[a-zA-Z0-9_]+$/.test(m) ? m : "provider_or_configuration_error";
}

export async function metaReport(
  range: ReportRange,
  env: Env,
): Promise<Integration> {
  const source = "Meta Insights · 120255274308780066";
  const token = env("SANTA_META_REPORTING_TOKEN");
  if (!token)
    return unavailable(
      source,
      "Requires SANTA_META_REPORTING_TOKEN with ads_read on act_1877103439548293 (not a Pixel CAPI token). No ad write permissions are used.",
    );
  try {
    const headers = { Authorization: `Bearer ${token}` };
    const base = "https://graph.facebook.com/v23.0";
    const account = await request(
      `${base}/act_1877103439548293?fields=currency,timezone_name`,
      { headers },
    );
    if (account.currency !== "USD" || account.timezone_name !== range.timeZone)
      throw new Error("account_currency_or_timezone_mismatch");
    const q = new URLSearchParams({
      fields:
        "spend,impressions,reach,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click,actions,action_values",
      time_range: JSON.stringify({ since: range.start, until: range.end }),
      use_account_attribution_setting: "true",
      limit: "1",
    });
    const campaign = await request(
      `${base}/120255274308780066?fields=account_id,effective_status`,
      { headers },
    );
    if (campaign.account_id !== "1877103439548293")
      throw new Error("campaign_account_mismatch");
    const result = await request(`${base}/120255274308780066/insights?${q}`, {
      headers,
    });
    const row = result.data?.[0];
    if (!row)
      return {
        ...unavailable(
          source,
          `No Insights rows for this interval. Campaign status: ${campaign.effective_status}. No fabricated zero-spend row.`,
        ),
        updatedAt: now(),
      };
    const updatedAt = now();
    const action = (key: string) => {
      const a = row.actions?.find(
        (a: { action_type: string }) => a.action_type === key,
      );
      return a ? number(a.value) : 0;
    };
    const spend = number(row.spend),
      purchases = action("purchase"),
      clicks = number(row.inline_link_clicks || 0);
    const revenue = row.action_values?.find(
      (a: { action_type: string }) => a.action_type === "purchase",
    );
    const metric = (
      id: string,
      label: string,
      value: number | null,
      unit: Metric["unit"],
      definition: string,
    ): Metric => ({ id, label, value, unit, definition, source, updatedAt });
    return {
      status: "connected",
      source,
      updatedAt,
      detail: `Campaign ${campaign.effective_status}; account attribution settings. Meta-attributed results are independent of confirmed Stripe orders. Read-only reporting.`,
      metrics: [
        metric(
          "meta_spend",
          "Spend",
          spend,
          "USD",
          "Campaign spend reported by Meta in account currency USD.",
        ),
        metric(
          "meta_impressions",
          "Impressions",
          number(row.impressions),
          "count",
          "Meta campaign impressions.",
        ),
        metric(
          "meta_reach",
          "Reach",
          number(row.reach),
          "count",
          "Meta unique reach queried for the whole interval; not daily-summed.",
        ),
        metric(
          "meta_clicks",
          "Link clicks",
          clicks,
          "count",
          "Meta inline_link_clicks.",
        ),
        metric(
          "meta_lpv",
          "Landing page views",
          action("landing_page_view"),
          "count",
          "Meta landing_page_view action, not GA4 page views.",
        ),
        metric(
          "meta_ctr",
          "Link CTR",
          number(row.impressions)
            ? (clicks / number(row.impressions)) * 100
            : null,
          "percent",
          "Link clicks / impressions.",
        ),
        metric(
          "meta_cpc",
          "Cost per link click",
          clicks ? spend / clicks : null,
          "USD",
          "Spend / link clicks.",
        ),
        metric(
          "meta_purchases",
          "Meta-attributed purchases",
          purchases,
          "count",
          "Meta purchase action under account attribution settings; not Stripe confirmed purchases.",
        ),
        metric(
          "meta_cpp",
          "Cost per attributed purchase",
          purchases ? spend / purchases : null,
          "USD",
          "Meta spend / Meta purchase action count.",
        ),
        metric(
          "meta_roas",
          "ROAS (ratio)",
          spend && revenue ? number(revenue.value) / spend : null,
          "count",
          "Meta-attributed purchase value in account USD / USD spend; no Stripe RON mixing.",
        ),
      ],
    };
  } catch (e) {
    return {
      ...unavailable(
        source,
        `Reporting failed: ${safeError(e)}. No currency/timezone mixing.`,
      ),
      status: "error",
    };
  }
}

const cache = new Map<
  string,
  {
    until: number;
    value: { ga4: Integration; meta: Integration; clarity: Integration };
  }
>();
export async function reportingSources(range: ReportRange, env: Env, service?: any) {
  const key = `${range.start}:${range.end}`;
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  const [ga4, meta, clarity] = await Promise.all([
    ga4Report(range, env),
    metaReport(range, env),
    clarityReport(env, service),
  ]);
  const value = { ga4, meta, clarity };
  if (cache.size >= 24) cache.delete(cache.keys().next().value!);
  cache.set(key, { until: Date.now() + 300000, value });
  return value;
}
