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
  ui_mode?: string | null;
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

export type PetCheckoutUiMode = "hosted" | "embedded" | "custom" | "elements";

/** Normalize client uiMode. `embedded` remains a V1 alias for Custom Checkout. */
export function normalizeCheckoutUiMode(uiMode?: string | null): "hosted" | "custom" | "elements" {
  const raw = String(uiMode || "").trim().toLowerCase();
  if (raw === "elements") return "elements";
  if (raw === "custom" || raw === "embedded") return "custom";
  return "hosted";
}

export function isOnPageCheckoutUi(uiMode?: string | null): boolean {
  const mode = normalizeCheckoutUiMode(uiMode);
  return mode === "custom" || mode === "elements";
}

/** Reuse an open on-page Session only when its Stripe ui_mode matches the request. */
export function sessionMatchesRequestedUiMode(
  sessionUiMode: string | null | undefined,
  requested: "custom" | "elements" | "hosted",
): boolean {
  const existing = String(sessionUiMode || "").trim().toLowerCase();
  if (requested === "hosted") return !existing || existing === "hosted_page" || existing === "hosted";
  if (requested === "elements") return existing === "elements";
  if (requested === "custom") return existing === "custom";
  return false;
}

export function decideCheckoutSessionAction(input: {
  existingSession: StripeCheckoutSessionView | null;
  orderId: string;
  issuedCount: number;
  uiMode?: PetCheckoutUiMode;
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

export function sanitizeStripeCheckoutCustomerError(message?: string | null): string {
  const raw = String(message || "").trim();
  if (!raw) return "Enter your full card details before paying.";
  if (/cancel(ed)?|aborted|dismiss/i.test(raw)) return "";
  if (/incomplete|empty|invalid.*card|card number|expir|cvc|security code|payment details/i.test(raw)) {
    return "Enter your full card details before paying.";
  }
  if (/declined|insufficient|do not honor|not permitted|lost card|stolen card/i.test(raw)) {
    return "Your card was declined. Try another card or contact your bank.";
  }
  if (/no such checkout\.session|checkout\.session.*expired|session.*expired/i.test(raw)) {
    return "This payment session expired. Tap Retry secure payment.";
  }
  if (/publishable key|api key/i.test(raw)) {
    return "We couldn't load secure payment. Please try again.";
  }
  return "We couldn't complete payment. Please try again.";
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
