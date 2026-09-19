/**
 * Safe Action Registry — Copilot P0 is read-only.
 * Mutations must go through this map later; the model never talks to SQL.
 */

export const COPILOT_TOOLS = [
  "read_snapshot",
  "read_module",
  "create_task",
  "update_task",
  "reschedule_task",
  "complete_task",
  "add_recipient",
  "set_recipient_budget",
  "add_gift_idea",
  "update_gift",
  "update_gift_status",
  "set_total_budget",
  "add_expense",
  "add_event",
  "add_meal",
  "add_recipe_to_meal",
  "add_grocery_item",
  "add_guest",
  "update_hosting",
  "add_trip",
  "schedule_tradition",
] as const;

export type CopilotToolName = (typeof COPILOT_TOOLS)[number];

export const READ_TOOLS: readonly CopilotToolName[] = ["read_snapshot", "read_module"];

export const FORBIDDEN_TOOLS = [
  "delete_bulk",
  "delete_profile",
  "set_hiding_place",
  "send_message",
  "checkout",
  "mark_purchased_auto",
] as const;

export type ConfirmationClass = "none" | "single" | "bulk";

export function confirmationClassFor(tool: CopilotToolName, count = 1): ConfirmationClass {
  if (READ_TOOLS.includes(tool)) return "none";
  if (count > 1) return "bulk";
  return "single";
}

export function isWriteTool(tool: CopilotToolName): boolean {
  return !READ_TOOLS.includes(tool);
}

export type ApplyPlanResult =
  | { ok: true; applied: number }
  | { ok: false; code: "not_implemented" | "stale_snapshot" | "forbidden" | "entitlement_missing"; message: string };

/** P0: never mutate. Keep a single apply seam for P1. */
export function applyCopilotPlan(): ApplyPlanResult {
  return {
    ok: false,
    code: "not_implemented",
    message: "Copilot can recommend changes. Applying them lands in a later release.",
  };
}
