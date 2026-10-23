import { readCookieConsent } from "@/lib/cookieConsent";

function send(event: string, data: Record<string, unknown>, eventId?: string) {
  if (readCookieConsent() !== "granted") return;
  const fbq = (window as Window & { fbq?: (...args: unknown[]) => void }).fbq;
  if (typeof fbq !== "function") {
    window.addEventListener("tdg-meta-ready", () => send(event, data, eventId), { once: true });
    return;
  }
  const key = eventId ? `tdg.meta.${event}.${eventId}` : null;
  try {
    // Persist across refreshes and return visits. Fail closed if storage is unavailable.
    if (key && window.localStorage.getItem(key)) return;
    if (key) window.localStorage.setItem(key, "1");
    fbq("track", event, data, ...(eventId ? [{ eventID: eventId }] : []));
  } catch { /* Tracking must never interrupt checkout or delivery. */ }
}

let viewTracked = false;

export function trackChristmasPackView() {
  if (viewTracked) return;
  if (typeof window === "undefined") return;
  if (readCookieConsent() !== "granted") {
    const pathname = window.location.pathname;
    window.addEventListener("tdg-meta-ready", () => {
      if (window.location.pathname === pathname) trackChristmasPackView();
    }, { once: true });
    return;
  }
  const fbq = (window as Window & { fbq?: unknown }).fbq;
  if (typeof fbq !== "function") {
    window.addEventListener("tdg-meta-ready", trackChristmasPackView, { once: true });
    return;
  }
  viewTracked = true;
  send("ViewContent", { content_ids: ["christmas_photo"], content_type: "product" });
}

export function trackChristmasPackCheckout(input: {
  orderId: string; amountCents: number; currency?: string;
}) {
  if (!input.orderId || !Number.isFinite(input.amountCents) || input.amountCents <= 0 || !/^[a-z]{3}$/i.test(input.currency || "")) return;
  send("InitiateCheckout", {
    order_id: input.orderId, value: input.amountCents / 100,
    currency: input.currency!.toUpperCase(), content_type: "product",
    content_ids: ["christmas_photo"],
  }, `christmas_ic_${input.orderId}`);
}

/** Only call with the authenticated server order response, never redirect parameters. */
export function trackChristmasPackPurchase(input: {
  orderId: string; status: string; paidAt?: string | null;
  amountCents: number; currency?: string; packKey: string;
}) {
  if (!input.paidAt || !Number.isFinite(Date.parse(input.paidAt))) return;
  if (!["paid", "generating", "complete", "partial_failure", "awaiting_qc"].includes(input.status)) return;
  if (!input.orderId || !Number.isFinite(input.amountCents) || input.amountCents <= 0 || !/^[a-z]{3}$/i.test(input.currency || "")) return;
  send("Purchase", {
    order_id: input.orderId, value: input.amountCents / 100,
    currency: input.currency!.toUpperCase(), content_type: "product",
    content_ids: [`christmas_${input.packKey}`],
  }, `christmas_purchase_${input.orderId}`);
}
