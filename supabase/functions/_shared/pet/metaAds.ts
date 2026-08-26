/**
 * Meta Marketing API (Ads Insights) — server-only.
 * Uses META_ADS_ACCESS_TOKEN (ads_read). Do NOT reuse CAPI tokens blindly.
 * Never log tokens. Never expose to the browser.
 *
 * Spend/impressions/clicks/LPV are allowlisted pet campaign IDs only.
 * Never request or store the rest of the ad account.
 */

import {
  BUILTIN_PET_META_CAMPAIGN_IDS,
  filterPetMetaInsightRows,
  mergePetMetaCampaignAllowlist,
  parsePetMetaCampaignIds,
} from "./metaCampaignAllowlist.ts";
import {
  actionValue,
  addMetaActionAliasTotals,
  emptyMetaActionAliasTotals,
  META_CHECKOUT_ACTION_PREFERENCE,
  META_LPV_ACTION_PREFERENCE,
  META_PURCHASE_ACTION_PREFERENCE,
  preferredActionValue,
  tallyMetaActionAliases,
  type MetaActionAliasTotals,
} from "./metaActionValue.ts";

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

export function envPetMetaCampaignIds(): string[] {
  return parsePetMetaCampaignIds(Deno.env.get("PET_META_CAMPAIGN_IDS"));
}

export function resolvePetMetaCampaignAllowlist(dbIds?: Iterable<string> | null): string[] {
  return mergePetMetaCampaignAllowlist(BUILTIN_PET_META_CAMPAIGN_IDS, envPetMetaCampaignIds(), dbIds);
}

