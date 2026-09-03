/** Client API for Christmas Tree / Advent / Free Gift funnel. */

const FUNNEL_URL = `${String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "")}/functions/v1/christmas-tree-funnel`;

export const TREE_OWNER_STORAGE_KEY = "tdg.christmas.tree.owner.v1";
export const FREE_GIFT_GUEST_KEY = "tdg.christmas.free_gift.guest.v1";

export type TreeStyle = "classic" | "snowy" | "gold" | "cozy" | "minimal" | "magical";
export type BoxStyle = "red" | "gold" | "green" | "blue" | "snow";

export type Decoration = {
  lights: boolean;
  snow: boolean;
  topper: "star" | "angel" | "bow" | "none";
  ornaments: "classic" | "gold" | "minimal" | "colorful";
};

export type TreeGift = {
  id: string;
  sort_order: number;
  gift_type: string;
  box_style: string;
  display_name: string;
  message?: string | null;
  unlock_mode?: string;
  unlock_at?: string | null;
  opened?: boolean;
  opened_at?: string | null;
  can_open?: boolean;
};

export type OwnerTree = {
  id: string;
  share_id: string;
  share_enabled: boolean;
  title: string;
  message: string;
  from_name: string;
  tree_style: TreeStyle;
  decoration_config: Decoration;
  locale: string;
  gifts: TreeGift[];
};

export type SharedTree = {
  share_id: string;
  title: string;
  message: string;
  from_name: string;
  tree_style: TreeStyle;
  decoration_config: Decoration;
  locale: string;
  gifts: TreeGift[];
};

async function headers(authBearer?: string | null): Promise<Record<string, string>> {
  const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "");
  return {
    "Content-Type": "application/json",
    apikey: anon,
    Authorization: `Bearer ${authBearer || anon}`,
  };
}

export async function treeFunnel<T = Record<string, unknown>>(
  body: Record<string, unknown>,
  authBearer?: string | null,
): Promise<T> {
  const res = await fetch(FUNNEL_URL, {
    method: "POST",
    headers: await headers(authBearer),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `tree_funnel_${res.status}`);
  }
  return data;
}

export type OwnerRecovery = { treeId: string; ownerToken: string; shareId: string };

export function readOwnerRecovery(): OwnerRecovery | null {
  try {
    const raw = localStorage.getItem(TREE_OWNER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OwnerRecovery;
    if (!parsed.treeId || !parsed.ownerToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeOwnerRecovery(value: OwnerRecovery | null) {
  try {
    if (!value) localStorage.removeItem(TREE_OWNER_STORAGE_KEY);
    else localStorage.setItem(TREE_OWNER_STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function getOrCreateFreeGiftGuestToken(): string {
  try {
    const existing = localStorage.getItem(FREE_GIFT_GUEST_KEY);
    if (existing && existing.length >= 32) return existing;
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(FREE_GIFT_GUEST_KEY, token);
    return token;
  } catch {
    return `guest_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

export const TREE_STYLES: { key: TreeStyle; label: string }[] = [
  { key: "classic", label: "Classic" },
  { key: "snowy", label: "Snowy" },
  { key: "gold", label: "Gold" },
  { key: "cozy", label: "Cozy" },
  { key: "minimal", label: "Minimal" },
  { key: "magical", label: "Magical" },
];

export const BOX_STYLES: { key: BoxStyle; label: string }[] = [
  { key: "red", label: "Red" },
  { key: "gold", label: "Gold" },
  { key: "green", label: "Green" },
  { key: "blue", label: "Blue" },
  { key: "snow", label: "Snow" },
];

export function defaultDecorations(): Decoration {
  return { lights: true, snow: false, topper: "star", ornaments: "classic" };
}
