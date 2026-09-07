import { resolveProductStyle } from "./portraitStyles";
import { resolveChristmasStyle, type ChristmasStyleDef } from "./styles";

export function assertStyleAllowed(
  styleKey: string,
  styles?: ChristmasStyleDef[],
  productKey?: string,
): { ok: true; style: ChristmasStyleDef } | { ok: false; code: "unknown_style" | "disabled_style" } {
  if (productKey) {
    const style = resolveProductStyle(productKey, styleKey);
    if (!style) return { ok: false, code: "unknown_style" };
    return { ok: true, style };
  }
  const style = resolveChristmasStyle(styleKey, styles);
  if (!style) {
    const exists = (styles || []).some((s) => s.styleKey === styleKey);
    return { ok: false, code: exists ? "disabled_style" : "unknown_style" };
  }
  return { ok: true, style };
}

/** Reject arbitrary client-supplied prompt text — generation must use server registry only. */
export function rejectClientPrompt(clientPrompt: unknown): { ok: true } | { ok: false; code: "client_prompt_rejected" } {
  if (clientPrompt == null || clientPrompt === "") return { ok: true };
  return { ok: false, code: "client_prompt_rejected" };
}

export const CHRISTMAS_PAYMENT_REQUIRED_HTTP = 402 as const;
export const CHRISTMAS_PAYMENT_REQUIRED_CODE = "payment_required" as const;

export function christmasOrderIsPaid(input: {
  paymentStatus?: string | null;
  paidAt?: string | null;
}): boolean {
  const paymentStatus = String(input.paymentStatus ?? "").trim();
  if (paymentStatus) return paymentStatus === "paid";
  return Boolean(input.paidAt);
}

export function canGenerateChristmasPhoto(input: {
  paymentStatus: string;
  fulfillmentStatus?: string;
}): { ok: true } | { ok: false; code: "payment_required" | "already_completed" } {
  if (!christmasOrderIsPaid({ paymentStatus: input.paymentStatus })) {
    return { ok: false, code: "payment_required" };
  }
  if (input.fulfillmentStatus === "completed") {
    return { ok: false, code: "already_completed" };
  }
  return { ok: true };
}

export type ChristmasGenerationClaimResult = {
  claimed?: boolean;
  reason?: string;
  status?: string;
  payment_status?: string;
};

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

/** Defense-in-depth: claim RPC payment_required must never become HTTP 200. */
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

/** Spoofed client "payment succeeded" must never authorize generation. */
export function clientPaymentClaimAuthorizesGeneration(_clientClaim: unknown): false {
  void _clientClaim;
  return false;
}