type MetaAction = { action_type?: string; value?: string };

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
  for (const preferred of META_PURCHASE_ACTION_PREFERENCE) {
    const want = preferred.toLowerCase();
    for (const action of actionValues) {
      if (asString(action.action_type).toLowerCase() === want) {
        return dollarsToCents(action.value);
      }
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
    landing_page_views: preferredActionValue(actions, [...META_LPV_ACTION_PREFERENCE]),
    initiate_checkouts: preferredActionValue(actions, [...META_CHECKOUT_ACTION_PREFERENCE]),
    purchases: preferredActionValue(actions, [...META_PURCHASE_ACTION_PREFERENCE]),
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

function insightsUrl(input: {
  adAccountId: string;
  since: string;
  until: string;
  fields: string;
  campaignIds: string[];
}): string {
  const timeRange = encodeURIComponent(JSON.stringify({ since: input.since, until: input.until }));
  const filtering = encodeURIComponent(
    JSON.stringify([{ field: "campaign.id", operator: "IN", value: input.campaignIds }]),
  );
  return (
    `https://graph.facebook.com/v21.0/${input.adAccountId}/insights` +
    `?level=ad&time_increment=1&limit=500&time_range=${timeRange}&filtering=${filtering}&fields=${input.fields}`
  );
}

export async function fetchMetaAdsDailyInsights(input: {
  since: string;
  until: string;
  campaignIds?: Iterable<string> | null;
}): Promise<{
  rows: MetaDailyMetricRow[];
  customEvents: ReturnType<typeof summarizeCustomEventAvailability>;
  actionAliasTotals: MetaActionAliasTotals;
}> {
  const status = metaAdsConfigStatus();
  if (!status.configured || !status.adAccountId) {
    throw new Error(`Meta Ads not configured: missing ${status.missing.join(", ")}`);
  }
  const campaignIds = resolvePetMetaCampaignAllowlist(input.campaignIds);
  if (!campaignIds.length) {
    throw new Error("Pet Meta campaign allowlist is empty; refusing to sync the entire ad account");
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

  let url = insightsUrl({
    adAccountId: status.adAccountId,
    since: input.since,
    until: input.until,
    fields,
    campaignIds,
  });

  const mappedRows: MetaDailyMetricRow[] = [];
  let actionAliasTotals = emptyMetaActionAliasTotals();
  let guard = 0;
  while (url && guard < 40) {
    guard += 1;
    const page = await fetchInsightsPage(url, token);
    actionAliasTotals = addMetaActionAliasTotals(actionAliasTotals, tallyMetaActionAliases(page.data));
    for (const raw of page.data) {
      const mapped = mapMetaInsightRow(raw);
      if (mapped.metric_date) mappedRows.push(mapped);
    }
    url = page.next || "";
  }

  const rows = filterPetMetaInsightRows(mappedRows, campaignIds);
  return { rows, customEvents: summarizeCustomEventAvailability(rows), actionAliasTotals };
}

export async function discoverMetaCampaignEarliestDate(
  campaignIds?: Iterable<string> | null,
): Promise<string | null> {
  const status = metaAdsConfigStatus();
  if (!status.configured || !status.adAccountId) return null;
  const allowlist = resolvePetMetaCampaignAllowlist(campaignIds);
  if (!allowlist.length) return null;
  const token = asString(Deno.env.get("META_ADS_ACCESS_TOKEN"));
  const filtering = encodeURIComponent(JSON.stringify([{ field: "id", operator: "IN", value: allowlist }]));
  const url =
    `https://graph.facebook.com/v21.0/${status.adAccountId}/campaigns` +
    `?fields=id,name,start_time,created_time&limit=100&filtering=${filtering}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    data?: Array<{ id?: string; name?: string; start_time?: string; created_time?: string }>;
  };
  let earliest: string | null = null;
  for (const campaign of json.data || []) {
    if (!allowlist.includes(asString(campaign.id))) continue;
    const raw = asString(campaign.start_time || campaign.created_time);
    if (!raw) continue;
    const day = raw.slice(0, 10);
    if (!earliest || day < earliest) earliest = day;
  }
  return earliest;
}

export type MetaCampaignListRow = { id: string; name: string; effectiveStatus: string };

const V2_CAMPAIGN_NAME_RE = /pet\s*tdg\s*funnel\s*v2\s*testing/i;
const V3_CAMPAIGN_NAME_RE = /pet\s*tdg\s*cat\s*funnel\s*testing/i;

export function matchV2TestingCampaign(
  campaigns: MetaCampaignListRow[],
): MetaCampaignListRow | null {
  const exact = campaigns.filter((row) => V2_CAMPAIGN_NAME_RE.test(row.name));
  return exact.length === 1 ? exact[0] : null;
}

export function matchV3TestingCampaign(
  campaigns: MetaCampaignListRow[],
): MetaCampaignListRow | null {
  const exact = campaigns.filter((row) => V3_CAMPAIGN_NAME_RE.test(row.name));
  return exact.length === 1 ? exact[0] : null;
}

export async function listAdAccountCampaigns(): Promise<MetaCampaignListRow[]> {
  const status = metaAdsConfigStatus();
  if (!status.configured || !status.adAccountId) return [];
  const token = asString(Deno.env.get("META_ADS_ACCESS_TOKEN"));
  const rows: MetaCampaignListRow[] = [];
  let url =
    `https://graph.facebook.com/v21.0/${status.adAccountId}/campaigns` +
    `?fields=id,name,effective_status&limit=200`;
  let guard = 0;
  while (url && guard < 10) {
    guard += 1;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) break;
    const json = (await res.json()) as {
      data?: Array<{ id?: string; name?: string; effective_status?: string }>;
      paging?: { next?: string };
    };
    for (const row of json.data || []) {
      const id = asString(row.id);
      const name = asString(row.name);
      if (!id || !name) continue;
      rows.push({ id, name, effectiveStatus: asString(row.effective_status) });
    }
    url = json.paging?.next || "";
  }
  return rows;
}

export async function discoverPetV2TestingCampaign(): Promise<MetaCampaignListRow | null> {
  return matchV2TestingCampaign(await listAdAccountCampaigns());
}

export async function discoverPetV3TestingCampaign(): Promise<MetaCampaignListRow | null> {
  const configured = asString(Deno.env.get("PET_V3_META_CAMPAIGN_ID"));
  if (/^\d{5,}$/.test(configured)) {
    const campaigns = await listAdAccountCampaigns();
    const match = campaigns.find((row) => row.id === configured);
    return match || { id: configured, name: "Pet TDG Cat Funnel testing", effectiveStatus: "ACTIVE" };
  }
  return matchV3TestingCampaign(await listAdAccountCampaigns());
}
