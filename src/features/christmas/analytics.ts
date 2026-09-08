import { trackEvent } from "@/lib/analytics";
import {
  attributionParamsForGa4,
  attributionParamsForInternal,
  captureFunnelAttribution,
  getFunnelFirstTouchContext,
} from "@/features/pet/funnelAttribution";
import { inferDeviceType } from "@/features/pet/funnelSession";
import {
  CHRISTMAS_FUNNEL_EVENT_PATH,
  newFunnelUuid,
  type ChristmasFunnelEventName,
} from "./funnelEventContract";
import {
  CHRISTMAS_FUNNEL_SESSION_KEY,
  christmasInitiateCheckoutEventId,
  christmasPurchaseEventId,
} from "./attributionJoin";
import { readStoredAffiliateRef } from "./checkoutAttribution";

export function getChristmasFunnelSessionId(): string {
  if (typeof window === "undefined") return newFunnelUuid();
  try {
    const existing = window.sessionStorage.getItem(CHRISTMAS_FUNNEL_SESSION_KEY);
    if (existing) return existing;
    const next = newFunnelUuid();
    window.sessionStorage.setItem(CHRISTMAS_FUNNEL_SESSION_KEY, next);
    return next;
  } catch {
    return newFunnelUuid();
  }
}

export async function trackChristmasEvent(
  eventName: ChristmasFunnelEventName,
  extra?: {
    productKey?: string | null;
    packageKey?: string | null;
    orderId?: string | null;
    styleKey?: string | null;
    amountCents?: number | null;
    pathname?: string | null;
    locale?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<void> {
  if (typeof window === "undefined") return;
  captureFunnelAttribution(window.location.search);
  const attr = attributionParamsForInternal();
  const firstTouch = getFunnelFirstTouchContext();
  const eventId =
    eventName === "purchase" && extra?.orderId
      ? christmasPurchaseEventId(extra.orderId) || newFunnelUuid()
      : eventName === "payment_sheet_opened" && extra?.orderId
        ? christmasInitiateCheckoutEventId(extra.orderId) || newFunnelUuid()
        : newFunnelUuid();
  const affiliateRef = readStoredAffiliateRef();
  const body = {
    event_name: eventName,
    funnel_session_id: getChristmasFunnelSessionId(),
    event_id: eventId,
    idempotency_key:
      eventName === "purchase" && extra?.orderId
        ? `purchase:${extra.orderId}`
        : `${getChristmasFunnelSessionId()}:${eventName}:${eventId}`,
    product_key: extra?.productKey ?? "christmas_photo",
    package_key: extra?.packageKey ?? null,
    order_id: extra?.orderId ?? null,
    locale: extra?.locale === "ro" ? "ro" : "en",
    pathname: extra?.pathname ?? window.location.pathname,
    landing_path:
      firstTouch.landingPathname ||
      `${window.location.pathname}${window.location.search}`.slice(0, 120),
    device_type: inferDeviceType(),
    amount_cents: extra?.amountCents ?? null,
    utm_source: attr.utm_source ?? null,
    utm_medium: attr.utm_medium ?? null,
    utm_campaign: attr.utm_campaign ?? null,
    utm_content: attr.utm_content ?? null,
    utm_term: attr.utm_term ?? null,
    affiliate_ref: affiliateRef,
    campaign_id: attr.campaign_id ?? null,
    adset_id: attr.adset_id ?? null,
    ad_id: attr.ad_id ?? null,
    has_fbclid: firstTouch.hasFbclid,
    referrer_host: firstTouch.referrerHost,
    metadata: {
      ...(extra?.styleKey ? { style_key: extra.styleKey } : {}),
      ...(extra?.metadata || {}),
      ...(eventName === "purchase" ? { meta_event_id: eventId } : {}),
    },
  };

  sendChristmasGa4(eventName, {
    eventId,
    orderId: extra?.orderId ?? null,
    amountCents: extra?.amountCents ?? null,
    productKey: extra?.productKey ?? body.product_key,
  });

  try {
    await fetch(CHRISTMAS_FUNNEL_EVENT_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    // Analytics must never break the funnel.
  }
}

function sendChristmasGa4(
  eventName: ChristmasFunnelEventName,
  extra: {
    eventId: string;
    orderId: string | null;
    amountCents: number | null;
    productKey: string | null;
  },
) {
  try {
    const ga4 = attributionParamsForGa4();
    if (eventName === "checkout_started" || eventName === "payment_sheet_opened") {
      const onceKey = extra.eventId
        ? `tdg.ga4.xmas.begin_checkout.${extra.eventId}`
        : `tdg.ga4.xmas.begin_checkout.${getChristmasFunnelSessionId()}`;
      if (!onceSession(onceKey)) return;
      trackEvent("begin_checkout", {
        currency: "USD",
        value:
          typeof extra.amountCents === "number" && extra.amountCents > 0
            ? extra.amountCents / 100
            : undefined,
        product_key: extra.productKey || undefined,
        transaction_id: extra.orderId || undefined,
        ...ga4,
      });
      return;
    }
    if (eventName === "purchase" && extra.orderId) {
      const onceKey = `tdg.ga4.xmas.purchase.${extra.eventId}`;
      if (!oncePersistent(onceKey)) return;
      trackEvent("purchase", {
        currency: "USD",
        value:
          typeof extra.amountCents === "number" && extra.amountCents > 0
            ? extra.amountCents / 100
            : undefined,
        transaction_id: extra.orderId,
        product_key: extra.productKey || undefined,
        ...ga4,
      });
    }
  } catch {
    /* never break funnel */
  }
}

function onceSession(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(key) === "1") return false;
    window.sessionStorage.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
}

function oncePersistent(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(key) === "1") return false;
    window.localStorage.setItem(key, "1");
    try {
      window.sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    return true;
  } catch {
    return onceSession(key);
  }
}
