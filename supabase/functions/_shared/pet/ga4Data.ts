/**
 * GA4 Data API — server-only via Google service account.
 * Measurement ID G-YF2GRM2TL4 alone is NOT sufficient; needs GA4_PROPERTY_ID + SA credentials.
 * Never log private keys. Never expose to the browser.
 */

export type Ga4DailyMetricRow = {
  metric_date: string;
  source: string;
  medium: string;
  campaign: string;
  device_category: string;
  country: string;
  sessions: number;
  total_users: number;
  screen_page_views: number;
  landing_views: number;
  pet_name_submitted?: number | null;
  photo_upload_completed?: number | null;
  order_review_viewed?: number | null;
  begin_checkouts: number;
  purchases: number;
  purchase_revenue_cents: number;
};

export type Ga4ConfigStatus = {
  configured: boolean;
  propertyId: string | null;
  measurementId: string;
  missing: string[];
};

const GA4_MEASUREMENT_ID = "G-YF2GRM2TL4";

/** Founder / internal geos — excluded from hybrid analytics upserts. */
const INTERNAL_GA4_COUNTRIES = new Set(["romania", "italy"]);

export function ga4CountryIsInternal(country: string | null | undefined): boolean {
  return INTERNAL_GA4_COUNTRIES.has(String(country || "").trim().toLowerCase());
}

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function toInt(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function dollarsToCents(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function decodePrivateKey(raw: string): string {
  return raw.replace(/\\n/g, "\n").trim();
}

export function ga4ConfigStatus(): Ga4ConfigStatus {
  const propertyId = asString(Deno.env.get("GA4_PROPERTY_ID")).replace(/^properties\//, "");
  const email = asString(Deno.env.get("GA4_SERVICE_ACCOUNT_EMAIL") || Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL"));
  const key = asString(Deno.env.get("GA4_SERVICE_ACCOUNT_PRIVATE_KEY") || Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"));
  const json = asString(Deno.env.get("GA4_SERVICE_ACCOUNT_JSON"));
  const missing: string[] = [];
  if (!propertyId) missing.push("GA4_PROPERTY_ID");
  if (!json && (!email || !key)) {
    if (!email) missing.push("GA4_SERVICE_ACCOUNT_EMAIL");
    if (!key) missing.push("GA4_SERVICE_ACCOUNT_PRIVATE_KEY");
  }
  return {
    configured: missing.length === 0,
    propertyId: propertyId || null,
    measurementId: GA4_MEASUREMENT_ID,
    missing,
  };
}

function parseServiceAccount(): { clientEmail: string; privateKey: string } {
  const jsonRaw = asString(Deno.env.get("GA4_SERVICE_ACCOUNT_JSON"));
  if (jsonRaw) {
    const parsed = JSON.parse(jsonRaw) as { client_email?: string; private_key?: string };
    const clientEmail = asString(parsed.client_email);
    const privateKey = decodePrivateKey(asString(parsed.private_key));
    if (!clientEmail || !privateKey) throw new Error("GA4_SERVICE_ACCOUNT_JSON missing client_email/private_key");
    return { clientEmail, privateKey };
  }
  const clientEmail = asString(Deno.env.get("GA4_SERVICE_ACCOUNT_EMAIL") || Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL"));
  const privateKey = decodePrivateKey(
    asString(Deno.env.get("GA4_SERVICE_ACCOUNT_PRIVATE_KEY") || Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY")),
  );
  if (!clientEmail || !privateKey) throw new Error("GA4 service account credentials missing");
  return { clientEmail, privateKey };
}

function base64Url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = Uint8Array.from(atob(cleaned), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binary.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function googleAccessToken(): Promise<string> {
  const { clientEmail, privateKey } = parseServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64Url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("GA4 token exchange returned no access_token");
  return json.access_token;
}

function yyyymmddToIso(raw: string): string {
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return raw;
}

function dim(values: Array<{ value?: string }> | undefined, index: number, fallback = "(not set)"): string {
  const v = asString(values?.[index]?.value);
  return v || fallback;
}

export function mapGa4ReportRow(row: {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
}): Ga4DailyMetricRow {
  const dims = row.dimensionValues || [];
  const metrics = row.metricValues || [];
  const sessions = toInt(metrics[0]?.value);
  const mapped: Ga4DailyMetricRow = {
    metric_date: yyyymmddToIso(dim(dims, 0, "")),
    source: dim(dims, 1),
    medium: dim(dims, 2),
    campaign: dim(dims, 3),
    device_category: dim(dims, 4),
    country: dim(dims, 5),
    sessions,
    total_users: toInt(metrics[1]?.value),
    screen_page_views: toInt(metrics[2]?.value),
    // GA4 rejects duplicate metric names; sessions is the /pet landing proxy.
    landing_views: sessions,
    begin_checkouts: toInt(metrics[6]?.value),
    purchases: toInt(metrics[7]?.value),
    purchase_revenue_cents: dollarsToCents(metrics[8]?.value),
  };
  // Custom funnel event metrics are optional; only set when GA4 returns them (may be 0).
  // We still mark them present so post-instrumentation ranges can show GA4 funnel counts.
  mapped.pet_name_submitted = toInt(metrics[3]?.value);
  mapped.photo_upload_completed = toInt(metrics[4]?.value);
  mapped.order_review_viewed = toInt(metrics[5]?.value);
  return mapped;
}

export async function fetchGa4DailyMetrics(input: {
  since: string;
  until: string;
}): Promise<Ga4DailyMetricRow[]> {
  const status = ga4ConfigStatus();
  if (!status.configured || !status.propertyId) {
    throw new Error(`GA4 not configured: missing ${status.missing.join(", ")}`);
  }
  const token = await googleAccessToken();
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${status.propertyId}:runReport`;
  const dateRanges = [{ startDate: input.since, endDate: input.until }];
  const dimensions = [
    { name: "date" },
    { name: "sessionSource" },
    { name: "sessionMedium" },
    { name: "sessionCampaignName" },
    { name: "deviceCategory" },
    { name: "country" },
  ];
  const petPathFilter = {
    filter: {
      fieldName: "pagePath",
      stringFilter: { matchType: "BEGINS_WITH", value: "/pet", caseSensitive: false },
    },
  };
  const attempts: Array<{ label: string; body: Record<string, unknown> }> = [
    {
      label: "custom-events",
      body: {
        dateRanges,
        dimensions,
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "screenPageViews" },
          { name: "eventCount:pet_name_submitted" },
          { name: "eventCount:photo_upload_completed" },
          { name: "eventCount:pet_order_review_viewed" },
          { name: "eventCount:begin_checkout" },
          { name: "ecommercePurchases" },
          { name: "purchaseRevenue" },
        ],
        dimensionFilter: petPathFilter,
        limit: 100000,
      },
    },
    {
      label: "core-pet-path",
      body: {
        dateRanges,
        dimensions,
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "screenPageViews" },
          { name: "ecommercePurchases" },
          { name: "purchaseRevenue" },
        ],
        dimensionFilter: petPathFilter,
        limit: 100000,
      },
    },
    {
      label: "core-unfiltered",
      body: {
        dateRanges,
        dimensions,
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "screenPageViews" },
          { name: "ecommercePurchases" },
          { name: "purchaseRevenue" },
        ],
        limit: 100000,
      },
    },
  ];

  const errors: string[] = [];
  for (const attempt of attempts) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(attempt.body),
    });
    if (!res.ok) {
      const text = await res.text();
      errors.push(`${attempt.label} (${res.status}): ${text.slice(0, 180)}`);
      continue;
    }
    const json = (await res.json()) as {
      rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }>;
    };
    const rows = json.rows || [];
    if (attempt.label === "custom-events") {
      return rows
        .map(mapGa4ReportRow)
        .filter((r) => r.metric_date && !ga4CountryIsInternal(r.country));
    }
    return rows
      .map((row) => {
        const dims = row.dimensionValues || [];
        const metrics = row.metricValues || [];
        const sessions = toInt(metrics[0]?.value);
        return {
          metric_date: yyyymmddToIso(dim(dims, 0, "")),
          source: dim(dims, 1),
          medium: dim(dims, 2),
          campaign: dim(dims, 3),
          device_category: dim(dims, 4),
          country: dim(dims, 5),
          sessions,
          total_users: toInt(metrics[1]?.value),
          screen_page_views: toInt(metrics[2]?.value),
          landing_views: sessions,
          begin_checkouts: 0,
          purchases: toInt(metrics[3]?.value),
          purchase_revenue_cents: dollarsToCents(metrics[4]?.value),
        } satisfies Ga4DailyMetricRow;
      })
      .filter((r) => r.metric_date && !ga4CountryIsInternal(r.country));
  }

  throw new Error(`GA4 Data API failed: ${errors.join(" | ").slice(0, 240)}`);
}

export { GA4_MEASUREMENT_ID };
