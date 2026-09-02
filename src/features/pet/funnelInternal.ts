import {
  logicalIdempotencyKey,
  newFunnelUuid,
  PET_FUNNEL_EVENT_PATH,
  type PetFunnelAllowedEvent,
} from "./funnelEventContract";
import { getMetaCapiClickIds } from "./metaCookies";
import {
  attributionParamsForInternal,
  captureFunnelAttribution,
  getFunnelFirstTouchContext,
} from "./funnelAttribution";
import { PET_FUNNEL_INTERNAL_EVENTS, type PetFunnelInternalEvent } from "./funnelDashboard";
import { getPetFunnelSessionId, inferDeviceType } from "./funnelSession";

const ALLOWED_PATHS = new Set([
  "/pet",
  "/pet/dog",
  "/pet/cat",
  "/pet/other",
  "/pet/create",
  "/pet/checkout",
  "/pet/order",
]);

const FORBIDDEN_KEYS = [
  "email",
  "petName",
  "name",
  "photoUrl",
  "imageUrl",
  "token",
  "publicToken",
  "checkoutUrl",
  "fbclid",
];

const EVENT_ID_PREFIX = "tdg.funnel.eventid.v1:";

export type InternalFunnelEventInput = {
  eventName: PetFunnelInternalEvent;
  species?: string | null;
  orderId?: string | null;
  pathname?: string | null;
  amountCents?: number | null;
  idempotencyKey?: string;
};

function safePathname(value?: string | null): string | null {
  const raw = String(value || (typeof window !== "undefined" ? window.location.pathname : "")).split("?")[0];
  if (ALLOWED_PATHS.has(raw)) return raw;
  if (raw.startsWith("/pet/")) return raw.slice(0, 64);
  return null;
}

function isAllowedEvent(value: string): value is PetFunnelInternalEvent {
  return (PET_FUNNEL_INTERNAL_EVENTS as readonly string[]).includes(value);
}

function isDev(): boolean {
    try {
      return Boolean(import.meta.env?.DEV) && import.meta.env?.MODE !== "test";
    } catch {
      return false;
    }
}

function logDeliveryFailure(eventName: string, reason: string) {
  if (!isDev()) return;
  console.warn("[pet-funnel]", { event_name: eventName, reason, at: new Date().toISOString() });
}

function eventIdFor(idempotencyKey: string): string {
  if (typeof window === "undefined") return newFunnelUuid();
  try {
    const storageKey = `${EVENT_ID_PREFIX}${idempotencyKey}`;
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const created = newFunnelUuid();
    window.sessionStorage.setItem(storageKey, created);
    return created;
  } catch {
    return newFunnelUuid();
  }
}

function clientTestFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("tdg_funnel_test") === "1";
  } catch {
    return false;
  }
}

export function buildInternalFunnelPayload(input: InternalFunnelEventInput) {
  captureFunnelAttribution();
  const sessionId = getPetFunnelSessionId();
  const attribution = attributionParamsForInternal();
  const context = getFunnelFirstTouchContext();
  const eventName = input.eventName;
  if (!isAllowedEvent(eventName)) {
    throw new Error("Unsupported funnel event");
  }
  const species =
    input.species === "dog" || input.species === "cat" || input.species === "other" ? input.species : null;
  const idempotencyKey =
    input.idempotencyKey ||
    logicalIdempotencyKey({
      sessionId,
      eventName: eventName as PetFunnelAllowedEvent,
      species,
      orderId: input.orderId || null,
    });
  const payload: Record<string, string | number | boolean | null> = {
    event_name: eventName,
    funnel_session_id: sessionId,
    event_id: eventIdFor(idempotencyKey),
    idempotency_key: idempotencyKey,
    order_id: input.orderId || null,
    species,
    device_type: inferDeviceType(),
    pathname: safePathname(input.pathname),
    amount_cents:
      typeof input.amountCents === "number" && Number.isFinite(input.amountCents) && input.amountCents > 0
        ? Math.round(input.amountCents)
        : null,
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
    is_test_request: clientTestFlag(),
  };

  for (const key of FORBIDDEN_KEYS) {
    if (key in payload) delete payload[key];
  }
  return payload;
}

function postSameOrigin(payload: Record<string, string | number | boolean | null>): void {
  const body = JSON.stringify(payload);
  const eventName = String(payload.event_name || "unknown");
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(PET_FUNNEL_EVENT_PATH, blob)) return;
    }
  } catch {
    logDeliveryFailure(eventName, "sendBeacon_threw");
  }

  if (typeof fetch !== "function") {
    logDeliveryFailure(eventName, "fetch_unavailable");
    return;
  }
  void fetch(PET_FUNNEL_EVENT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => {
    logDeliveryFailure(eventName, "fetch_failed");
  });
}

/** Canonical first-party funnel tracker. Meta/GA4 must not gate this. */
export function trackPetFunnelEvent(input: InternalFunnelEventInput): void {
  try {
    const payload = buildInternalFunnelPayload(input);
    postSameOrigin(payload);
  } catch (error) {
    logDeliveryFailure(input.eventName, error instanceof Error ? error.name : "build_failed");
  }
}

export function trackPetFunnelInternalEvent(input: InternalFunnelEventInput): void {
  trackPetFunnelEvent(input);
}

export function checkoutAnalyticsContext() {
  const attribution = attributionParamsForInternal();
  const metaClick = getMetaCapiClickIds();
  const firstTouch = getFunnelFirstTouchContext();
  return {
    funnelSessionId: getPetFunnelSessionId(),
    deviceType: inferDeviceType(),
    attribution: {
      utm_source: attribution.utm_source ?? null,
      utm_medium: attribution.utm_medium ?? null,
      utm_campaign: attribution.utm_campaign ?? null,
      utm_content: attribution.utm_content ?? null,
      utm_term: attribution.utm_term ?? null,
      campaign_id: attribution.campaign_id ?? null,
      adset_id: attribution.adset_id ?? null,
      ad_id: attribution.ad_id ?? null,
    },
    fbc: metaClick.fbc,
    fbp: metaClick.fbp,
    hasMetaClick: metaClick.hasMetaClick || firstTouch.hasFbclid,
  };
}
