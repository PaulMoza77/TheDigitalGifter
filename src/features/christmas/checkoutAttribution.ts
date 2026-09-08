import {
  attributionParamsForInternal,
  captureFunnelAttribution,
  getFunnelFirstTouchContext,
  sanitizeAttributionValue,
} from "@/features/pet/funnelAttribution";
import { getMetaCapiClickIds } from "@/features/pet/metaCookies";
import {
  CHRISTMAS_AFFILIATE_STORAGE_KEY,
  CHRISTMAS_FUNNEL_SESSION_KEY,
  newFunnelSessionFallback,
} from "./attributionJoin";

function resolveFunnelSessionId(): string {
  if (typeof window === "undefined") return newFunnelSessionFallback();
  try {
    const existing = window.sessionStorage.getItem(CHRISTMAS_FUNNEL_SESSION_KEY);
    if (existing) return existing;
    const next = newFunnelSessionFallback();
    window.sessionStorage.setItem(CHRISTMAS_FUNNEL_SESSION_KEY, next);
    return next;
  } catch {
    return newFunnelSessionFallback();
  }
}

/** Read stored affiliate code. Never writes or clears `affiliate_ref`. */
export function readStoredAffiliateRef(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sanitizeAttributionValue(window.localStorage.getItem(CHRISTMAS_AFFILIATE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export type ChristmasCheckoutAttributionPayload = {
  funnel_session_id: string;
  landing_path: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  affiliate_ref: string | null;
  campaign_id: string | null;
  adset_id: string | null;
  ad_id: string | null;
  fbc: string | null;
  fbp: string | null;
  has_meta_click: boolean;
};

/**
 * First-touch UTMs + stored affiliate_ref + Meta click ids for Christmas checkout.
 * Does not wipe affiliate_ref or the funnel attribution store.
 */
export function buildChristmasCheckoutAttribution(
  search?: string,
): ChristmasCheckoutAttributionPayload {
  const hrefSearch =
    search ?? (typeof window !== "undefined" ? window.location.search : "");
  captureFunnelAttribution(hrefSearch);
  const attr = attributionParamsForInternal();
  const firstTouch = getFunnelFirstTouchContext();
  const meta = getMetaCapiClickIds();
  const pathname =
    typeof window !== "undefined" ? String(window.location.pathname || "") : "";
  const landing =
    firstTouch.landingPathname ||
    `${pathname}${hrefSearch || ""}`.slice(0, 120) ||
    null;
  return {
    funnel_session_id: resolveFunnelSessionId(),
    landing_path: (landing || pathname || "/christmas").slice(0, 120),
    utm_source: attr.utm_source ?? null,
    utm_medium: attr.utm_medium ?? null,
    utm_campaign: attr.utm_campaign ?? null,
    utm_content: attr.utm_content ?? null,
    utm_term: attr.utm_term ?? null,
    affiliate_ref: readStoredAffiliateRef(),
    campaign_id: attr.campaign_id ?? null,
    adset_id: attr.adset_id ?? null,
    ad_id: attr.ad_id ?? null,
    fbc: meta.fbc,
    fbp: meta.fbp,
    has_meta_click: meta.hasMetaClick || firstTouch.hasFbclid,
  };
}
