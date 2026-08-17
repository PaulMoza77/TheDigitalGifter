import {
  SUPPORT_GUEST_TOKEN_PREFIX,
  SUPPORT_PET_CONTEXT_KEY,
  type SupportPetContext,
} from "./types";

const PET_TOKEN_MEMORY_KEY = "tdg.support.petPublicToken";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function capturePetSupportContext(input?: {
  publicToken?: string | null;
  search?: string;
}): SupportPetContext {
  const params = new URLSearchParams(input?.search || "");
  const token = String(input?.publicToken || params.get("token") || "").trim();
  const context: SupportPetContext = { hasPetOrder: Boolean(token) };
  const store = storage();
  if (!store) return context;

  store.setItem(SUPPORT_PET_CONTEXT_KEY, JSON.stringify(context));
  if (token) store.setItem(PET_TOKEN_MEMORY_KEY, token);
  else store.removeItem(PET_TOKEN_MEMORY_KEY);
  return context;
}

export function readPetSupportContext(): SupportPetContext {
  const store = storage();
  if (!store) return { hasPetOrder: false };
  try {
    const parsed = JSON.parse(store.getItem(SUPPORT_PET_CONTEXT_KEY) || "null") as SupportPetContext | null;
    if (parsed && typeof parsed.hasPetOrder === "boolean") return parsed;
  } catch {
    // Ignore malformed session data.
  }
  return { hasPetOrder: Boolean(store.getItem(PET_TOKEN_MEMORY_KEY)) };
}

export function takePetPublicToken(): string | null {
  const store = storage();
  if (!store) return null;
  const token = store.getItem(PET_TOKEN_MEMORY_KEY);
  store.removeItem(PET_TOKEN_MEMORY_KEY);
  return token;
}

export function peekPetPublicToken(): string | null {
  return storage()?.getItem(PET_TOKEN_MEMORY_KEY) || null;
}

export function storeGuestSupportToken(reference: string, guestToken: string) {
  const store = storage();
  if (!store || !reference || !guestToken) return;
  store.setItem(`${SUPPORT_GUEST_TOKEN_PREFIX}${reference}`, guestToken);
}

export function readGuestSupportToken(reference: string): string | null {
  if (!reference) return null;
  return storage()?.getItem(`${SUPPORT_GUEST_TOKEN_PREFIX}${reference}`) || null;
}
