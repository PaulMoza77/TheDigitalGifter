import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  isCheckoutPlaceholderEmail,
  petInitiateCheckoutEventId,
  sendMetaCapiInitiateCheckout,
} from "./meta.ts";

const V3_META_IC_ACTION = "v3_meta_initiate_checkout";

export function shouldDeferInitiateCheckoutToInteraction(funnelVariant: unknown): boolean {
  return String(funnelVariant ?? "").trim() === "v3";
}

export async function recordV3MetaInitiateCheckoutOnce(
  service: SupabaseClient,
  input: {
    orderId: string;
    email?: string | null;
    amountCents: number;
    sourceUrl?: string;
    fbc?: string | null;
    fbp?: string | null;
  },
): Promise<{ sent: boolean; alreadySent: boolean; eventId: string; reason?: string }> {
  const eventId = petInitiateCheckoutEventId(input.orderId);
  if (!input.orderId || !Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    return { sent: false, alreadySent: false, eventId, reason: "invalid" };
  }

  const { data: prior } = await service
    .from("pet_order_events")
    .select("id")
    .eq("order_id", input.orderId)
    .eq("action", V3_META_IC_ACTION)
    .limit(1)
    .maybeSingle();
  if (prior) {
    return { sent: false, alreadySent: true, eventId };
  }

  const emailForMeta =
    input.email && !isCheckoutPlaceholderEmail(input.email) ? input.email : null;
  const capi = await sendMetaCapiInitiateCheckout({
    eventId,
    orderId: input.orderId,
    email: emailForMeta,
    amountCents: input.amountCents,
    fbc: input.fbc,
    fbp: input.fbp,
    sourceUrl: input.sourceUrl,
  });

  await service.rpc("pet_log_event", {
    p_order_id: input.orderId,
    p_action: V3_META_IC_ACTION,
    p_actor_type: "customer",
    p_payload: {
      event_id: eventId,
      capi_sent: capi.sent,
      capi_reason: capi.reason ?? null,
      has_fbc: Boolean(input.fbc),
      has_fbp: Boolean(input.fbp),
    },
  });

  return {
    sent: capi.sent,
    alreadySent: false,
    eventId,
    reason: capi.reason,
  };
}
