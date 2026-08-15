export function validatePaidStripeSession(args: {
  paymentStatus: string | null;
  amountTotal: number | null;
  currency: string | null;
  metadataSku: string | null;
  expectedAmountCents: number;
  expectedCurrency: string;
  expectedSku: string;
}): { ok: true } | { ok: false; error: string } {
  const status = String(args.paymentStatus || "").toLowerCase();
  if (status && status !== "paid") {
    return { ok: false, error: "unpaid_session" };
  }
  if (args.amountTotal !== args.expectedAmountCents) {
    return { ok: false, error: "amount_mismatch" };
  }
  if (String(args.currency || "").toLowerCase() !== args.expectedCurrency.toLowerCase()) {
    return { ok: false, error: "currency_mismatch" };
  }
  if (String(args.metadataSku || "") !== args.expectedSku) {
    return { ok: false, error: "sku_mismatch" };
  }
  return { ok: true };
}

export function stripeCheckoutIdempotencyKey(orderId: string): string {
  return `checkout:${orderId}`;
}

export function stripeSessionRetrievePath(sessionId: string): string {
  return `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`;
}

export function stripeExpireSessionPath(sessionId: string): string {
  return `/v1/checkout/sessions/${encodeURIComponent(sessionId)}/expire`;
}

export function stripeExpireConfirmed(args: {
  expireHttpOk: boolean;
  expireHttpStatus: number;
  expireSessionStatus?: string | null;
  getHttpOk?: boolean;
  getHttpStatus?: number;
  getSessionStatus?: string | null;
}): { confirmedExpired: boolean; sessionStatus: string | null } {
  const expireStatus = String(args.expireSessionStatus || "").toLowerCase();
  const getStatus = String(args.getSessionStatus || "").toLowerCase();
  if (
    args.expireHttpOk &&
    args.expireHttpStatus >= 200 &&
    args.expireHttpStatus < 300 &&
    expireStatus === "expired"
  ) {
    return { confirmedExpired: true, sessionStatus: "expired" };
  }
  if (args.getHttpOk && (args.getHttpStatus ?? 200) >= 200 && (args.getHttpStatus ?? 200) < 300 && getStatus === "expired") {
    return { confirmedExpired: true, sessionStatus: "expired" };
  }
  return {
    confirmedExpired: false,
    sessionStatus: expireStatus || getStatus || null,
  };
}

export type ResultEmailSendResult =
  | { ok: true }
  | { ok: false; skipped: boolean; error?: string };

export function shouldStampResultEmailedAt(result: ResultEmailSendResult): boolean {
  return result.ok === true;
}
