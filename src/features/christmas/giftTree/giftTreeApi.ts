import { supabase } from "@/lib/supabase";
import { GIFT_TREE_GUEST_STORAGE_KEY } from "./giftTreeLogic";

const FUNNEL_URL = `${String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "")}/functions/v1/christmas-gift-tree-funnel`;
const CHECKOUT_URL = `${String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "")}/functions/v1/christmas-checkout`;

export type GiftTreePack = {
  package_key: string;
  package_name: string;
  description: string;
  price_cents: number;
  currency: string;
  active: boolean;
  purchasable: boolean;
  opens: number;
};

export type GiftTreeOpenRow = {
  id: string;
  open_kind: string;
  box_slot: number | null;
  reward_key: string;
  reward_type: string;
  title: string;
  entitlement_key?: string | null;
  created_at: string;
};

export type GiftTreeStatus = {
  ok: boolean;
  product_key: string;
  season_year: number;
  distinct_from: string;
  engine_ready: boolean;
  production_opens_live: boolean;
  gift_tree_enabled: boolean;
  credits_enabled: boolean;
  identity: "user" | "guest" | null;
  remaining_free_opens: number;
  remaining_paid_opens: number;
  remaining_opens: number;
  free_opens_per_season: number;
  opens: GiftTreeOpenRow[];
  packs: GiftTreePack[];
};

export type GiftTreeReward = {
  reward_key: string;
  reward_type: string;
  title: string;
  description?: string;
  entitlement_key?: string | null;
  message?: string | null;
  credits_granted?: number;
};

async function headers(): Promise<Record<string, string>> {
  const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "");
  const { data } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    apikey: anon,
    Authorization: `Bearer ${data.session?.access_token || anon}`,
  };
}

export async function giftTreeFunnel<T = Record<string, unknown>>(
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(FUNNEL_URL, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `gift_tree_${res.status}`);
  }
  return data;
}

export async function startGiftTreeCheckout(body: Record<string, unknown>) {
  const res = await fetch(CHECKOUT_URL, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || "Checkout failed") as Error & { code?: string };
    err.code = data.code;
    throw err;
  }
  return data as {
    ok: true;
    orderId: string;
    publicToken: string | null;
    sessionId: string;
    clientSecret: string;
    publishableKey: string;
    amountCents: number;
    currency: string;
    uiMode: "custom";
  };
}

export function getOrCreateGiftTreeGuestToken(): string {
  try {
    const existing = localStorage.getItem(GIFT_TREE_GUEST_STORAGE_KEY);
    if (existing && existing.length >= 32) return existing;
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(GIFT_TREE_GUEST_STORAGE_KEY, token);
    return token;
  } catch {
    const bytes = new Uint8Array(32);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
      return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return `guest_fallback_${Date.now()}`;
  }
}

export function clearGiftTreeGuestToken() {
  try {
    localStorage.removeItem(GIFT_TREE_GUEST_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
