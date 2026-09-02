import {
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

const SESSION_KEY = "tdg.christmas.funnel.session.v1";

export function getChristmasFunnelSessionId(): string {
  if (typeof window === "undefined") return newFunnelUuid();
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const next = newFunnelUuid();
    window.sessionStorage.setItem(SESSION_KEY, next);
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
  },
): Promise<void> {
  if (typeof window === "undefined") return;
  captureFunnelAttribution(window.location.search);
  const attr = attributionParamsForInternal();
  const firstTouch = getFunnelFirstTouchContext();
  const eventId = newFunnelUuid();
  const body = {
    event_name: eventName,
    funnel_session_id: getChristmasFunnelSessionId(),
    event_id: eventId,
    idempotency_key: `${getChristmasFunnelSessionId()}:${eventName}:${eventId}`,
    product_key: extra?.productKey ?? "christmas_photo",
    package_key: extra?.packageKey ?? null,
    order_id: extra?.orderId ?? null,
    locale: "en",
    pathname: extra?.pathname ?? window.location.pathname,
    landing_path: `${window.location.pathname}${window.location.search}`.slice(0, 120),
    device_type: inferDeviceType(),
    amount_cents: extra?.amountCents ?? null,
    utm_source: attr.utm_source ?? null,
    utm_medium: attr.utm_medium ?? null,
    utm_campaign: attr.utm_campaign ?? null,
    utm_content: attr.utm_content ?? null,
    utm_term: attr.utm_term ?? null,
    campaign_id: attr.campaign_id ?? null,
    adset_id: attr.adset_id ?? null,
    ad_id: attr.ad_id ?? null,
    has_fbclid: firstTouch.hasFbclid,
    metadata: extra?.styleKey ? { style_key: extra.styleKey } : {},
  };

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
