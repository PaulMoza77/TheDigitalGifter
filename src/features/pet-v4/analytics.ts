import {
  attributionParamsForInternal,
  captureFunnelAttribution,
  getFunnelFirstTouchContext,
} from "../pet/funnelAttribution";
import { readMetaFbc, readMetaFbp } from "../pet/metaCookies";
import { inferDeviceType } from "../pet/funnelSession";
import { newFunnelUuid } from "../pet/funnelEventContract";
import { classifyCheckoutBrowser } from "../pet-v2/paymentDiagnostics";
import { isPetV4Pathname, petV4LandingPath } from "./campaign";
import { getPetV4SessionId, getPetV4VisitorId } from "./session";
import {
  PET_V4_EVENT_PATH,
  PET_V4_EVENTS,
  PET_V4_FUNNEL_VARIANT,
  PET_V4_FUNNEL_VERSION,
  type PetV4CtaLocation,
  type PetV4EventName,
  type PetV4ScrollBucket,
  type PetV4Species,
} from "./types";

const SESSION_ONCE = new Set<PetV4EventName>([
  "v4_landing_view",
  "v4_first_interaction",
  "v4_upload_opened",
  "v4_upload_started",
  "v4_upload_completed",
  "v4_teaser_viewed",
  "v4_offer_viewed",
  "v4_checkout_clicked",
  "v4_checkout_opened",
]);

const SCROLL_ONCE = new Set<PetV4ScrollBucket>();

export function isPetV4EventName(value: string): value is PetV4EventName {
  return (PET_V4_EVENTS as readonly string[]).includes(value);
}

export function sanitizeV4Pathname(value?: string | null): string | null {
  const raw = String(value || (typeof window !== "undefined" ? window.location.pathname : ""))
    .split("?")[0]
    .slice(0, 64);
  if (isPetV4Pathname(raw)) return raw;
  // Allow V2 paths when soft-routing cohort traffic before redirect completes.
  if (raw === "/pet/dog-v2" || raw === "/pet/cat-v2" || raw === "/pet/other-v2") return raw;
  return null;
}

export function v4IdempotencyKey(input: {
  sessionId: string;
  eventName: PetV4EventName;
  species?: string | null;
  attemptId?: string | null;
  eventId?: string | null;
  metaKey?: string | null;
}): string {
  if (SESSION_ONCE.has(input.eventName) && input.eventName === "v4_landing_view") {
    return `${input.sessionId}:${input.eventName}:${input.species || ""}`;
  }
  if (SESSION_ONCE.has(input.eventName)) {
    return `${input.sessionId}:${input.eventName}`;
  }
  if (input.eventName === "v4_scroll_depth" && input.metaKey) {
    return `${input.sessionId}:v4_scroll_depth:${input.metaKey}`.slice(0, 180);
  }
  if (input.eventName === "v4_cta_exposed" && input.metaKey) {
    return `${input.sessionId}:v4_cta_exposed:${input.metaKey}`.slice(0, 180);
  }
  const attempt = String(input.attemptId || "").trim().slice(0, 120);
  if (
    attempt &&
    (input.eventName === "v4_generation_started" ||
      input.eventName === "v4_generation_completed" ||
      input.eventName === "v4_generation_failed" ||
      input.eventName === "v4_checkout_session_created" ||
      input.eventName === "v4_checkout_abandoned" ||
      input.eventName === "v4_cta_clicked")
  ) {
    return `${input.sessionId}:${input.eventName}:${attempt}`.slice(0, 180);
  }
  const eventId = String(input.eventId || "").trim();
  if (eventId) {
    return `${input.sessionId}:${input.eventName}:${input.species || ""}:${eventId}`.slice(0, 180);
  }
  return [input.sessionId, input.eventName, input.species || "", Date.now()].join(":");
}

export type TrackV4Input = {
  eventName: PetV4EventName;
  species?: PetV4Species | string | null;
  amountCents?: number | null;
  pathname?: string | null;
  failureCategory?: string | null;
  attemptId?: string | null;
  ctaLocation?: PetV4CtaLocation | null;
  scrollBucket?: PetV4ScrollBucket | null;
  scrollPct?: number | null;
  engagedMs?: number | null;
  generationDurationMs?: number | null;
  metaPlacement?: string | null;
  metadata?: Record<string, string | number | boolean | null> | null;
};

function clientTestFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("tdg_funnel_test") === "1";
  } catch {
    return false;
  }
}

export function trackPetV4Event(input: TrackV4Input): void {
  try {
    captureFunnelAttribution();
    const sessionId = getPetV4SessionId();
    const visitorId = getPetV4VisitorId();
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
    const eventId = newFunnelUuid();
    const browser = classifyCheckoutBrowser();
    const scrollBucket = input.scrollBucket || null;
    const ctaLocation = input.ctaLocation || null;
    const metaKey = scrollBucket || ctaLocation || null;

    const payload: Record<string, string | number | boolean | null> = {
      event_name: input.eventName,
      funnel_session_id: sessionId,
      visitor_id: visitorId,
      event_id: eventId,
      idempotency_key: v4IdempotencyKey({
        sessionId,
        eventName: input.eventName,
        species,
        attemptId: input.attemptId,
        eventId,
        metaKey,
      }),
      species,
      device_type: inferDeviceType(),
      browser_family: browser.browserFamily,
      in_app_browser: browser.inAppBrowser,
      pathname: sanitizeV4Pathname(input.pathname) || (species ? petV4LandingPath(species) : null),
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
      funnel_variant: PET_V4_FUNNEL_VARIANT,
      funnel_version: PET_V4_FUNNEL_VERSION,
      fbc: readMetaFbc(),
      fbp: readMetaFbp(),
      failure_category: failureCategory,
      cta_location: ctaLocation,
      scroll_bucket: scrollBucket,
      scroll_pct:
        typeof input.scrollPct === "number" && Number.isFinite(input.scrollPct)
          ? Math.round(input.scrollPct)
          : null,
      engaged_ms:
        typeof input.engagedMs === "number" && Number.isFinite(input.engagedMs)
          ? Math.round(input.engagedMs)
          : null,
      generation_duration_ms:
        typeof input.generationDurationMs === "number" && Number.isFinite(input.generationDurationMs)
          ? Math.round(input.generationDurationMs)
          : null,
      meta_placement: input.metaPlacement ? String(input.metaPlacement).slice(0, 80) : null,
      is_test_request: clientTestFlag(),
    };

    if (input.metadata) {
      for (const [key, value] of Object.entries(input.metadata)) {
        const safeKey = key.replace(/[^a-z0-9_]/gi, "").slice(0, 40);
        if (!safeKey || safeKey in payload) continue;
        if (typeof value === "string") payload[`meta_${safeKey}`] = value.slice(0, 120);
        else if (typeof value === "number" && Number.isFinite(value)) payload[`meta_${safeKey}`] = value;
        else if (typeof value === "boolean") payload[`meta_${safeKey}`] = value;
      }
    }

    post(payload);
    sendGa4Custom(input.eventName, failureCategory, ctaLocation);
  } catch {
    /* tracking must never break the funnel */
  }
}

export function trackV4ScrollDepth(bucket: PetV4ScrollBucket, scrollPct: number): void {
  if (SCROLL_ONCE.has(bucket)) return;
  SCROLL_ONCE.add(bucket);
  trackPetV4Event({
    eventName: "v4_scroll_depth",
    scrollBucket: bucket,
    scrollPct,
  });
}

export function resetV4ScrollOnceForTests(): void {
  SCROLL_ONCE.clear();
}

function post(payload: Record<string, string | number | boolean | null>): void {
  const body = JSON.stringify(payload);
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      if (navigator.sendBeacon(PET_V4_EVENT_PATH, new Blob([body], { type: "application/json" }))) {
        return;
      }
    }
  } catch {
    /* fall through */
  }
  if (typeof fetch !== "function") return;
  void fetch(PET_V4_EVENT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => undefined);
}

function sendGa4Custom(
  eventName: PetV4EventName,
  failureCategory: string | null,
  ctaLocation: PetV4CtaLocation | null,
) {
  try {
    const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag !== "function") return;
    gtag("event", eventName, {
      funnel_variant: PET_V4_FUNNEL_VARIANT,
      funnel_version: PET_V4_FUNNEL_VERSION,
      failure_category: failureCategory || undefined,
      cta_location: ctaLocation || undefined,
    });
  } catch {
    /* ignore */
  }
}
