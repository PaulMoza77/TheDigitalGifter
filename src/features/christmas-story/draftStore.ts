import { createEmptyDraft, type StoryGiftDraft, type StoryOrder } from "./types";

const DRAFT_KEY = "tdg.christmas-story.draft.v1";
const ORDERS_KEY = "tdg.christmas-story.orders.v1";

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadDraft(): StoryGiftDraft {
  if (typeof window === "undefined") return createEmptyDraft();
  const parsed = safeParse<StoryGiftDraft>(localStorage.getItem(DRAFT_KEY));
  if (!parsed?.id) return createEmptyDraft();
  return { ...createEmptyDraft(), ...parsed };
}

export function saveDraft(draft: StoryGiftDraft): StoryGiftDraft {
  const next = { ...draft, updatedAt: new Date().toISOString() };
  if (typeof window !== "undefined") {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
  }
  return next;
}

export function clearDraft(): void {
  if (typeof window !== "undefined") localStorage.removeItem(DRAFT_KEY);
}

export function loadOrders(): StoryOrder[] {
  if (typeof window === "undefined") return [];
  return safeParse<StoryOrder[]>(localStorage.getItem(ORDERS_KEY)) ?? [];
}

export function saveOrder(order: StoryOrder): StoryOrder {
  const all = loadOrders().filter((o) => o.id !== order.id);
  all.unshift(order);
  if (typeof window !== "undefined") {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(all.slice(0, 40)));
  }
  return order;
}

export function getOrder(id: string): StoryOrder | null {
  return loadOrders().find((o) => o.id === id) ?? null;
}

export function getOrderByRecipientToken(token: string): StoryOrder | null {
  return loadOrders().find((o) => o.recipientToken === token) ?? null;
}
