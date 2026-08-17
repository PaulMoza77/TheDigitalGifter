/** Shared high-conversion upsell UI copy */
export const UPSELL_UNLOCK_LABEL = "Unlock more";
export const UPSELL_SHEET_TITLE = "Unlock more from this portrait";
export const UPSELL_SHEET_SUBTITLE =
  "One-time add-ons · Instant download · Secure Stripe checkout";
export const UPSELL_SCENE_SECTION = "For this portrait";
export const UPSELL_ORDER_SECTION = "For your whole order";
export const UPSELL_TRUST_LINE = "No subscription · Pay once · Download right away";

export function upsellReturnUrls(publicToken: string, kind: "success" | "retry" = "success") {
  const onOrderPage = window.location.pathname.includes("/pet/order");
  const base = onOrderPage
    ? `${window.location.origin}/pet/order?token=${encodeURIComponent(publicToken)}`
    : `${window.location.origin}/account/dashboard`;
  const join = base.includes("?") ? "&" : "?";
  return {
    successUrl: `${base}${join}upsell=${kind === "retry" ? "retry" : "success"}`,
    cancelUrl: base,
  };
}
