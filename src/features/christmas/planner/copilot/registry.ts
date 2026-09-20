/**
 * Copilot mutations go through executePlannerAction. The model never talks to SQL.
 */
import type { PlannerActionRequest } from "../intelligence/types";
import type { CopilotActionPlan } from "./plan";

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
  | {
      ok: false;
      code: "missing_plan" | "confirm_required" | "stale_snapshot" | "forbidden" | "entitlement_missing" | "write_failed";
      message: string;
    };

export async function applyCopilotPlan(input?: {
  plan?: CopilotActionPlan | null;
  confirm?: boolean;
  snapshotVersion?: string;
  execute?: (request: PlannerActionRequest) => Promise<{ ok: boolean; error?: string }>;
}): Promise<ApplyPlanResult> {
  if (!input?.plan || !input.plan.steps.length) {
    return { ok: false, code: "missing_plan", message: "Nothing to apply. Ask Copilot for a change first." };
  }
  if (input.snapshotVersion && input.plan.snapshotVersion !== input.snapshotVersion) {
    return { ok: false, code: "stale_snapshot", message: "The plan changed. Ask again before applying." };
  }
  if (!input.confirm) {
    return { ok: false, code: "confirm_required", message: "Confirm the previewed changes before they are written." };
  }
  if (!input.execute) {
    return { ok: false, code: "write_failed", message: "No write executor is available." };
  }
  let applied = 0;
  for (const step of input.plan.steps) {
    if (READ_TOOLS.includes(step.tool)) continue;
    const result = await input.execute({ ...step.request, confirm: true });
    if (!result.ok) {
      return { ok: false, code: "write_failed", message: result.error || "Could not apply that change." };
    }
    applied += 1;
  }
  return { ok: true, applied };
}
