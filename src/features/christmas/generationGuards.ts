import { resolveChristmasStyle, type ChristmasStyleDef } from "./styles";

export function assertStyleAllowed(
  styleKey: string,
  styles?: ChristmasStyleDef[],
): { ok: true; style: ChristmasStyleDef } | { ok: false; code: "unknown_style" | "disabled_style" } {
  const style = resolveChristmasStyle(styleKey, styles);
  if (!style) {
    const exists = (styles || []).some((s) => s.styleKey === styleKey);
    return { ok: false, code: exists ? "disabled_style" : "unknown_style" };
  }
  return { ok: true, style };
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
