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
