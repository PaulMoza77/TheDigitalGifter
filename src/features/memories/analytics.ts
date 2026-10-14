import {
  attributionParamsForInternal,
  captureFunnelAttribution,
  getFunnelFirstTouchContext,
} from "../pet/funnelAttribution";
import { inferDeviceType } from "../pet/funnelSession";
import { newFunnelUuid } from "../pet/funnelEventContract";
import { getPublicSupabaseConfig } from "@/lib/env";
import {
  MEMORIES_EVENT_EDGE_ACTION,
  MEMORIES_EVENT_PATH,
  MEMORIES_EVENTS,
  MEMORIES_ROUTE,
  type MemoriesEventName,
} from "./config";
import { getMemoriesSessionId } from "./session";

const SESSION_ONCE = new Set<MemoriesEventName>([
  "memories_page_view",
  "memories_upload_started",
  "memories_upload_completed",
  "memories_email_submitted",
  "memories_plan_viewed",
  "memories_waitlist_joined",
  "memories_checkout_canceled",
]);

export function isMemoriesEventName(value: string): value is MemoriesEventName {
  return (MEMORIES_EVENTS as readonly string[]).includes(value);
}

export function trackMemoriesEvent(input: {
  eventName: MemoriesEventName;
  amountCents?: number | null;
  product?: string | null;
  failureCategory?: string | null;
  attemptId?: string | null;
  pathname?: string | null;
}): void {
  try {
    captureFunnelAttribution();
    const sessionId = getMemoriesSessionId();
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
      pathname: input.pathname || MEMORIES_ROUTE,
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
      funnel_variant: "memories_v1",
      funnel_version: "memories_v1",
      failure_category: input.failureCategory || null,
    };
    post(payload);
    sendGa4(input.eventName, input.product || null);
  } catch {
    /* never break funnel */
  }
}

function eventEdgeUrl(): string {
  const { url } = getPublicSupabaseConfig();
  return `${url.replace(/\/$/, "")}/functions/v1/${MEMORIES_EVENT_EDGE_ACTION}`;
}

function post(payload: Record<string, string | number | boolean | null>): void {
  const body = JSON.stringify(payload);
  if (typeof fetch !== "function") return;
  const { anon } = getPublicSupabaseConfig();
  const edgeHeaders = {
    "Content-Type": "application/json",
    apikey: anon,
    Authorization: `Bearer ${anon}`,
  };
  void fetch(eventEdgeUrl(), {
    method: "POST",
    headers: edgeHeaders,
    body,
    keepalive: true,
  }).catch(() => {
    void fetch(MEMORIES_EVENT_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => undefined);
  });
}

function sendGa4(eventName: MemoriesEventName, product: string | null) {
  try {
    const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag !== "function") return;
    gtag("event", eventName, {
      funnel_variant: "memories_v1",
      product: product || undefined,
    });
  } catch {
    /* ignore */
  }
}
