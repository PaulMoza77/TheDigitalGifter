/**
 * Paid-generation claim interpreter.
 * Keep in sync with src/features/christmas/generationGuards.ts
 * and supabase/functions/_shared/christmas/generationClaim.ts.
 */

export const CHRISTMAS_PAYMENT_REQUIRED_HTTP = 402 as const;
export const CHRISTMAS_PAYMENT_REQUIRED_CODE = "payment_required" as const;

export type ChristmasGenerationClaimResult = {
  claimed?: boolean;
  reason?: string;
  status?: string;
  payment_status?: string;
};

export function christmasOrderIsPaid(input: {
  paymentStatus?: string | null;
  paidAt?: string | null;
}): boolean {
  const paymentStatus = String(input.paymentStatus ?? "").trim();
  if (paymentStatus) return paymentStatus === "paid";
  return Boolean(input.paidAt);
}

export function parseChristmasGenerationClaim(raw: unknown): ChristmasGenerationClaimResult | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return parseChristmasGenerationClaim(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (typeof raw !== "object") return null;
  return raw as ChristmasGenerationClaimResult;
}

export type InterpretedChristmasGenerationClaim =
  | { kind: "proceed" }
  | {
      kind: "payment_required";
      httpStatus: typeof CHRISTMAS_PAYMENT_REQUIRED_HTTP;
      body: {
        error: typeof CHRISTMAS_PAYMENT_REQUIRED_CODE;
        code: typeof CHRISTMAS_PAYMENT_REQUIRED_CODE;
        claim: ChristmasGenerationClaimResult | null;
      };
    }
  | {
      kind: "not_claimed";
      httpStatus: 200;
      body: { ok: true; status: string; claim: ChristmasGenerationClaimResult | null };
    };

export function interpretChristmasGenerationClaim(
  claim: ChristmasGenerationClaimResult | null | undefined,
): InterpretedChristmasGenerationClaim {
  const safe = claim ?? null;
  if (safe?.reason === CHRISTMAS_PAYMENT_REQUIRED_CODE) {
    return {
      kind: "payment_required",
      httpStatus: CHRISTMAS_PAYMENT_REQUIRED_HTTP,
      body: {
        error: CHRISTMAS_PAYMENT_REQUIRED_CODE,
        code: CHRISTMAS_PAYMENT_REQUIRED_CODE,
        claim: safe,
      },
    };
  }
  if (!safe?.claimed) {
    return {
      kind: "not_claimed",
      httpStatus: 200,
      body: { ok: true, status: safe?.status || "not_claimed", claim: safe },
    };
  }
  return { kind: "proceed" };
}
