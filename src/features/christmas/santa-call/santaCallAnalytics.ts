import { readCookieConsent } from "@/lib/cookieConsent";
import { isSantaCallQaCheckoutEnabled } from "./santaCallPublic";

type SafeParams = Record<string, string | number | boolean | undefined>;
export const SANTA_EVENTS = {
  santa_checkout_error: "santa_checkout_error",
  santa_checkout_loaded: "santa_checkout_loaded",
  santa_payment_interaction: "santa_payment_interaction",
  santa_payment_load_error: "santa_payment_load_error",
  santa_page_view: "page_view",
  santa_cta_click: "santa_cta_click",
  santa_form_start: "santa_form_start",
  santa_form_complete: "santa_form_complete",
  santa_checkout_started: "begin_checkout",
  santa_checkout_session_created: "santa_checkout_session_created",
  santa_purchase_confirmed: "purchase",
  santa_call_started: "santa_call_started",
  santa_call_completed: "santa_call_completed",
  santa_call_failed: "santa_call_failed",
  santa_extension_purchased: "purchase",
} as const;

/** Reject unknown keys rather than trying to redact arbitrary personalization. */
export function safeSantaParams(params: SafeParams): SafeParams {
  const out: SafeParams = {};
  for (const key of ["value", "seconds_granted"] as const) {
    const n = params[key];
    if (typeof n === "number" && Number.isFinite(n) && n >= 0) out[key] = n;
  }
  for (const [key, allowed] of Object.entries({
    currency: ["RON", "USD"],
    market: ["ro", "us"],
    language: ["ro", "en"],
    payment_type: ["initial", "extension"],
    provider: ["openai_realtime"],
  })) {
    if (
      typeof params[key] === "string" &&
      allowed.includes(params[key] as string)
    )
      out[key] = params[key];
  }
  if (
    typeof params.transaction_id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(params.transaction_id)
  )
    out.transaction_id = params.transaction_id;
  return out;
}

function once(key: string): boolean {
  try {
    if (window.sessionStorage.getItem(key) === "1") return false;
    window.sessionStorage.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
}

/** Consent-aware GA4 helper. Never pass names, email, audio, transcript or access tokens. */
export function trackSantaCallAnalytics(
  eventName: keyof typeof SANTA_EVENTS,
  params: SafeParams = {},
  onceKey?: string,
) {
  if (
    typeof window === "undefined" ||
    readCookieConsent() !== "granted" ||
    isSantaCallQaCheckoutEnabled()
  )
    return false;
  // Private call rooms are measured by the runtime ledger. Never expose access URLs to third parties.
  if (
    /^\/(?:_qa|admin|santa\/call)(?:\/|$)/.test(window.location?.pathname || "")
  )
    return false;
  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void })
    .gtag;
  if (typeof gtag !== "function") return false;
  const safe = safeSantaParams(params);
  const purchase = SANTA_EVENTS[eventName] === "purchase";
  if (purchase && (!safe.transaction_id || !safe.value || !safe.currency))
    return false;
  const key = purchase ? `purchase.${safe.transaction_id}` : onceKey;
  if (key && !once(`tdg.ga4.santa.${key}`)) return false;
  const attribution: SafeParams = {};
  try {
    const query = new URLSearchParams(window.location.search);
    // Campaign dimensions travel separately; no fbclid, email, child details or access token in the page URL.
    for (const [utm, ga] of [
      ["utm_source", "campaign_source"],
      ["utm_medium", "campaign_medium"],
      ["utm_campaign", "campaign_name"],
      ["utm_content", "campaign_content"],
    ]) {
      const v = query.get(utm);
      if (v && /^[a-zA-Z0-9_.-]{1,100}$/.test(v)) attribution[ga] = v;
    }
  } catch {
    /* no attribution is better than a private URL */
  }
  try {
    gtag("event", SANTA_EVENTS[eventName], {
      ...safe,
      ...attribution,
      santa_event: eventName,
      product_key: "christmas_santa_voice_call",
      page_location: `${window.location.origin}/christmas/santa-call`,
      page_path: "/christmas/santa-call",
      page_referrer: "",
      send_to: "G-YF2GRM2TL4",
      transport_type: "beacon",
      ...(purchase
        ? {
            items: [
              {
                item_id:
                  params.payment_type === "extension"
                    ? "christmas_santa_voice_call_extension"
                    : "christmas_santa_voice_call",
                quantity: 1,
                price: safe.value,
              },
            ],
          }
        : {}),
    });
    return true;
  } catch {
    return false;
  } // Tracking must not prevent checkout.
}
