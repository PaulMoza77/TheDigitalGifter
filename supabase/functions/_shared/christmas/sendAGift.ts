import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { asString } from "./crypto.ts";

export const SEND_A_GIFT_PRODUCT_KEY = "christmas_send_a_gift";

export function isSendAGiftProductKey(value: unknown): boolean {
  return asString(value) === SEND_A_GIFT_PRODUCT_KEY;
}

export type ActivateSendAGiftResult = {
  ok: boolean;
  status?: string;
  gift_id?: string | null;
  share_token?: string | null;
  created?: boolean;
  reason?: string | null;
};

/** Call DB RPC that activates gift + materializes entitlements exactly once. */
export async function activateSendAGiftAfterPaid(input: {
  service: SupabaseClient;
  orderId: string;
  eventId?: string | null;
}): Promise<ActivateSendAGiftResult> {
  const { data, error } = await input.service.rpc("activate_christmas_send_a_gift", {
    p_order_id: input.orderId,
    p_activation_event_id: input.eventId ?? null,
  });
  if (error) {
    return { ok: false, reason: error.message };
  }
  const result = (data || {}) as Record<string, unknown>;
  return {
    ok: result.ok === true,
    status: asString(result.status) || undefined,
    gift_id: asString(result.gift_share_id) || asString(result.share_id) || null,
    share_token: asString(result.share_id) || null,
    created: asString(result.status) === "activated",
    reason: asString(result.reason) || null,
  };
}
