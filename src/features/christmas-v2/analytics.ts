import {
  attributionParamsForInternal,
  captureFunnelAttribution,
  getFunnelFirstTouchContext,
} from "../pet/funnelAttribution";
import { inferDeviceType } from "../pet/funnelSession";
import { newFunnelUuid } from "../pet/funnelEventContract";
import { CHRISTMAS_V2_EVENT_PATH, CHRISTMAS_V2_ROUTE } from "./config";
import { getChristmasV2SessionId } from "./session";
import { CHRISTMAS_V2_EVENTS, type ChristmasV2EventName } from "./types";

const SESSION_ONCE = new Set<ChristmasV2EventName>([
  "christmas_v2_view",
  "christmas_v2_upload_started",
  "christmas_v2_upload_completed",
  "christmas_v2_offer_viewed",
  "christmas_v2_results_viewed",
  "christmas_v2_upsell_viewed",
  "christmas_v2_checkout_canceled",
]);

export function isChristmasV2EventName(value: string): value is ChristmasV2EventName {
  return (CHRISTMAS_V2_EVENTS as readonly string[]).includes(value);
}

export function trackChristmasV2Event(input: {
  eventName: ChristmasV2EventName;
  amountCents?: number | null;
  product?: string | null;
  failureCategory?: string | null;
  attemptId?: string | null;
}): void {
  try {
    captureFunnelAttribution();
    const sessionId = getChristmasV2SessionId();
    const attribution = attributionParamsForInternal();
    const context = getFunnelFirstTouchContext();
    const eventId = newFunnelUuid();
    const idempotency = SESSION_ONCE.has(input.eventName)
      ? `${sessionId}:${input.eventName}`
      : `${sessionId}:${input.eventName}:${input.attemptId || eventId}`;

    const payload = {
      event_name: input.eventName,
      funnel_session_id: sessionId,
      event_id: eventId,
      idempotency_key: idempotency.slice(0, 180),
      device_type: inferDeviceType(),
      pathname: CHRISTMAS_V2_ROUTE,
      amount_cents:
        typeof input.amountCents === "number" && Number.isFinite(input.amountCents)
          ? Math.round(input.amountCents)
          : null,
      product: input.product || null,
      utm_source: attribution.utm_source ?? null,
      utm_medium: attribution.utm_medium ?? null,
      utm_campaign: attribution.utm_campaign ?? null,
      utm_content: attribution.utm_content ?? null,
      utm_term: attribution.utm_term ?? null,
      campaign_id: attribution.campaign_id ?? null,
      adset_id: attribution.adset_id ?? null,
      ad_id: attribution.ad_id ?? null,
      has_meta_click: context.hasFbclid,
      referrer_host: context.referrerHost,
      funnel_variant: "christmas_v2",
      funnel_version: "christmas_v2",
      failure_category: input.failureCategory || null,
    };
    post(payload);
    sendGa4(input.eventName, input.product || null);
  } catch {
    /* never break funnel */
  }
}

function post(payload: Record<string, string | number | boolean | null>): void {
  const body = JSON.stringify(payload);
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      if (navigator.sendBeacon(CHRISTMAS_V2_EVENT_PATH, new Blob([body], { type: "application/json" }))) {
        return;
      }
    }
  } catch {
    /* fall through */
  }
  if (typeof fetch !== "function") return;
  void fetch(CHRISTMAS_V2_EVENT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => undefined);
}

function sendGa4(eventName: ChristmasV2EventName, product: string | null) {
  try {
    const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag !== "function") return;
    gtag("event", eventName, {
      funnel_variant: "christmas_v2",
      product: product || undefined,
    });
  } catch {
    /* ignore */
  }
}
