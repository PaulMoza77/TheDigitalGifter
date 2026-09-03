/** Client API for Christmas Wishlist + Gift Finder. */

const FUNNEL_URL = `${String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "")}/functions/v1/christmas-wishlist-funnel`;

export const WISHLIST_OWNER_KEY = "tdg.christmas.wishlist.owner.v1";
export const FINDER_GUEST_KEY = "tdg.christmas.gift_finder.guest.v1";
export const FINDER_SESSION_KEY = "tdg.christmas.gift_finder.session.v1";

export type WishlistItem = {
  id: string;
  sort_order: number;
  title: string;
  note?: string;
  external_url?: string | null;
  priority?: string;
  budget_amount?: number | null;
  currency?: string | null;
  source_type?: string;
  source_ref?: string | null;
};

export type OwnerWishlist = {
  id: string;
  share_id: string;
  share_enabled: boolean;
  title: string;
  description: string;
  locale: string;
  currency: string | null;
  show_budgets_public: boolean;
  items: WishlistItem[];
};

export type SharedWishlist = {
  share_id: string;
  title: string;
  description: string;
  locale: string;
  items: WishlistItem[];
};

export type GiftIdea = {
  id: string;
  result_key: string;
  title: string;
  reason: string;
  budget_min: number | null;
  budget_max: number | null;
  currency?: string | null;
  category: string;
  search_query: string;
  tdg_product_key?: string | null;
};

async function headers(authBearer?: string | null): Promise<Record<string, string>> {
  const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "");
  return {
    "Content-Type": "application/json",
    apikey: anon,
    Authorization: `Bearer ${authBearer || anon}`,
  };
}

export async function wishlistFunnel<T = Record<string, unknown>>(
  body: Record<string, unknown>,
  authBearer?: string | null,
): Promise<T> {
  const res = await fetch(FUNNEL_URL, {
    method: "POST",
    headers: await headers(authBearer),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `wishlist_funnel_${res.status}`);
  return data;
}

export type OwnerRecovery = { wishlistId: string; ownerToken: string; shareId: string };

export function readWishlistOwner(): OwnerRecovery | null {
  try {
    const raw = localStorage.getItem(WISHLIST_OWNER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OwnerRecovery;
    if (!parsed.wishlistId || !parsed.ownerToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeWishlistOwner(value: OwnerRecovery | null) {
  try {
    if (!value) localStorage.removeItem(WISHLIST_OWNER_KEY);
    else localStorage.setItem(WISHLIST_OWNER_KEY, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function getOrCreateFinderGuestToken(): string {
  try {
    const existing = localStorage.getItem(FINDER_GUEST_KEY);
    if (existing && existing.length >= 32) return existing;
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(FINDER_GUEST_KEY, token);
    return token;
  } catch {
    return `guest_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

export function sanitizeExternalUrlClient(raw: string): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (/^(javascript|data|vbscript):/i.test(value)) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString().slice(0, 500);
  } catch {
    return null;
  }
}

export function itemCountBucket(count: number): string {
  if (count <= 0) return "0";
  if (count === 1) return "1";
  if (count <= 3) return "2-3";
  if (count <= 6) return "4-6";
  return "7+";
}

export function reorderIds(ids: string[], fromIndex: number, toIndex: number): string[] {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= ids.length || toIndex >= ids.length) return [...ids];
  const next = [...ids];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}
