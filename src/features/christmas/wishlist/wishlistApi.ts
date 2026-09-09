/** Client API for Christmas Wishlist + Gift Finder. */

const FUNNEL_URL = `${String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "")}/functions/v1/christmas-wishlist-funnel`;

export const WISHLIST_OWNER_KEY = "tdg.christmas.wishlist.owner.v1";
export const WISHLIST_RESERVATION_KEY = "tdg.christmas.wishlist.reservations.v1";
export const FINDER_GUEST_KEY = "tdg.christmas.gift_finder.guest.v1";
export const FINDER_SESSION_KEY = "tdg.christmas.gift_finder.session.v1";

export type ReservationStatus = "none" | "reserved" | "purchased";

export type WishlistItem = {
  id: string;
  sort_order: number;
  title: string;
  note?: string;
  external_url?: string | null;
  image_url?: string | null;
  priority?: string;
  budget_amount?: number | null;
  currency?: string | null;
  quantity?: number;
  preference_size?: string;
  preference_color?: string;
  source_type?: string;
  source_ref?: string | null;
  /** Present on shared DTO; omitted/stripped for owner anti-spoiler by default */
  reservation_status?: ReservationStatus;
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
  audience?: string;
  view_count?: number;
  share_count?: number;
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
  gift_type?: string | null;
  ranking_role?: string | null;
  search_query: string;
  tdg_product_key?: string | null;
};

export type UrlPreview = {
  ok: boolean;
  title?: string | null;
  image_url?: string | null;
  retailer?: string | null;
  url: string;
  extracted: boolean;
  error?: string;
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
  if (!FUNNEL_URL || FUNNEL_URL.includes("placeholder.supabase")) {
    throw new Error("Wishlist service is not configured yet. Please try again later.");
  }
  let res: Response;
  try {
    res = await fetch(FUNNEL_URL, {
      method: "POST",
      headers: await headers(authBearer),
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Could not reach the wishlist service. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
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

/** Map of itemId → reservation_token for gifts this browser reserved. */
export function readReservations(): Record<string, string> {
  try {
    const raw = localStorage.getItem(WISHLIST_RESERVATION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeReservation(itemId: string, token: string | null) {
  try {
    const map = readReservations();
    if (!token) delete map[itemId];
    else map[itemId] = token;
    localStorage.setItem(WISHLIST_RESERVATION_KEY, JSON.stringify(map));
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

export function retailerFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "");
    return host || null;
  } catch {
    return null;
  }
}

export function formatMoney(
  amount: number | null | undefined,
  currency: string | null | undefined,
  locale = "en",
): string | null {
  if (amount == null || Number.isNaN(Number(amount))) return null;
  const code = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: code, maximumFractionDigits: 2 }).format(
      Number(amount),
    );
  } catch {
    return `${code} ${Number(amount).toFixed(2)}`;
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

export function defaultWishlistTitle(firstName?: string | null): string {
  const name = String(firstName || "").trim();
  if (name) return `${name}’s Christmas Wishlist`.slice(0, 80);
  return "My Christmas Wishlist";
}

export function shareMessage(title: string, url: string): { title: string; text: string; url: string } {
  return {
    title: `${title} 🎄`,
    text: `${title} shared a Christmas Wishlist with you 🎄\nSee what’s on the list →`,
    url,
  };
}
