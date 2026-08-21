/**
 * Meta Marketing API (Ads Insights) — server-only.
 * Uses META_ADS_ACCESS_TOKEN (ads_read). Do NOT reuse CAPI tokens blindly.
 * Never log tokens. Never expose to the browser.
 */

export type MetaDailyMetricRow = {
  metric_date: string;
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  ad_id: string;
  ad_name: string;
  spend_cents: number;
  impressions: number;
  reach: number;
  link_clicks: number;
  outbound_clicks: number;
  landing_page_views: number;
  initiate_checkouts: number;
  purchases: number;
  purchase_value_cents: number;
  pet_name_submitted?: number | null;
  photo_upload_completed?: number | null;
  order_review_viewed?: number | null;
  pet_details_completed?: number | null;
  cpc_cents?: number | null;
  ctr_bps?: number | null;
  cpm_cents?: number | null;
};

export type MetaAdsConfigStatus = {
  configured: boolean;
  adAccountId: string | null;
  missing: string[];
};

const CUSTOM_EVENT_ALIASES: Record<
  "pet_name_submitted" | "photo_upload_completed" | "order_review_viewed" | "pet_details_completed",
  string[]
> = {
  pet_name_submitted: [
    "PetNameSubmitted",
    "pet_name_submitted",
    "offsite_conversion.fb_pixel_custom.PetNameSubmitted",
    "offsite_conversion.custom.PetNameSubmitted",
  ],
  photo_upload_completed: [
    "PhotoUploadCompleted",
    "photo_upload_completed",
    "offsite_conversion.fb_pixel_custom.PhotoUploadCompleted",
    "offsite_conversion.custom.PhotoUploadCompleted",
  ],
  order_review_viewed: [
    "PetOrderReviewViewed",
    "pet_order_review_viewed",
    "offsite_conversion.fb_pixel_custom.PetOrderReviewViewed",
    "offsite_conversion.custom.PetOrderReviewViewed",
  ],
  pet_details_completed: [
    "PetDetailsCompleted",
    "pet_details_completed",
    "offsite_conversion.fb_pixel_custom.PetDetailsCompleted",
    "offsite_conversion.custom.PetDetailsCompleted",
  ],
};

