import { supabase } from "@/lib/supabase";
import type {
  AffiliateProviderHealth,
  AffiliateSearchResult,
  AffiliateSearchSource,
} from "../../../../supabase/functions/_shared/christmas/affiliateProducts/types.ts";
import {
  createAffiliateReferenceId,
  isSafeAffiliateReferenceId,
} from "../../../../supabase/functions/_shared/christmas/affiliateProducts/query.ts";
import type { GiftItem } from "../planner/types";

export {
  affiliateSourceRef,
  deliveryWarning,
  overBudgetDeltaMinor,
  plannerGiftOutboundUrl,
  productFitsRemaining,
  snapshotPriceLabel,
  affiliateFreshnessState,
  freshnessCheckedLabel,
  liveShoppingUnavailableCopy,
  affiliateUrlForGift,
} from "./helpers";

const FUNNEL_URL = `${String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "")}/functions/v1/affiliate-product-search`;
const REF_KEY = "tdg.affiliate.ref.v1";

export function getOrCreateAffiliateReferenceId(): string {
  if (typeof sessionStorage === "undefined") return createAffiliateReferenceId();
  const existing = sessionStorage.getItem(REF_KEY);
  if (isSafeAffiliateReferenceId(existing)) return existing as string;
  const next = createAffiliateReferenceId();
  sessionStorage.setItem(REF_KEY, next);
  return next;
}

async function authHeaders(): Promise<Record<string, string>> {
  const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "");
  const { data } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    apikey: anon,
    Authorization: `Bearer ${data.session?.access_token || anon}`,
  };
}

const disabledEbay: AffiliateProviderHealth = {
  provider: "ebay",
  enabled: false,
  configured: false,
  productionAccess: false,
  reason: "DISABLED_FEATURE_FLAG",
  code: "DISABLED_FEATURE_FLAG",
};

export type AffiliateStatusResponse = {
  ok: boolean;
  enabled: boolean;
  ebay: AffiliateProviderHealth;
  providers?: AffiliateProviderHealth[];
};

export async function fetchAffiliateProductStatus(): Promise<AffiliateStatusResponse> {
  if (!FUNNEL_URL || FUNNEL_URL.includes("placeholder.supabase")) {
    return { ok: true, enabled: false, ebay: disabledEbay, providers: [disabledEbay] };
  }
  try {
    const res = await fetch(FUNNEL_URL, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ action: "status" }),
    });
    const json = (await res.json()) as AffiliateStatusResponse;
    if (!res.ok) {
      return { ok: false, enabled: false, ebay: disabledEbay };
    }
    return {
      ok: true,
      enabled: Boolean(json.enabled),
      ebay: json.ebay || disabledEbay,
      providers: json.providers,
    };
  } catch {
    return { ok: false, enabled: false, ebay: disabledEbay };
  }
}

export type AffiliateAdminStatusResponse = AffiliateStatusResponse & {
  credentialsPresent?: { ebay: boolean; awin: boolean; amazon: boolean };
  missingCredentialNames?: { ebay: string[]; awin: string[] };
  revenue?: { status: string };
  activeProvider?: string;
};

export async function fetchAffiliateAdminStatus(): Promise<AffiliateAdminStatusResponse> {
  if (!FUNNEL_URL || FUNNEL_URL.includes("placeholder.supabase")) {
    return {
      ok: true,
      enabled: false,
      ebay: disabledEbay,
      providers: [disabledEbay],
      credentialsPresent: { ebay: false, awin: false, amazon: false },
      revenue: { status: "awaiting_provider_reporting" },
    };
  }
  const res = await fetch(FUNNEL_URL, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ action: "admin_status" }),
  });
  const json = (await res.json()) as AffiliateAdminStatusResponse;
  if (!res.ok) throw new Error(json && "error" in json ? String((json as { error?: string }).error) : "admin_status_failed");
  return json;
}

export type AffiliateSearchClientInput = {
  query?: string;
  source: AffiliateSearchSource;
  countryCode?: string | null;
  locale?: string | null;
  currency?: string | null;
  priceMinMinor?: number | null;
  priceMaxMinor?: number | null;
  condition?: "new" | "any";
  ideaTitle?: string | null;
  searchQuery?: string | null;
  interests?: string | null;
  vibeKeys?: string[] | null;
  relationshipCategory?: string | null;
};

export async function searchAffiliateProducts(input: AffiliateSearchClientInput): Promise<AffiliateSearchResult> {
  if (!FUNNEL_URL || FUNNEL_URL.includes("placeholder.supabase")) {
    throw new Error("affiliate_unavailable");
  }
  const res = await fetch(FUNNEL_URL, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      action: "search",
      query: input.query || "",
      source: input.source,
      country_code: input.countryCode || null,
      locale: input.locale || "en",
      currency: input.currency || null,
      price_min_minor: input.priceMinMinor ?? null,
      price_max_minor: input.priceMaxMinor ?? null,
      condition: input.condition || "any",
      idea_title: input.ideaTitle || null,
      search_query: input.searchQuery || null,
      interests: String(input.interests || "").slice(0, 120),
      vibe_keys: (input.vibeKeys || []).slice(0, 6),
      relationship_category: input.relationshipCategory || null,
      delivery_country: input.countryCode || null,
      affiliate_reference_id: getOrCreateAffiliateReferenceId(),
      limit: 8,
    }),
  });
  const json = (await res.json()) as AffiliateSearchResult & { error?: string };
  if (res.status === 401 || json.error === "auth_required") throw new Error("affiliate_auth");
  if (!res.ok && json.error === "rate_limited") throw new Error("rate_limited");
  if (!json.ok && json.reason === "DISABLED_NO_PRODUCTION_ACCESS") return json;
  if (!res.ok || json.error) throw new Error(json.error || "affiliate_unavailable");
  return json;
}

export type AffiliateLookupClientResult = {
  ok: boolean;
  enabled: boolean;
  unavailable: boolean;
  reason?: string | null;
  gift?: GiftItem;
};

export async function refreshAffiliateGiftPrice(giftId: string): Promise<AffiliateLookupClientResult> {
  if (!FUNNEL_URL || FUNNEL_URL.includes("placeholder.supabase")) {
    return { ok: true, enabled: false, unavailable: false, reason: "DISABLED_FEATURE_FLAG" };
  }
  const res = await fetch(FUNNEL_URL, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      action: "lookup",
      gift_id: giftId,
      affiliate_reference_id: getOrCreateAffiliateReferenceId(),
    }),
  });
  const json = (await res.json()) as AffiliateLookupClientResult & { error?: string };
  if (res.status === 401 || json.error === "auth_required") throw new Error("affiliate_auth");
  if (!res.ok && json.error === "rate_limited") throw new Error("rate_limited");
  if (!res.ok && json.error) {
    return { ok: false, enabled: false, unavailable: false, reason: json.error };
  }
  return {
    ok: Boolean(json.ok),
    enabled: Boolean(json.enabled),
    unavailable: Boolean(json.unavailable),
    reason: json.reason,
    gift: json.gift as GiftItem | undefined,
  };
}
