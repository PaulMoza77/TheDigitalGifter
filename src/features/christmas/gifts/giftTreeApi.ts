import { supabase } from "@/lib/supabase";
import {
  GIFT_TREE_PRODUCT_KEY,
  type GiftTreeRewardDef,
  findGiftTreeReward,
} from "./rewardCatalog";
import { getOrCreateGiftTreeGuestToken } from "./giftState";

const EDGE_FUNNEL_URL = `${String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "")}/functions/v1/christmas-tree-funnel`;
const ORIGIN_API_URL = "/api/christmas/gift-tree";

export type GiftTreeOpenResult = {
  ok: boolean;
  already?: boolean;
  claim_id: string;
  reward_id: string;
  reward: {
    id: string;
    type: string;
    value: number;
    title: string;
    description: string;
    entitlement_key: string;
    claim_path: string;
  };
  credits_granted: number;
  requires_auth_for_credits: boolean;
  extra_opens?: number;
};

async function authBearer(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

async function postGiftTree<T>(
  url: string,
  body: Record<string, unknown>,
  bearer: string | null,
  useSupabaseHeaders: boolean,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (useSupabaseHeaders) {
    const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "");
    headers.apikey = anon;
    headers.Authorization = `Bearer ${bearer || anon}`;
  } else if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `gift_tree_${res.status}`);
  }
  return data;
}

/** Prefer same-origin Mozas API; fall back to Supabase Edge tree funnel. */
async function giftTreeRequest<T>(body: Record<string, unknown>): Promise<T> {
  const bearer = await authBearer();
  try {
    return await postGiftTree<T>(ORIGIN_API_URL, body, bearer, false);
  } catch {
    return await postGiftTree<T>(EDGE_FUNNEL_URL, body, bearer, true);
  }
}

export async function openGiftTreeOnServer(input: {
  presentId: string;
  /** 0 = free first open; >0 = paid/extra open slot for unique source_ref */
  openSlot?: number;
}): Promise<GiftTreeOpenResult> {
  const guestToken = getOrCreateGiftTreeGuestToken();
  const openSlot =
    typeof input.openSlot === "number" && Number.isFinite(input.openSlot)
      ? Math.max(0, Math.floor(input.openSlot))
      : 0;
  return giftTreeRequest<GiftTreeOpenResult>({
    action: "openGiftTree",
    present_id: input.presentId,
    open_slot: openSlot,
    guest_token: guestToken,
    product_key: GIFT_TREE_PRODUCT_KEY,
  });
}

export async function claimGiftTreeOnServer(input: {
  claimId?: string | null;
}): Promise<{
  ok: boolean;
  credits_granted: number;
  reward_id: string;
  already?: boolean;
}> {
  const guestToken = getOrCreateGiftTreeGuestToken();
  return giftTreeRequest<{
    ok: boolean;
    credits_granted: number;
    reward_id: string;
    already?: boolean;
  }>({
    action: "claimGiftTree",
    claim_id: input.claimId || undefined,
    guest_token: guestToken,
    product_key: GIFT_TREE_PRODUCT_KEY,
  });
}

export function rewardFromServerPayload(
  payload: GiftTreeOpenResult["reward"],
): GiftTreeRewardDef | null {
  const local = findGiftTreeReward(payload.id);
  if (local) return local;
  return {
    id: payload.id,
    type: payload.type as GiftTreeRewardDef["type"],
    value: payload.value,
    title: payload.title,
    headline: payload.title,
    description: payload.description,
    weight: 1,
    rarity: "common",
    claimPath: payload.claim_path,
    entitlementKey: payload.entitlement_key,
    requiresAuthToGrant: payload.type === "credits",
  };
}
