import { sanitizeAttributionValue } from "./funnelAttribution";
import { attributionParamsForInternal } from "./funnelAttribution";
import {
  PET_FUNNEL_INTERNAL_EVENTS,
  type PetFunnelInternalEvent,
} from "./funnelDashboard";
import { getPetFunnelSessionId, inferDeviceType } from "./funnelSession";

const ALLOWED_PATHS = new Set([
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

export function buildInternalFunnelPayload(input: InternalFunnelEventInput) {
  const sessionId = getPetFunnelSessionId();
  const attribution = attributionParamsForInternal();
  const eventName = input.eventName;
  if (!isAllowedEvent(eventName)) {
    throw new Error("Unsupported funnel event");
  }
  const payload: Record<string, string | number | null> = {
    p_event_name: eventName,
    p_funnel_session_id: sessionId,
    p_idempotency_key:
      input.idempotencyKey ||
      [sessionId, eventName, input.species || "", input.orderId || ""].join(":"),
    p_order_id: input.orderId || null,
    p_species: input.species === "dog" || input.species === "cat" || input.species === "other" ? input.species : null,
    p_device_type: inferDeviceType(),
    p_pathname: safePathname(input.pathname),
    p_amount_cents:
      typeof input.amountCents === "number" && Number.isFinite(input.amountCents) && input.amountCents > 0
        ? Math.round(input.amountCents)
        : null,
    p_utm_source: sanitizeAttributionValue(attribution.utm_source),
    p_utm_medium: sanitizeAttributionValue(attribution.utm_medium),
    p_utm_campaign: sanitizeAttributionValue(attribution.utm_campaign),
    p_utm_content: sanitizeAttributionValue(attribution.utm_content),
    p_utm_term: sanitizeAttributionValue(attribution.utm_term),
    p_campaign_id: sanitizeAttributionValue(attribution.campaign_id),
    p_adset_id: sanitizeAttributionValue(attribution.adset_id),
    p_ad_id: sanitizeAttributionValue(attribution.ad_id),
  };

  for (const key of FORBIDDEN_KEYS) {
    if (key in payload) delete payload[key];
  }
  return payload;
}

export function trackPetFunnelInternalEvent(input: InternalFunnelEventInput): void {
  try {
    const payload = buildInternalFunnelPayload(input);
    void import("@/lib/supabase")
      .then(({ supabase }) => supabase.rpc("record_pet_funnel_event", payload))
      .then(
        () => undefined,
        () => undefined,
      );
  } catch {
    // Internal analytics must never break the customer funnel.
  }
}

export function checkoutAnalyticsContext() {
  const attribution = attributionParamsForInternal();
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
  };
}
