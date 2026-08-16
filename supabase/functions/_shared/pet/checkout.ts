export function stripeCheckoutIdempotencyKey(orderId: string, issuedCount = 0): string {
  if (issuedCount <= 0) return `pet-checkout-${orderId}`;
  return `pet-checkout-${orderId}-${issuedCount}`;
}

export function shouldReuseCheckoutSession(session: {
  status?: string | null;
  url?: string | null;
  expires_at?: number | null;
} | null): boolean {
  if (!session?.url) return false;
  if (session.status && session.status !== "open") return false;
  if (session.expires_at && session.expires_at * 1000 <= Date.now()) return false;
  return true;
}

export function decideCheckoutSessionAction(input: {
  existingSession: {
    id: string;
    status?: string | null;
    url?: string | null;
    expires_at?: number | null;
  } | null;
  orderId: string;
  issuedCount: number;
}): { action: "reuse"; sessionId: string } | { action: "create"; idempotencyKey: string } {
  if (input.existingSession && shouldReuseCheckoutSession(input.existingSession)) {
    return { action: "reuse", sessionId: input.existingSession.id };
  }
  const issuedCount =
    input.existingSession && !shouldReuseCheckoutSession(input.existingSession)
      ? Math.max(input.issuedCount, 1)
      : input.issuedCount;
  return {
    action: "create",
    idempotencyKey: stripeCheckoutIdempotencyKey(input.orderId, issuedCount),
  };
}
