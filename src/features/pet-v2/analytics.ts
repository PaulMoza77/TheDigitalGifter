import {
  attributionParamsForInternal,
  captureFunnelAttribution,
  getFunnelFirstTouchContext,
} from "../pet/funnelAttribution";
import { inferDeviceType } from "../pet/funnelSession";
import { newFunnelUuid } from "../pet/funnelEventContract";
import { getPetV2SessionId } from "./session";
import {
  PET_V2_EVENT_PATH,
  PET_V2_EVENTS,
  type PetV2EventName,
} from "./types";

const SESSION_ONCE = new Set<PetV2EventName>([
  "v2_landing_view",
  "v2_upload_started",
  "v2_upload_completed",
  "v2_preview_viewed",
  "v2_offer_viewed",
]);

export function isPetV2EventName(value: string): value is PetV2EventName {
  return (PET_V2_EVENTS as readonly string[]).includes(value);
}

export function petV2LandingPath(species: string): string {
  const selected = species === "cat" || species === "other" ? species : "dog";
  return `/pet/${selected}-v2`;
}

export function parsePetV2Species(pathname: string): "dog" | "cat" | "other" {
  const segment = pathname.split("/").filter(Boolean)[1] || "";
  if (segment === "cat-v2" || segment === "cat") return "cat";
  if (segment === "other-v2" || segment === "other") return "other";
  return "dog";
}

export function isPetV2Pathname(value: string): boolean {
  return (
    value === "/pet/dog-v2" ||
    value === "/pet/cat-v2" ||
    value === "/pet/other-v2" ||
    value === "/pet-v2" ||
    value.startsWith("/pet-v2/")
  );
}

export function sanitizeV2Pathname(value?: string | null): string | null {
  const raw = String(value || (typeof window !== "undefined" ? window.location.pathname : ""))
    .split("?")[0]
    .slice(0, 64);
  if (isPetV2Pathname(raw)) return raw;
  return null;
}

export function v2IdempotencyKey(input: {
  sessionId: string;
  eventName: PetV2EventName;
  species?: string | null;
  attemptId?: string | null;
}): string {
  if (SESSION_ONCE.has(input.eventName) && input.eventName === "v2_landing_view") {
    return `${input.sessionId}:${input.eventName}:${input.species || ""}`;
  }
  if (SESSION_ONCE.has(input.eventName)) {
    return `${input.sessionId}:${input.eventName}`;
  }
  const attempt = String(input.attemptId || "").trim().slice(0, 120);
  if (
    attempt &&
    (input.eventName === "v2_preview_generation_started" ||
      input.eventName === "v2_preview_generation_completed" ||
      input.eventName === "v2_preview_generation_failed" ||
      input.eventName === "v2_preview_regenerated")
  ) {
    return `${input.sessionId}:${input.eventName}:${attempt}`.slice(0, 180);
  }
  return [input.sessionId, input.eventName, input.species || "", Date.now()].join(":");
}

export type TrackV2Input = {
  eventName: PetV2EventName;
  species?: string | null;
  amountCents?: number | null;
  pathname?: string | null;
  failureCategory?: string | null;
  attemptId?: string | null;
};

export function trackPetV2Event(input: TrackV2Input): void {
  try {
    captureFunnelAttribution();
    const sessionId = getPetV2SessionId();
    const attribution = attributionParamsForInternal();
    const context = getFunnelFirstTouchContext();
    const species =
      input.species === "dog" || input.species === "cat" || input.species === "other"
        ? input.species
        : null;
    const failureCategory =
      typeof input.failureCategory === "string"
        ? input.failureCategory.replace(/[^a-z0-9_]/gi, "").slice(0, 40)
        : null;
    const payload = {
      event_name: input.eventName,
      funnel_session_id: sessionId,
      event_id: newFunnelUuid(),
      idempotency_key: v2IdempotencyKey({
        sessionId,
        eventName: input.eventName,
        species,
        attemptId: input.attemptId,
      }),
      species,
      device_type: inferDeviceType(),
      pathname: sanitizeV2Pathname(input.pathname),
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
      funnel_variant: "v2_preview",
      failure_category: failureCategory,
    };
    post(payload);
    sendGa4Custom(input.eventName, species, failureCategory);
  } catch {
    /* tracking must never break the funnel */
  }
}

function post(payload: Record<string, string | number | boolean | null>): void {
  const body = JSON.stringify(payload);
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      if (navigator.sendBeacon(PET_V2_EVENT_PATH, new Blob([body], { type: "application/json" }))) {
        return;
      }
    }
  } catch {
    /* fall through */
  }
  if (typeof fetch !== "function") return;
  void fetch(PET_V2_EVENT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => undefined);
}

function sendGa4Custom(eventName: PetV2EventName, species: string | null, failureCategory: string | null) {
  try {
    const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag !== "function") return;
    gtag("event", eventName, {
      funnel_variant: "v2_preview",
      species: species || undefined,
      failure_category: failureCategory || undefined,
    });
  } catch {
    /* ignore */
  }
}
