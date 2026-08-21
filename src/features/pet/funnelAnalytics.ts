import { trackEvent, type AnalyticsParamValue } from "@/lib/analytics";
import { PET_PRODUCT_NAME, PET_PRODUCT_SKU } from "./types";
import { sanitizeFunnelAnalyticsPayload } from "./croGuards";
import { attributionParamsForGa4 } from "./funnelAttribution";
import { trackPetFunnelInternalEvent } from "./funnelInternal";
import type { PetFunnelInternalEvent } from "./funnelDashboard";

type Fbq = (...args: unknown[]) => void;

export const FUNNEL_EVENT_KEYS = {
  PetNameSubmitted: "tdg.funnel.PetNameSubmitted",
  PetSubtypeSelected: "tdg.funnel.PetSubtypeSelected",
  PhotoUploadStarted: "tdg.funnel.PhotoUploadStarted",
  PhotoUploadCompleted: "tdg.funnel.PhotoUploadCompleted",
  PetDetailsCompleted: "tdg.funnel.PetDetailsCompleted",
  PetOrderReviewViewed: "tdg.funnel.PetOrderReviewViewed",
  ViewContent: "tdg.funnel.ViewContent",
  InitiateCheckout: "tdg.funnel.InitiateCheckout",
  CheckoutError: "tdg.funnel.CheckoutError",
} as const;

export const GA4_FUNNEL_EVENTS = {
  PetNameSubmitted: "pet_name_submitted",
  PetSubtypeSelected: "pet_subtype_selected",
  PhotoUploadStarted: "photo_upload_started",
  PhotoUploadCompleted: "photo_upload_completed",
  PetDetailsCompleted: "pet_details_completed",
  PetOrderReviewViewed: "pet_order_review_viewed",
  ViewContent: "view_item",
  InitiateCheckout: "begin_checkout",
  CheckoutError: "checkout_error",
} as const;

const INTERNAL_FUNNEL_EVENTS: Partial<Record<keyof typeof FUNNEL_EVENT_KEYS, PetFunnelInternalEvent>> = {
  PetNameSubmitted: "pet_name_submitted",
  PhotoUploadStarted: "photo_upload_started",
  PhotoUploadCompleted: "photo_upload_completed",
  PetDetailsCompleted: "pet_details_completed",
  PetOrderReviewViewed: "order_review_viewed",
  CheckoutError: "checkout_error",
};

const FUNNEL_STEPS: Record<keyof typeof FUNNEL_EVENT_KEYS, string> = {
  PetNameSubmitted: "name",
  PetSubtypeSelected: "subtype",
  PhotoUploadStarted: "upload",
  PhotoUploadCompleted: "upload",
  PetDetailsCompleted: "details",
  PetOrderReviewViewed: "review",
  ViewContent: "landing",
  InitiateCheckout: "checkout",
  CheckoutError: "checkout",
};

function pixel(): Fbq | null {
  if (typeof window === "undefined") return null;
  const fbq = (window as Window & { fbq?: Fbq }).fbq;
  return typeof fbq === "function" ? fbq : null;
}

function once(key: string): boolean {
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
      /* session copy is best-effort */
    }
    return true;
  } catch {
    return once(key);
  }
}

export function centsToMajorUnits(valueCents: number): number {
  return Math.round(valueCents) / 100;
}

export function buildGa4Item(valueCents: number) {
  const price = centsToMajorUnits(valueCents);
  return {
    item_id: PET_PRODUCT_SKU,
    item_name: PET_PRODUCT_NAME,
    price,
    quantity: 1,
  };
}

function asGa4Params(payload: Record<string, unknown>): Record<string, AnalyticsParamValue> {
  const next: Record<string, AnalyticsParamValue> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    next[key] = value as AnalyticsParamValue;
  }
  return next;
}

function sendGa4(
  eventName: string,
  params: Record<string, unknown>,
  options?: { onceKey?: string; persistent?: boolean },
) {
  if (options?.onceKey) {
    const allowed = options.persistent ? oncePersistent(options.onceKey) : once(options.onceKey);
    if (!allowed) return false;
  }
  try {
    const safe = sanitizeFunnelAnalyticsPayload({
      product_id: PET_PRODUCT_SKU,
      ...params,
      ...attributionParamsForGa4(),
    });
    trackEvent(eventName, asGa4Params(safe));
  } catch {
    // Tracking failures must never break the customer funnel.
  }
  return true;
}