export const META_CUSTOM_EVENT_RECOVERY = {
  PetNameSubmitted:
    "Historical Meta custom event PetNameSubmitted cannot be reliably retrieved through the available reporting API unless Meta returns a matching action_type in Ads Insights.",
  PhotoUploadCompleted:
    "Historical Meta custom event PhotoUploadCompleted cannot be reliably retrieved through the available reporting API unless Meta returns a matching action_type in Ads Insights.",
  PetOrderReviewViewed:
    "Historical Meta custom event PetOrderReviewViewed cannot be reliably retrieved through the available reporting API unless Meta returns a matching action_type in Ads Insights.",
  PetDetailsCompleted:
    "Historical Meta custom event PetDetailsCompleted cannot be reliably retrieved through the available reporting API unless Meta returns a matching action_type in Ads Insights.",
} as const;

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function dollarsToCents(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function toInt(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function normalizeAdAccountId(raw: string): string {
  const id = asString(raw).replace(/^act_/i, "");
  return id ? `act_${id}` : "";
}

export function metaAdsConfigStatus(): MetaAdsConfigStatus {
  const account = asString(Deno.env.get("META_AD_ACCOUNT_ID"));
  const token = asString(Deno.env.get("META_ADS_ACCESS_TOKEN"));
  const missing: string[] = [];
  if (!account) missing.push("META_AD_ACCOUNT_ID");
  if (!token) missing.push("META_ADS_ACCESS_TOKEN");
  return {
    configured: missing.length === 0,
    adAccountId: account ? normalizeAdAccountId(account) : null,
    missing,
  };
}

export function defaultPetAdsSyncStartDate(): string {
  return asString(Deno.env.get("PET_ADS_SYNC_START_DATE")) || "2026-08-16";
}

type MetaAction = { action_type?: string; value?: string };

function actionValue(actions: MetaAction[] | undefined, types: string[]): number {
  if (!actions?.length) return 0;
  const wanted = new Set(types.map((t) => t.toLowerCase()));
  let total = 0;
  for (const action of actions) {
    const type = asString(action.action_type).toLowerCase();
    if (wanted.has(type)) total += toInt(action.value);
  }
  return total;
}

function customActionValue(
  actions: MetaAction[] | undefined,
  aliases: string[],
): number | null {
  if (!actions?.length) return null;
  const wanted = aliases.map((a) => a.toLowerCase());
  let found = false;
  let total = 0;
  for (const action of actions) {
    const type = asString(action.action_type).toLowerCase();
    if (wanted.some((alias) => type === alias || type.endsWith(`.${alias}`) || type.includes(alias.toLowerCase()))) {
      found = true;
      total += toInt(action.value);
    }
  }
  return found ? total : null;
}

function purchaseValueCents(actionValues: MetaAction[] | undefined): number {
  if (!actionValues?.length) return 0;
  for (const action of actionValues) {
    const type = asString(action.action_type).toLowerCase();
    if (type === "purchase" || type === "omni_purchase" || type.endsWith(".purchase")) {
      return dollarsToCents(action.value);
    }
  }
  return 0;
}

export function mapMetaInsightRow(row: Record<string, unknown>): MetaDailyMetricRow {
  const actions = (row.actions as MetaAction[] | undefined) || [];
  const actionValues = (row.action_values as MetaAction[] | undefined) || [];
  const outbound = Array.isArray(row.outbound_clicks)
    ? actionValue(row.outbound_clicks as MetaAction[], ["outbound_click"])
    : toInt((row.outbound_clicks as MetaAction[] | undefined)?.[0]?.value);

  const petName = customActionValue(actions, CUSTOM_EVENT_ALIASES.pet_name_submitted);
  const photoUpload = customActionValue(actions, CUSTOM_EVENT_ALIASES.photo_upload_completed);
  const orderReview = customActionValue(actions, CUSTOM_EVENT_ALIASES.order_review_viewed);
  const petDetails = customActionValue(actions, CUSTOM_EVENT_ALIASES.pet_details_completed);

  const spendCents = dollarsToCents(row.spend);
  const impressions = toInt(row.impressions);
  const linkClicks = actionValue(actions, ["link_click"]) || toInt(row.clicks);
  const cpcRaw = Number(row.cpc);
  const ctrRaw = Number(row.ctr);
  const cpmRaw = Number(row.cpm);

  const mapped: MetaDailyMetricRow = {
    metric_date: asString(row.date_start) || asString(row.date_stop),
    campaign_id: asString(row.campaign_id),
    campaign_name: asString(row.campaign_name),
    adset_id: asString(row.adset_id),
    adset_name: asString(row.adset_name),
    ad_id: asString(row.ad_id),
    ad_name: asString(row.ad_name),
    spend_cents: spendCents,
    impressions,
    reach: toInt(row.reach),
    link_clicks: linkClicks,
    outbound_clicks: outbound,
    landing_page_views: actionValue(actions, ["landing_page_view", "omni_landing_page_view"]),
    initiate_checkouts: actionValue(actions, ["initiate_checkout", "omni_initiated_checkout"]),
    purchases: actionValue(actions, ["purchase", "omni_purchase"]),
    purchase_value_cents: purchaseValueCents(actionValues),
    cpc_cents: Number.isFinite(cpcRaw) ? dollarsToCents(cpcRaw) : null,
    ctr_bps: Number.isFinite(ctrRaw) ? Math.round(ctrRaw * 100) : null,
    cpm_cents: Number.isFinite(cpmRaw) ? dollarsToCents(cpmRaw) : null,
  };

  if (petName != null) mapped.pet_name_submitted = petName;
  if (photoUpload != null) mapped.photo_upload_completed = photoUpload;
  if (orderReview != null) mapped.order_review_viewed = orderReview;
  if (petDetails != null) mapped.pet_details_completed = petDetails;

  return mapped;
}

export function summarizeCustomEventAvailability(rows: MetaDailyMetricRow[]): {
  pet_name_submitted: boolean;
  photo_upload_completed: boolean;
  order_review_viewed: boolean;
  pet_details_completed: boolean;
} {
  return {
    pet_name_submitted: rows.some((r) => r.pet_name_submitted != null),
    photo_upload_completed: rows.some((r) => r.photo_upload_completed != null),
    order_review_viewed: rows.some((r) => r.order_review_viewed != null),
    pet_details_completed: rows.some((r) => r.pet_details_completed != null),
  };
}

async function fetchInsightsPage(url: string, token: string): Promise<{ data: Record<string, unknown>[]; next?: string }> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meta Ads Insights failed (${res.status}): ${text.slice(0, 240)}`);
  }
  const json = (await res.json()) as {
    data?: Record<string, unknown>[];
    paging?: { next?: string };
  };
  return { data: json.data || [], next: json.paging?.next };
}

export async function fetchMetaAdsDailyInsights(input: {
  since: string;
  until: string;
}): Promise<{ rows: MetaDailyMetricRow[]; customEvents: ReturnType<typeof summarizeCustomEventAvailability> }> {
  const status = metaAdsConfigStatus();
  if (!status.configured || !status.adAccountId) {
    throw new Error(`Meta Ads not configured: missing ${status.missing.join(", ")}`);
  }
  const token = asString(Deno.env.get("META_ADS_ACCESS_TOKEN"));
  const fields = [
    "date_start",
    "date_stop",
    "campaign_id",
    "campaign_name",
    "adset_id",
    "adset_name",
    "ad_id",
    "ad_name",
    "spend",
    "impressions",
    "reach",
    "clicks",
    "cpc",
    "ctr",
    "cpm",
    "actions",
    "action_values",
    "outbound_clicks",
  ].join(",");

  const timeRange = encodeURIComponent(JSON.stringify({ since: input.since, until: input.until }));
  let url =
    `https://graph.facebook.com/v21.0/${status.adAccountId}/insights` +
    `?level=ad&time_increment=1&limit=500&time_range=${timeRange}&fields=${fields}`;

  const rows: MetaDailyMetricRow[] = [];
  let guard = 0;
  while (url && guard < 40) {
    guard += 1;
    const page = await fetchInsightsPage(url, token);
    for (const raw of page.data) {
      const mapped = mapMetaInsightRow(raw);
      if (mapped.metric_date) rows.push(mapped);
    }
    url = page.next || "";
  }

  return { rows, customEvents: summarizeCustomEventAvailability(rows) };
}

export async function discoverMetaCampaignEarliestDate(): Promise<string | null> {
  const status = metaAdsConfigStatus();
  if (!status.configured || !status.adAccountId) return null;
  const token = asString(Deno.env.get("META_ADS_ACCESS_TOKEN"));
  const url =
    `https://graph.facebook.com/v21.0/${status.adAccountId}/campaigns` +
    `?fields=id,name,start_time,created_time&limit=100&effective_status=["ACTIVE","PAUSED","ARCHIVED"]`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: Array<{ name?: string; start_time?: string; created_time?: string }> };
  const petCampaigns = (json.data || []).filter((c) => /pet|secret.?life|dog|cat/i.test(asString(c.name)));
  const pool = petCampaigns.length ? petCampaigns : json.data || [];
  let earliest: string | null = null;
  for (const campaign of pool) {
    const raw = asString(campaign.start_time || campaign.created_time);
    if (!raw) continue;
    const day = raw.slice(0, 10);
    if (!earliest || day < earliest) earliest = day;
  }
  return earliest;
}
