export function parseCheckoutRequestId(value: unknown): string {
  const raw = String(value || "").trim().toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(raw)) {
    return raw;
  }
  return "";
}

export function checkoutRedeemKey(checkoutRequestId: string): string {
  return `checkout-redeem:${checkoutRequestId}`;
}

export function canReusePendingCheckout(status: string | null | undefined): boolean {
  return String(status || "") === "pending";
}

export function stripeCheckoutReuseAction(args: {
  sessionId: string | null;
  sessionStatus: string | null;
  sessionUrl: string | null;
}): "return_existing" | "replay_idempotent_create" | "paid_keep_pending" {
  const status = String(args.sessionStatus || "").toLowerCase();
  if (status === "complete") return "paid_keep_pending";
  if (args.sessionId && status === "open" && args.sessionUrl) return "return_existing";
  return "replay_idempotent_create";
}