export function shouldTrackPetBeginCheckout(input: {
  status?: string | null;
  sessionId?: string | null;
  checkoutUrl?: string | null;
}): boolean {
  return (
    input.status === "open" &&
    Boolean(input.sessionId) &&
    typeof input.checkoutUrl === "string" &&
    input.checkoutUrl.startsWith("https://")
  );
}

export function shouldTrackPetPurchase(input: {
  paidAt?: string | null;
  amountCents?: number | null;
}): boolean {
  return Boolean(input.paidAt) && Number(input.amountCents) > 0;
}

export function trackFunnelViewItem(input: { species: string; valueCents: number }) {
  if (!Number.isFinite(input.valueCents) || input.valueCents <= 0) return false;
  const sent = sendGa4(
    "view_item",
    {
      currency: "USD",
      value: centsToMajorUnits(input.valueCents),
      species: input.species,
      step: "landing",
      items: [buildGa4Item(input.valueCents)],
    },
    { onceKey: `tdg.ga4.view_item.${input.species}` },
  );
  if (sent) {
    trackPetFunnelInternalEvent({
      eventName: "landing_view",
      species: input.species,
    });
  }
  return sent;
}

export function trackFunnelBeginCheckout(input: {
  eventId: string;
  valueCents: number;
  orderId?: string;
  species?: string | null;
}) {
  if (!input.eventId) return false;
  if (!Number.isFinite(input.valueCents) || input.valueCents <= 0) return false;
  return sendGa4(
    "begin_checkout",
    {
      currency: "USD",
      value: centsToMajorUnits(input.valueCents),
      species: input.species || undefined,
      step: "checkout",
      items: [buildGa4Item(input.valueCents)],
    },
    { onceKey: `tdg.ga4.begin_checkout.${input.eventId}` },
  );
}

export function trackFunnelPurchase(input: {
  eventId: string;
  amountCents: number;
  orderId: string;
  paidAt?: string | null;
  species?: string | null;
}) {
  if (!input.eventId || !input.orderId) return false;
  if (!shouldTrackPetPurchase(input)) return false;
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) return false;
  return sendGa4(
    "purchase",
    {
      currency: "USD",
      value: centsToMajorUnits(input.amountCents),
      transaction_id: input.orderId,
      species: input.species || undefined,
      step: "purchase",
      items: [buildGa4Item(input.amountCents)],
    },
    { onceKey: `tdg.ga4.purchase.${input.eventId}`, persistent: true },
  );
}

export function trackFunnelEvent(
  name: keyof typeof FUNNEL_EVENT_KEYS,
  payload: Record<string, unknown> = {},
  options?: { onceKey?: string; eventID?: string },
) {
  const onceKey = options?.onceKey || FUNNEL_EVENT_KEYS[name];
  if (onceKey && !once(onceKey)) return false;
  const safe = sanitizeFunnelAnalyticsPayload({
    content_ids: [PET_PRODUCT_SKU],
    content_type: "product",
    ...payload,
  });
  try {
    const fbq = pixel();
    if (fbq) {
      if (options?.eventID) {
        fbq("trackCustom", name, safe, { eventID: options.eventID });
      } else {
        fbq("trackCustom", name, safe);
      }
    }
  } catch {
    // Meta pixel failures must never break the funnel.
  }

  const ga4Params: Record<string, unknown> = {
    product_id: PET_PRODUCT_SKU,
    step: FUNNEL_STEPS[name],
  };
  if (typeof payload.species === "string") ga4Params.species = payload.species;
  if (typeof payload.subtype === "string") ga4Params.subtype = payload.subtype;
  if (typeof payload.value === "number" && Number.isFinite(payload.value)) {
    ga4Params.value = payload.value;
    ga4Params.currency = typeof payload.currency === "string" ? payload.currency : "USD";
  }

  sendGa4(GA4_FUNNEL_EVENTS[name], ga4Params);
  const internalName = INTERNAL_FUNNEL_EVENTS[name];
  if (internalName) {
    trackPetFunnelInternalEvent({
      eventName: internalName,
      species: typeof payload.species === "string" ? payload.species : null,
    });
  }
  return true;
}
