export const PLANNER_PURCHASE_BONUS_CREDITS = 300;
export const PLANNER_BONUS_EVENT_TYPE = "christmas_planner_purchase_bonus";
export const PLANNER_BONUS_REVOKE_EVENT_TYPE = "christmas_planner_purchase_bonus_revoke";
export const PLANNER_BONUS_CATEGORY = "christmas_planner_2026";
export const PLANNER_ACCOUNT_WELCOME_ROUTE = "/account/christmas/welcome";
export const CHECKOUT_INTENT_KEY = "tdg.christmas.planner.purchaseIntent.v1";

export function plannerBonusGrantNote(orderId: string): string {
  return `${PLANNER_BONUS_EVENT_TYPE}:${String(orderId || "").trim()}`;
}

export function plannerBonusRevokeNote(orderId: string): string {
  return `${PLANNER_BONUS_REVOKE_EVENT_TYPE}:${String(orderId || "").trim()}`;
}

/** Never debit more than the current non-negative wallet balance. */
export function refundBonusDebitAmount(balance: number, granted: number): number {
  const safeBalance = Number.isFinite(balance) ? Math.max(0, Math.floor(balance)) : 0;
  const safeGranted = Number.isFinite(granted) ? Math.max(0, Math.floor(granted)) : 0;
  return Math.min(safeGranted, safeBalance);
}

export function isPlannerBonusQaBlocked(input: {
  accessSource?: string | null;
  entitlementSource?: string | null;
  metadata?: Record<string, unknown> | null;
}): boolean {
  if (input.accessSource === "qa_grant") return true;
  if (String(input.entitlementSource || "").trim() === "admin") return true;
  const meta = input.metadata || {};
  return meta.qa === true || meta.qa_grant === true;
}

export type PostAuthInput = {
  entitled: boolean;
  returnTo: string;
  checkoutIntent: boolean;
};

/**
 * Checkout intent continues checkout. Entitled returning buyers open the planner.
 * Everyone else stays on a previously validated internal route.
 */
export function resolvePostAuthPath(input: PostAuthInput): string {
  if (input.checkoutIntent) return input.returnTo;
  if (input.entitled) return "/account/christmas";
  return input.returnTo;
}
