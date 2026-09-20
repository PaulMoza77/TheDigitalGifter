/**
 * Awin adapter skeleton.
 *
 * Live feed ingest is intentionally OFF. Do not fetch AWIN_FEED_URL until
 * publisher approval and feed credentials are verified.
 *
 * Documented mapping (official product feed columns commonly published by Awin):
 * - aw_product_id → externalProductId
 * - product_name → title
 * - merchant_name → merchant
 * - search_price / product_price → price
 * - currency → currency
 * - aw_deep_link / aw_deep_link_url → affiliateUrl (do not rewrite)
 * - merchant_image_url / aw_image_url → imageUrl
 * - category_name → category
 * - in_stock → availability
 *
 * Do not invent extra tracking params. Do not scrape merchant HTML.
 */

import { awinProviderStatus, type AffiliateEnv } from "./config.ts";
import { disabledLookupResult, disabledSearchResult } from "./health.ts";
import type {
  AffiliateLookupRequest,
  AffiliateLookupResult,
  AffiliateProduct,
  AffiliateProductAvailability,
  AffiliateProvider,
  AffiliateSearchResult,
  NormalizedAffiliateSearch,
} from "./types.ts";

export type AwinFeedRow = {
  aw_product_id?: string;
  product_id?: string;
  product_name?: string;
  product_short_description?: string;
  merchant_name?: string;
  search_price?: string | number;
  product_price?: string | number;
  currency?: string;
  aw_deep_link?: string;
  aw_deep_link_url?: string;
  merchant_image_url?: string;
  aw_image_url?: string;
  category_name?: string;
  in_stock?: string | boolean | number;
  delivery_time?: string;
};

function isSafeHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function parsePrice(row: AwinFeedRow): { amount: number; currency: string } | null {
  const raw = row.search_price ?? row.product_price;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const currency = String(row.currency || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return null;
  return { amount, currency };
}

function stockToAvailability(value: AwinFeedRow["in_stock"]): AffiliateProductAvailability | undefined {
  if (value == null || value === "") return undefined;
  if (value === false || value === 0 || value === "0" || String(value).toLowerCase() === "n") return "unavailable";
  if (value === true || value === 1 || value === "1" || String(value).toLowerCase() === "y") return "in_stock";
  return undefined;
}

export function normalizeAwinFeedRow(row: AwinFeedRow, rank: number): AffiliateProduct | null {
  const title = String(row.product_name || "").trim().slice(0, 200);
  const id = String(row.aw_product_id || row.product_id || "").trim();
  if (!title || !id) return null;
  const affiliateUrl = [row.aw_deep_link, row.aw_deep_link_url].find((u) => isSafeHttpUrl(String(u || ""))) || "";
  if (!affiliateUrl) return null;
  const price = parsePrice(row);
  if (!price) return null;
  const image = [row.merchant_image_url, row.aw_image_url].find((u) => isSafeHttpUrl(String(u || "")));
  const availability = stockToAvailability(row.in_stock);
  const out: AffiliateProduct = {
    provider: "awin",
    externalProductId: id.slice(0, 80),
    title,
    merchant: String(row.merchant_name || "Awin").trim().slice(0, 80) || "Awin",
    price: price.amount,
    currency: price.currency,
    affiliateUrl: String(affiliateUrl),
    providerRank: rank,
  };
  const desc = String(row.product_short_description || "").trim().slice(0, 280);
  if (desc) out.description = desc;
  if (image) out.imageUrl = String(image);
  if (availability) out.availability = availability;
  if (row.category_name) out.category = String(row.category_name).slice(0, 80);
  return out;
}

export function normalizeAwinFeedRows(rows: AwinFeedRow[], limit: number): AffiliateProduct[] {
  const out: AffiliateProduct[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const product = normalizeAwinFeedRow(rows[i], i);
    if (product) out.push(product);
    if (out.length >= limit) break;
  }
  return out;
}

export class AwinProvider implements AffiliateProvider {
  readonly id = "awin" as const;

  constructor(private readonly env: AffiliateEnv) {}

  status() {
    return awinProviderStatus(this.env);
  }

  async search(input: NormalizedAffiliateSearch): Promise<AffiliateSearchResult> {
    return disabledSearchResult(this.status(), input.marketplace);
  }

  async lookup(input: AffiliateLookupRequest): Promise<AffiliateLookupResult> {
    return disabledLookupResult(this.status(), input.marketplace);
  }
}
