export function stripeCheckoutIdempotencyKey(orderId: string, issuedCount = 0): string {
  if (issuedCount <= 0) return `pet-checkout-${orderId}`;
  return `pet-checkout-${orderId}-${issuedCount}`;
}

export type StripeCheckoutSessionView = {
  id: string;
  status?: string | null;
  url?: string | null;
  client_secret?: string | null;
  expires_at?: number | null;
  payment_status?: string | null;
};

export function sessionIsExpired(session: StripeCheckoutSessionView | null): boolean {
  if (!session) return false;
  if (session.status === "expired") return true;
  if (session.expires_at && session.expires_at * 1000 <= Date.now()) return true;
  return false;
}

export function sessionIsPaymentProcessing(session: StripeCheckoutSessionView | null): boolean {
  if (!session) return false;
  const status = String(session.status || "");
  const payment = String(session.payment_status || "");
  if (status === "complete") return true;
  if (payment === "paid" || payment === "no_payment_required") return true;
  return false;
}

export function shouldReuseCheckoutSession(session: StripeCheckoutSessionView | null): boolean {
  if (!session?.id || !session.url) return false;
  if (sessionIsPaymentProcessing(session)) return false;
  if (sessionIsExpired(session)) return false;
  if (session.status && session.status !== "open") return false;
  return true;
}

export function isOnPageCheckoutUi(uiMode?: string | null): boolean {
  return uiMode === "embedded" || uiMode === "custom";
}

export function decideCheckoutSessionAction(input: {
  existingSession: StripeCheckoutSessionView | null;
  orderId: string;
  issuedCount: number;
  uiMode?: "hosted" | "embedded" | "custom";
}):
  | { action: "reuse"; sessionId: string; checkoutUrl: string }
  | { action: "create"; idempotencyKey: string; expectedSessionId: string | null }
  | { action: "payment_processing"; sessionId: string } {
  const canReuseHosted =
    !isOnPageCheckoutUi(input.uiMode) &&
    input.existingSession &&
    shouldReuseCheckoutSession(input.existingSession);
  if (canReuseHosted && input.existingSession) {
    return {
      action: "reuse",
      sessionId: input.existingSession.id,
      checkoutUrl: String(input.existingSession.url),
    };
  }
  if (input.existingSession && sessionIsPaymentProcessing(input.existingSession)) {
    return { action: "payment_processing", sessionId: input.existingSession.id };
  }
  const replacing = Boolean(input.existingSession);
  return {
    action: "create",
    idempotencyKey: stripeCheckoutIdempotencyKey(
      input.orderId,
      replacing ? Math.max(input.issuedCount, 1) : input.issuedCount,
    ),
    expectedSessionId: input.existingSession?.id ?? null,
  };
}

export function matchedOpenCheckoutResponse(session: {
  id?: string | null;
  url?: string | null;
  status?: string | null;
  expires_at?: number | null;
  payment_status?: string | null;
} | null): { ok: true; sessionId: string; checkoutUrl: string } | { ok: false; reason: "conflict" } {
  const sessionId = String(session?.id || "").trim();
  const checkoutUrl = String(session?.url || "").trim();
  if (!sessionId || !checkoutUrl) return { ok: false, reason: "conflict" };
  if (
    !shouldReuseCheckoutSession({
      id: sessionId,
      url: checkoutUrl,
      status: session?.status,
      expires_at: session?.expires_at,
      payment_status: session?.payment_status,
    })
  ) {
    return { ok: false, reason: "conflict" };
  }
  if (checkoutUrl.includes("cs_") && !checkoutUrl.includes(sessionId)) {
    return { ok: false, reason: "conflict" };
  }
  return { ok: true, sessionId, checkoutUrl };
}

export function isValidEmbeddedClientSecret(
  clientSecret: string | null | undefined,
  sessionId?: string | null,
): boolean {
  const secret = String(clientSecret || "").trim();
  if (!secret) return false;
  if (!/^cs_(live|test)_/.test(secret)) return false;
  if (!secret.includes("_secret_")) return false;
  const sid = String(sessionId || "").trim();
  if (sid && secret === sid) return false;
  return true;
}

export function sanitizeStripeCheckoutCustomerError(_message?: string | null): string {
  return "We couldn't load secure payment. Please try again.";
}

export function matchedEmbeddedCheckoutResponse(session: {
  id?: string | null;
  client_secret?: string | null;
  status?: string | null;
  expires_at?: number | null;
  payment_status?: string | null;
} | null): { ok: true; sessionId: string; clientSecret: string } | { ok: false; reason: "conflict" } {
  const sessionId = String(session?.id || "").trim();
  const clientSecret = String(session?.client_secret || "").trim();
  if (!sessionId || !isValidEmbeddedClientSecret(clientSecret, sessionId)) {
    return { ok: false, reason: "conflict" };
  }
  if (
    sessionIsPaymentProcessing({
      id: sessionId,
      status: session?.status,
      expires_at: session?.expires_at,
      payment_status: session?.payment_status,
    })
  ) {
    return { ok: false, reason: "conflict" };
  }
  if (
    sessionIsExpired({
      id: sessionId,
      status: session?.status,
      expires_at: session?.expires_at,
      payment_status: session?.payment_status,
    })
  ) {
    return { ok: false, reason: "conflict" };
  }
  if (session?.status && session.status !== "open") return { ok: false, reason: "conflict" };
  return { ok: true, sessionId, clientSecret };
}
