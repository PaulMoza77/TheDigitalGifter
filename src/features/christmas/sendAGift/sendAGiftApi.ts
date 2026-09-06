import { supabase } from "@/lib/supabase";
import {
  SEND_A_GIFT_PACKAGES,
  SEND_A_GIFT_PACKAGE_KEYS,
  type SendAGiftPackageKey,
} from "./packageComposition";

const FN = "christmas-send-a-gift";

async function invoke<T>(body: Record<string, unknown>, bearer?: string | null): Promise<T> {
  const { data, error } = await supabase.functions.invoke(FN, {
    body,
    headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined,
  });
  if (error) throw new Error(error.message || "send_a_gift_invoke_failed");
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export type GiftPublicView = {
  id: string;
  share_id: string;
  package_key: string;
  status: string;
  first_opened_at: string | null;
  activated_at: string | null;
  sender_label: string | null;
  recipient_label: string | null;
  entitlements: Array<{
    service_key: string;
    quantity_total: number;
    quantity_used: number;
    quantity_remaining: number;
  }>;
};

export async function fetchSendAGiftCatalog() {
  try {
    return await invoke<{
      ok: boolean;
      packages: Array<Record<string, unknown>>;
      production_purchasable: boolean;
    }>({ action: "getCatalog" });
  } catch {
    return {
      ok: true,
      production_purchasable: false,
      packages: SEND_A_GIFT_PACKAGE_KEYS.map((key) => {
        const p = SEND_A_GIFT_PACKAGES[key];
        return {
          package_key: p.packageKey,
          package_name: p.packageName,
          description: p.description,
          price_cents: p.priceCents,
          purchasable: p.purchasable,
          features: p.features,
        };
      }),
    };
  }
}

export async function fetchGiftByShareId(shareId: string): Promise<GiftPublicView | null> {
  const data = await invoke<{ ok: boolean; gift: GiftPublicView | null; status?: string }>({
    action: "getGift",
    share_id: shareId,
  });
  if (data.status === "disabled") return null;
  return data.gift;
}

export async function markGiftOpened(shareId: string) {
  return invoke({ action: "markOpened", share_id: shareId });
}

export async function redeemGiftEntitlement(input: {
  shareId: string;
  serviceKey: string;
  idempotencyKey: string;
}) {
  return invoke<{ ok: boolean; result: Record<string, unknown> }>({
    action: "redeem",
    share_id: input.shareId,
    service_key: input.serviceKey,
    idempotency_key: input.idempotencyKey,
  });
}

export async function adminListSendGifts(bearer: string) {
  return invoke<{ ok: boolean; gifts: Array<Record<string, unknown>> }>(
    { action: "adminList" },
    bearer,
  );
}

export async function adminDisableSendGift(bearer: string, shareId: string) {
  return invoke({ action: "adminDisable", share_id: shareId }, bearer);
}

export function isPackageKey(value: string): value is SendAGiftPackageKey {
  return (SEND_A_GIFT_PACKAGE_KEYS as readonly string[]).includes(value);
}
