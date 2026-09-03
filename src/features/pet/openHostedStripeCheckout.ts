/**
 * Open Stripe hosted Checkout. Prefer a new tab when the caller has a user gesture;
 * fall back to same-tab navigation when popups are blocked (common on iOS Safari).
 */
export function isStripeHostedCheckoutUrl(url: string): boolean {
  return String(url || "").trim().startsWith("https://checkout.stripe.com/");
}

export function openHostedStripeCheckout(
  url: string,
  opts?: { preferNewTab?: boolean },
): "new_tab" | "same_tab" {
  const target = String(url || "").trim();
  if (!isStripeHostedCheckoutUrl(target)) {
    throw new Error("invalid_stripe_checkout_url");
  }

  if (opts?.preferNewTab !== false) {
    try {
      const opened = window.open(target, "_blank", "noopener,noreferrer");
      if (opened) return "new_tab";
    } catch {
      // Popup blocked or window.open unavailable — same-tab below.
    }
  }

  window.location.assign(target);
  return "same_tab";
}
