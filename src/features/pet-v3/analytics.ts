import {
  attributionParamsForInternal,
  captureFunnelAttribution,
  getFunnelFirstTouchContext,
} from "../pet/funnelAttribution";
import { inferDeviceType } from "../pet/funnelSession";
import { newFunnelUuid } from "../pet/funnelEventContract";
import { getPetV3SessionId } from "./session";
import {
  PET_V3_EVENT_PATH,
  PET_V3_EVENTS,
  PET_V3_FUNNEL_VARIANT,
  PET_V3_FUNNEL_VERSION,
  PET_V3_ROUTE,
  PET_V3_SPECIES,
  type PetV3EventName,
} from "./types";

const SESSION_ONCE = new Set<PetV3EventName>([
  "v3_landing_view",
  "v3_upload_started",
  "v3_upload_completed",
  "v3_preview_viewed",
  "v3_offer_viewed",
]);

export function isPetV3EventName(value: string): value is PetV3EventName {
  return (PET_V3_EVENTS as readonly string[]).includes(value);
}

export function isPetV3Pathname(value: string): boolean {
  return value === PET_V3_ROUTE;
}

export function sanitizeV3Pathname(value?: string | null): string | null {
  const raw = String(value || (typeof window !== "undefined" ? window.location.pathname : ""))
    .split("?")[0]
    .slice(0, 64);
  return isPetV3Pathname(raw) ? raw : null;
}

export function v3IdempotencyKey(input: {
  sessionId: string;
  eventName: PetV3EventName;
  attemptId?: string | null;
  eventId?: string | null;
}): string {
  if (SESSION_ONCE.has(input.eventName) && input.eventName === "v3_landing_view") {
    return `${input.sessionId}:${input.eventName}:cat`;
  }
  if (SESSION_ONCE.has(input.eventName)) {
    return `${input.sessionId}:${input.eventName}`;
  }
  const attempt = String(input.attemptId || "").trim().slice(0, 120);
  if (
    attempt &&
    (input.eventName === "v3_preview_generation_started" ||
      input.eventName === "v3_preview_generation_completed" ||
      input.eventName === "v3_preview_generation_failed" ||
      input.eventName === "v3_preview_regenerated" ||
      input.eventName === "v3_begin_checkout")
  ) {
    return `${input.sessionId}:${input.eventName}:${attempt}`.slice(0, 180);
  }
  const eventId = String(input.eventId || "").trim();
  if (eventId) {
    return `${input.sessionId}:${input.eventName}:cat:${eventId}`.slice(0, 180);
  }
  return [input.sessionId, input.eventName, PET_V3_SPECIES, Date.now()].join(":");
}

export type TrackV3Input = {
  eventName: PetV3EventName;
  amountCents?: number | null;
  pathname?: string | null;
  failureCategory?: string | null;
  attemptId?: string | null;
};

export function trackPetV3Event(input: TrackV3Input): void {
  try {
    captureFunnelAttribution();
    const sessionId = getPetV3SessionId();
    const attribution = attributionParamsForInternal();
    const context = getFunnelFirstTouchContext();
    const failureCategory =
      typeof input.failureCategory === "string"
        ? input.failureCategory.replace(/[^a-z0-9_]/gi, "").slice(0, 40)
        : null;
    const eventId = newFunnelUuid();
    const payload = {
      event_name: input.eventName,
      funnel_session_id: sessionId,
      event_id: eventId,
      idempotency_key: v3IdempotencyKey({
        sessionId,
        eventName: input.eventName,
        attemptId: input.attemptId,
        eventId,
      }),
      species: PET_V3_SPECIES,
      device_type: inferDeviceType(),
      pathname: sanitizeV3Pathname(input.pathname),
      amount_cents:
        typeof input.amountCents === "number" && Number.isFinite(input.amountCents)
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
      funnel_variant: PET_V3_FUNNEL_VARIANT,
      funnel_version: PET_V3_FUNNEL_VERSION,
      failure_category: failureCategory,
    };
    post(payload);
    sendGa4Custom(input.eventName, failureCategory);
  } catch {
    /* tracking must never break the funnel */
  }
}

function post(payload: Record<string, string | number | boolean | null>): void {
  const body = JSON.stringify(payload);
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      if (navigator.sendBeacon(PET_V3_EVENT_PATH, new Blob([body], { type: "application/json" }))) {
        return;
      }
    }
  } catch {
    /* fall through */
  }
  if (typeof fetch !== "function") return;
  void fetch(PET_V3_EVENT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => undefined);
}

function sendGa4Custom(eventName: PetV3EventName, failureCategory: string | null) {
  try {
    const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag !== "function") return;
    gtag("event", eventName, {
      funnel_variant: PET_V3_FUNNEL_VARIANT,
      funnel_version: PET_V3_FUNNEL_VERSION,
      species: PET_V3_SPECIES,
      failure_category: failureCategory || undefined,
    });
  } catch {
    /* ignore */
  }
}
