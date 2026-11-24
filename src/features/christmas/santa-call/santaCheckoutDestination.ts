/** Hosted Stripe sessions have no client secret. Validate before locking the form. */
export function resolveSantaCheckout(data: {
  uiMode?: string;
  checkoutUrl?: string | null;
  clientSecret?: string | null;
  publishableKey?: string | null;
}) {
  if (data.uiMode === "hosted") {
    const url = new URL(data.checkoutUrl || "");
    if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com" || url.username || url.password) {
      throw new Error("checkout_incomplete");
    }
    return { kind: "hosted" as const, url: url.href };
  }
  if (!data.clientSecret || !data.publishableKey) throw new Error("checkout_incomplete");
  return { kind: "custom" as const, clientSecret: data.clientSecret, publishableKey: data.publishableKey };
}
