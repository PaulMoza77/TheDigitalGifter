import { giftCommittedMinor, giftSpentMinor } from "../intelligence/budgetIntelligence";
import type { GiftItem, GiftItemStatus, GiftRecipient } from "../types";

export const TO_BUY_STATUSES: readonly GiftItemStatus[] = ["idea", "planned"];
export const BOUGHT_STATUSES: readonly GiftItemStatus[] = ["ordered", "arrived", "hidden", "wrapped", "given"];
export const WRAPPED_STATUSES: readonly GiftItemStatus[] = ["wrapped", "given"];

export type GiftLifecycle = "ideas" | "planned" | "bought" | "wrapped";

export function giftLifecycle(status: GiftItemStatus): GiftLifecycle {
  if (status === "idea") return "ideas";
  if (status === "planned") return "planned";
  if (status === "wrapped" || status === "given") return "wrapped";
  return "bought";
}

export function isToBuy(status: GiftItemStatus): boolean {
  return TO_BUY_STATUSES.includes(status);
}

export function isBought(status: GiftItemStatus): boolean {
  return BOUGHT_STATUSES.includes(status);
}

export function isWrapped(status: GiftItemStatus): boolean {
  return WRAPPED_STATUSES.includes(status);
}

export type PersonGiftStats = {
  total: number;
  plannedPlus: number;
  toBuy: number;
  bought: number;
  wrapped: number;
  done: boolean;
  progress: number;
};

export function personGiftStats(gifts: Array<Pick<GiftItem, "status">>): PersonGiftStats {
  const total = gifts.length;
  const toBuy = gifts.filter((g) => isToBuy(g.status)).length;
  const bought = gifts.filter((g) => isBought(g.status)).length;
  const wrapped = gifts.filter((g) => isWrapped(g.status)).length;
  const plannedPlus = gifts.filter((g) => g.status !== "idea").length;
  const done = total > 0 && toBuy === 0;
  const progress = total ? Math.round((bought / total) * 100) : 0;
  return { total, plannedPlus, toBuy, bought, wrapped, done, progress };
}

export type GiftsOverviewStats = {
  people: number;
  giftsTotal: number;
  giftsPlanned: number;
  leftToBuy: number;
  spentMinor: number;
  committedMinor: number;
  budgetMinor: number | null;
};

export function giftsOverviewStats(input: {
  people: Array<Pick<GiftRecipient, "id" | "budget_minor">>;
  gifts: Array<Pick<GiftItem, "status" | "planned_price_minor" | "actual_price_minor" | "recipient_id">>;
  profileBudgetMinor: number | null | undefined;
}): GiftsOverviewStats {
  const giftsTotal = input.gifts.length;
  const giftsPlanned = input.gifts.filter((g) => g.status !== "idea").length;
  const leftToBuy = input.gifts.filter((g) => isToBuy(g.status)).length;
  const spentMinor = input.gifts.reduce((s, g) => s + giftSpentMinor(g), 0);
  const committedMinor = input.gifts.reduce((s, g) => s + giftCommittedMinor(g), 0);
  const peopleBudget = input.people.reduce((s, p) => s + (p.budget_minor || 0), 0);
  const profileBudget = input.profileBudgetMinor && input.profileBudgetMinor > 0 ? input.profileBudgetMinor : null;
  const budgetMinor = profileBudget || (peopleBudget > 0 ? peopleBudget : null);
  return {
    people: input.people.length,
    giftsTotal,
    giftsPlanned,
    leftToBuy,
    spentMinor,
    committedMinor,
    budgetMinor,
  };
}

export type PersonFilter = "all" | "family" | "friends" | "to_buy" | "bought";

const FAMILY_KEYS = new Set([
  "mom",
  "dad",
  "wife",
  "husband",
  "partner",
  "daughter",
  "son",
  "child",
  "teen",
  "grandma",
  "grandpa",
  "family",
  "mother",
  "father",
  "parent",
  "sister",
  "brother",
  "sibling",
  "close_family",
]);

export function relationshipBucket(relationship: string): "family" | "friends" | "other" {
  const raw = String(relationship || "").trim().toLowerCase();
  if (raw === "friend" || raw === "friends" || raw.includes("friend")) return "friends";
  if (FAMILY_KEYS.has(raw) || raw.includes("family") || raw.includes("mom") || raw.includes("dad")) {
    return "family";
  }
  return "other";
}

export function personMatchesFilter(
  filter: PersonFilter,
  person: Pick<GiftRecipient, "relationship">,
  gifts: Array<Pick<GiftItem, "status">>,
): boolean {
  if (filter === "all") return true;
  if (filter === "family") return relationshipBucket(person.relationship) === "family";
  if (filter === "friends") return relationshipBucket(person.relationship) === "friends";
  const stats = personGiftStats(gifts);
  if (filter === "to_buy") return stats.toBuy > 0 || stats.total === 0;
  return stats.total > 0 && stats.toBuy === 0;
}

export function nextGiftStatus(current: GiftItemStatus, action: "bought" | "wrapped"): GiftItemStatus {
  if (action === "wrapped") return current === "given" ? "given" : "wrapped";
  if (isBought(current)) return current;
  return "ordered";
}
