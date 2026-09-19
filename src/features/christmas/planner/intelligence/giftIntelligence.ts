import type { GiftItemStatus } from "../types";
import type {
  DerivedShoppingItem,
  PlannerSnapshot,
  RecipientBudgetState,
  SnapshotGift,
  SnapshotRecipient,
} from "./types";
import { giftCommittedMinor, giftSpentMinor } from "./budgetIntelligence";

const PLANNED_PLUS: GiftItemStatus[] = ["planned", "ordered", "arrived", "hidden", "wrapped", "given"];

export function giftLabel(gift: Pick<SnapshotGift, "selected_gift" | "idea">): string {
  return (gift.selected_gift || gift.idea || "Gift").trim();
}

export function recipientsMissingPlannedGift(snapshot: PlannerSnapshot): SnapshotRecipient[] {
  const covered = new Set(
    snapshot.gifts.filter((g) => PLANNED_PLUS.includes(g.status)).map((g) => g.recipient_id),
  );
  return snapshot.recipients.filter((r) => !covered.has(r.id));
}

export function computeRecipientBudgets(input: {
  recipients: SnapshotRecipient[];
  gifts: SnapshotGift[];
}): RecipientBudgetState[] {
  return input.recipients.map((recipient) => {
    const theirs = input.gifts.filter((g) => g.recipient_id === recipient.id);
    const plannedMinor = theirs.reduce((s, g) => s + (g.planned_price_minor || 0), 0);
    const actualMinor = theirs.reduce((s, g) => s + giftSpentMinor(g), 0);
    const committedMinor = theirs.reduce((s, g) => s + giftCommittedMinor(g), 0);
    const budget = recipient.budget_minor;
    let status: RecipientBudgetState["status"] = "no_budget";
    if (budget != null && budget > 0) {
      if (committedMinor > budget) status = "over";
      else if (committedMinor >= budget * 0.9) status = "close";
      else status = "under";
    }
    return {
      recipientId: recipient.id,
      displayName: recipient.display_name,
      budgetMinor: budget,
      plannedMinor,
      actualMinor,
      committedMinor,
      remainingMinor: budget == null ? null : budget - committedMinor,
      status,
    };
  });
}

export function deriveShoppingItems(gifts: SnapshotGift[]): DerivedShoppingItem[] {
  return gifts.map((gift) => {
    let bucket: DerivedShoppingItem["bucket"] = "to_buy";
    let actionable = true;
    if (gift.status === "idea" || gift.status === "planned") bucket = "to_buy";
    else if (gift.status === "ordered") bucket = gift.delivery_on ? "arriving" : "ordered";
    else if (gift.status === "arrived" || gift.status === "hidden") bucket = "arrived";
    else {
      bucket = "completed";
      actionable = false;
    }
    return {
      id: `shop:${gift.id}`,
      giftId: gift.id,
      title: giftLabel(gift),
      bucket,
      status: gift.status,
      deliveryOn: gift.delivery_on,
      returnDeadline: gift.return_deadline,
      store: gift.store,
      priceMinor: gift.actual_price_minor ?? gift.planned_price_minor,
      actionable,
    };
  });
}

export function shoppingForTab(
  items: DerivedShoppingItem[],
  tab: "need" | "ordered" | "arriving" | "arrived" | "returns",
): DerivedShoppingItem[] {
  if (tab === "need") return items.filter((i) => i.bucket === "to_buy");
  if (tab === "ordered") return items.filter((i) => i.status === "ordered");
  if (tab === "arriving") return items.filter((i) => Boolean(i.deliveryOn) && (i.status === "ordered" || i.bucket === "arriving"));
  if (tab === "arrived") return items.filter((i) => i.bucket === "arrived");
  return items.filter((i) => Boolean(i.returnDeadline) && i.status !== "given");
}

const LATE_DELIVERY_DAYS = 3;

export function giftsNeedingOrder(snapshot: PlannerSnapshot): SnapshotGift[] {
  return snapshot.gifts.filter((g) => g.status === "idea" || g.status === "planned");
}

export function lateDeliveryGifts(snapshot: PlannerSnapshot): Array<{ gift: SnapshotGift; daysBeforeChristmas: number }> {
  return snapshot.gifts
    .filter((g) => g.delivery_on)
    .map((gift) => {
      const christmas = `${snapshot.season}-12-25`;
      const daysBeforeChristmas = Math.round(
        (Date.parse(`${christmas}T00:00:00Z`) - Date.parse(`${gift.delivery_on}T00:00:00Z`)) / 86_400_000,
      );
      return { gift, daysBeforeChristmas };
    })
    .filter((row) => row.daysBeforeChristmas <= LATE_DELIVERY_DAYS);
}

export function giftsArrivingAfterTravel(snapshot: PlannerSnapshot): Array<{ gift: SnapshotGift; departOn: string }> {
  const trips = snapshot.trips.filter((t) => t.start_on);
  if (!trips.length) return [];
  const departOn = [...trips].map((t) => t.start_on as string).sort()[0];
  return snapshot.gifts
    .filter((g) => g.delivery_on && g.delivery_on > departOn && g.status !== "given")
    .map((gift) => ({ gift, departOn }));
}
