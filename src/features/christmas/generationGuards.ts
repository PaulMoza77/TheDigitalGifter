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

export function canGenerateChristmasPhoto(input: {
  paymentStatus: string;
  fulfillmentStatus?: string;
}): { ok: true } | { ok: false; code: "payment_required" | "already_completed" } {
  if (input.paymentStatus !== "paid") {
    return { ok: false, code: "payment_required" };
  }
  if (input.fulfillmentStatus === "completed") {
    return { ok: false, code: "already_completed" };
  }
  return { ok: true };
}

/** Spoofed client "payment succeeded" must never authorize generation. */
export function clientPaymentClaimAuthorizesGeneration(_clientClaim: unknown): false {
  void _clientClaim;
  return false;
}
