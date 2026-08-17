import { PET_PRODUCT_SKU } from "./types";
import { sanitizeFunnelAnalyticsPayload } from "./croGuards";

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
  const fbq = pixel();
  if (!fbq) return true;
  if (options?.eventID) {
    fbq("trackCustom", name, safe, { eventID: options.eventID });
  } else {
    fbq("trackCustom", name, safe);
  }
  return true;
}
