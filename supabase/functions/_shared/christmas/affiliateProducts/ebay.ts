import type { AffiliateProduct, AffiliateProductAvailability } from "./types.ts";
import { currencyForEbayMarketplace, type EbayMarketplaceId } from "./marketplace.ts";
import type { NormalizedAffiliateSearch } from "./types.ts";

export const EBAY_TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
export const EBAY_BROWSE_SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
export const EBAY_BROWSE_ITEM_URL = "https://api.ebay.com/buy/browse/v1/item";
export const EBAY_OAUTH_SCOPE = "https://api.ebay.com/oauth/api_scope";

export type EbayMoney = { value?: string; currency?: string };
export type EbayImage = { imageUrl?: string };

export type EbayItemSummary = {
  itemId?: string;
  title?: string;
  shortDescription?: string;
  image?: EbayImage;
  thumbnailImages?: EbayImage[];
  additionalImages?: EbayImage[];
  price?: EbayMoney;
  marketingPrice?: { originalPrice?: EbayMoney };
  seller?: { username?: string };
  itemAffiliateWebUrl?: string;
  itemWebUrl?: string;
  condition?: string;
  conditionId?: string;
  categoryPath?: string;
  categories?: Array<{ categoryName?: string }>;
  buyingOptions?: string[];
  estimatedAvailabilities?: Array<{
    estimatedAvailabilityStatus?: string;
  }>;
  shippingOptions?: Array<{
    minEstimatedDeliveryDate?: string;
    maxEstimatedDeliveryDate?: string;
  }>;
};

export type EbaySearchResponse = {
  itemSummaries?: EbayItemSummary[];
  warnings?: Array<{ message?: string; errorId?: number }>;
  errors?: Array<{ message?: string; errorId?: number; domain?: string }>;
};

