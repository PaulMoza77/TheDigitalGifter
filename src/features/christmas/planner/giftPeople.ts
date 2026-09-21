import { canAddRecipient, hasFeature } from "./entitlements";
import { FREE_LIMITS, type PlannerAccess } from "./types";

/** Reserved list for general gift-shopping lines. It is not a gift person. */
export const HOUSEHOLD_GIFT_LIST_NAME = "Household";

export function isHouseholdGiftList(person: { display_name?: string | null }): boolean {
  return String(person.display_name || "").trim().toLowerCase() === HOUSEHOLD_GIFT_LIST_NAME.toLowerCase();
}

export type GiftPeopleLimit = {
  paid: boolean;
  limit: number;
  giftPeople: number;
  householdCount: number;
  canAdd: boolean;
  /** Free accounts may already hold more than the cap. Those rows stay. */
  overExisting: boolean;
};

export function giftPeopleLimit(
  access: PlannerAccess | null | undefined,
  recipients: Array<{ display_name?: string | null }>,
): GiftPeopleLimit {
  const householdCount = recipients.filter((person) => isHouseholdGiftList(person)).length;
  const giftPeople = recipients.length - householdCount;
  const paid = hasFeature(access, "gift_planner");
  const gate = canAddRecipient(access, giftPeople);
  return {
    paid,
    limit: FREE_LIMITS.maxRecipients,
    giftPeople,
    householdCount,
    canAdd: gate.ok,
    overExisting: !paid && giftPeople > FREE_LIMITS.maxRecipients,
  };
}

export function giftPeopleLimitCopy(state: GiftPeopleLimit): string {
  const base = `Free Christmas Planner includes ${state.limit} gift people.`;
  const household = state.householdCount
    ? " Household is a private list for general gift shopping and does not use one of those places."
    : "";
  if (state.overExisting) {
    return `${base} You already have ${state.giftPeople}, so they stay. Adding another person is part of Christmas Planner ($17).${household}`;
  }
  return `${base} ${state.giftPeople} of ${state.limit} added.${household}`;
}
