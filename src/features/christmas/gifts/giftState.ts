import {
  GIFT_TREE_GUEST_KEY,
  GIFT_TREE_SEASON_YEAR,
  GIFT_TREE_STORAGE_KEY,
  findGiftTreeReward,
  type GiftTreeRewardDef,
} from "./rewardCatalog";

export type GiftTreePersistedState = {
  seasonYear: number;
  presentId: string | null;
  rewardId: string | null;
  claimId: string | null;
  openedAt: string | null;
  claimed: boolean;
  creditsGranted: boolean;
  extraOpens: number;
  guestTokenHint?: string;
};

export function emptyGiftTreeState(): GiftTreePersistedState {
  return {
    seasonYear: GIFT_TREE_SEASON_YEAR,
    presentId: null,
    rewardId: null,
    claimId: null,
    openedAt: null,
    claimed: false,
    creditsGranted: false,
    extraOpens: 0,
  };
}

export function readGiftTreeState(): GiftTreePersistedState {
  if (typeof window === "undefined") return emptyGiftTreeState();
  try {
    const raw = window.localStorage.getItem(GIFT_TREE_STORAGE_KEY);
    if (!raw) return emptyGiftTreeState();
    const parsed = JSON.parse(raw) as GiftTreePersistedState;
    if (parsed.seasonYear !== GIFT_TREE_SEASON_YEAR) return emptyGiftTreeState();
    return { ...emptyGiftTreeState(), ...parsed, seasonYear: GIFT_TREE_SEASON_YEAR };
  } catch {
    return emptyGiftTreeState();
  }
}

export function writeGiftTreeState(state: GiftTreePersistedState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GIFT_TREE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

export function clearGiftTreeState() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(GIFT_TREE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function getOrCreateGiftTreeGuestToken(): string {
  if (typeof window === "undefined") return `guest_${Date.now()}`;
  try {
    const existing = window.localStorage.getItem(GIFT_TREE_GUEST_KEY);
    if (existing && existing.length >= 32) return existing;
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    window.localStorage.setItem(GIFT_TREE_GUEST_KEY, token);
    return token;
  } catch {
    return `guest_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

export function resolvedRewardFromState(
  state: GiftTreePersistedState,
): GiftTreeRewardDef | null {
  if (!state.rewardId) return null;
  return findGiftTreeReward(state.rewardId);
}

export function canOpenGift(state: GiftTreePersistedState): boolean {
  if (!state.openedAt) return true;
  return state.extraOpens > 0;
}

export function consumeOpen(state: GiftTreePersistedState): GiftTreePersistedState {
  if (!state.openedAt) return state;
  return { ...state, extraOpens: Math.max(0, state.extraOpens - 1) };
}