export function parseEbayMoney(money: EbayMoney | null | undefined): { amount: number; currency: string } | null {
  if (!money || money.value == null) return null;
  const amount = Number(money.value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const currency = String(money.currency || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return null;
  return { amount, currency };
}

export function ebayImageUrl(item: EbayItemSummary): string | undefined {
  const candidates = [
    item.image?.imageUrl,
    item.thumbnailImages?.[0]?.imageUrl,
    item.additionalImages?.[0]?.imageUrl,
  ];
  for (const url of candidates) {
    if (isSafeHttpUrl(url)) return url;
  }
  return undefined;
}

export function isSafeHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function isFixedPriceItem(item: EbayItemSummary): boolean {
  const options = (item.buyingOptions || []).map((x) => String(x).toUpperCase());
  if (!options.length) return true;
  if (options.includes("FIXED_PRICE")) return true;
  if (options.includes("AUCTION") && options.length === 1) return false;
  return false;
}

function availabilityFromItem(item: EbayItemSummary): AffiliateProductAvailability | undefined {
  const status = String(item.estimatedAvailabilities?.[0]?.estimatedAvailabilityStatus || "").toUpperCase();
  if (!status) return undefined;
  if (status.includes("OUT_OF_STOCK") || status.includes("UNAVAILABLE")) return "unavailable";
  if (status.includes("LIMITED")) return "limited";
  if (status.includes("IN_STOCK")) return "in_stock";
  return undefined;
}

function deliveryWindow(item: EbayItemSummary): { start?: string; end?: string } {
  const opt = item.shippingOptions?.[0];
  const start = opt?.minEstimatedDeliveryDate ? String(opt.minEstimatedDeliveryDate).slice(0, 10) : undefined;
  const end = opt?.maxEstimatedDeliveryDate ? String(opt.maxEstimatedDeliveryDate).slice(0, 10) : undefined;
  return { start, end };
}

export function normalizeEbayItem(item: EbayItemSummary, rank: number): AffiliateProduct | null {
  const title = String(item.title || "").trim().slice(0, 200);
  const id = String(item.itemId || "").trim();
  if (!title || !id) return null;
  if (!isFixedPriceItem(item)) return null;
  const affiliateUrl = isSafeHttpUrl(item.itemAffiliateWebUrl) ? String(item.itemAffiliateWebUrl) : "";
  if (!affiliateUrl) return null;
  const price = parseEbayMoney(item.price);
  if (!price) return null;
  const original = parseEbayMoney(item.marketingPrice?.originalPrice);
  const { start, end } = deliveryWindow(item);
  const merchant = String(item.seller?.username || "eBay").trim().slice(0, 80) || "eBay";
  const category = item.categories?.[0]?.categoryName || item.categoryPath || undefined;
  const productUrl = isSafeHttpUrl(item.itemWebUrl) ? String(item.itemWebUrl) : undefined;
  const availability = availabilityFromItem(item);
  const imageUrl = ebayImageUrl(item);
  const out: AffiliateProduct = {
    provider: "ebay",
    externalProductId: id.slice(0, 80),
    title,
    merchant,
    price: price.amount,
    currency: price.currency,
    affiliateUrl,
    providerRank: rank,
  };
  const desc = String(item.shortDescription || "").trim().slice(0, 280);
  if (desc) out.description = desc;
  if (imageUrl) out.imageUrl = imageUrl;
  if (original && original.amount > price.amount) out.originalPrice = original.amount;
  if (availability) out.availability = availability;
  if (start) out.deliveryStart = start;
  if (end) out.deliveryEnd = end;
  if (productUrl) out.productUrl = productUrl;
  if (category) out.category = String(category).slice(0, 80);
  if (item.condition) out.condition = String(item.condition).slice(0, 40);
  return out;
}

/**
 * Lookup may return an item that is no longer buyable.
 * Keep identity even if the affiliate URL is missing so we can mark unavailable.
 */
export function normalizeEbayLookupItem(item: EbayItemSummary): AffiliateProduct | null {
  const title = String(item.title || "").trim().slice(0, 200);
  const id = String(item.itemId || "").trim();
  if (!title || !id) return null;
  const price = parseEbayMoney(item.price);
  const { start, end } = deliveryWindow(item);
  const merchant = String(item.seller?.username || "eBay").trim().slice(0, 80) || "eBay";
  const affiliateUrl = isSafeHttpUrl(item.itemAffiliateWebUrl) ? String(item.itemAffiliateWebUrl) : "";
  const availability = availabilityFromItem(item) || (!isFixedPriceItem(item) ? "unavailable" : "unknown");
  const product: AffiliateProduct = {
    provider: "ebay",
    externalProductId: id.slice(0, 80),
    title,
    merchant,
    price: price?.amount ?? 0,
    currency: price?.currency || "EUR",
    affiliateUrl,
    availability,
  };
  const imageUrl = ebayImageUrl(item);
  if (imageUrl) product.imageUrl = imageUrl;
  if (start) product.deliveryStart = start;
  if (end) product.deliveryEnd = end;
  const productUrl = isSafeHttpUrl(item.itemWebUrl) ? String(item.itemWebUrl) : undefined;
  if (productUrl) product.productUrl = productUrl;
  if (item.condition) product.condition = String(item.condition).slice(0, 40);
  return product;
}

/** Preserve provider order. Filter invalid rows; do not re-sort. */
export function normalizeEbaySearchResults(payload: EbaySearchResponse, limit: number): AffiliateProduct[] {
  const items = payload.itemSummaries || [];
  const out: AffiliateProduct[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const product = normalizeEbayItem(items[i], i);
    if (product) out.push(product);
    if (out.length >= limit) break;
  }
  return out;
}

export function buildEbayBrowseSearchUrl(input: NormalizedAffiliateSearch, marketplace: EbayMarketplaceId): string {
  const url = new URL(EBAY_BROWSE_SEARCH_URL);
  url.searchParams.set("q", input.query);
  url.searchParams.set("limit", String(input.limit));
  const filters: string[] = ["buyingOptions:{FIXED_PRICE}"];
  const currency = currencyForEbayMarketplace(marketplace);
  if (input.priceMinMinor != null || input.priceMaxMinor != null) {
    const min = input.priceMinMinor != null ? (input.priceMinMinor / 100).toFixed(2) : "0";
    const max = input.priceMaxMinor != null ? (input.priceMaxMinor / 100).toFixed(2) : "100000";
    filters.push(`price:[${min}..${max}]`);
    filters.push(`priceCurrency:${currency}`);
  }
  if (input.condition === "new") {
    filters.push("conditionIds:{1000}");
  }
  if (input.deliveryCountry && /^[A-Z]{2}$/.test(input.deliveryCountry)) {
    filters.push(`deliveryCountry:${input.deliveryCountry}`);
  }
  url.searchParams.set("filter", filters.join(","));
  return url.toString();
}

export function ebayEndUserContext(campaignId: string, referenceId: string): string {
  const campaign = String(campaignId).trim();
  const ref = String(referenceId).trim();
  return `affiliateCampaignId=${campaign},affiliateReferenceId=${ref}`;
}

export function buildEbayBrowseItemUrl(itemId: string): string {
  const id = String(itemId || "").trim();
  if (!id || id.length > 80) throw new Error("ebay_item_id_invalid");
  const url = `${EBAY_BROWSE_ITEM_URL}/${encodeURIComponent(id)}`;
  if (!url.startsWith(`${EBAY_BROWSE_ITEM_URL}/`)) throw new Error("ebay_url_rejected");
  return url;
}

export function isEbayItemNotFound(status: number, body: string): boolean {
  if (status === 404) return true;
  const lower = body.toLowerCase();
  return status === 400 && (lower.includes("not found") || lower.includes("invalid item"));
}

export function isEbayProductionAccessError(status: number, body: string): boolean {
  if (status === 403) return true;
  const lower = body.toLowerCase();
  if (status === 400 && lower.includes("affiliate")) return true;
  if (lower.includes("not authorized") && lower.includes("buy")) return true;
  if (lower.includes("epn") && (lower.includes("not approved") || lower.includes("denied"))) return true;
  return false;
}
