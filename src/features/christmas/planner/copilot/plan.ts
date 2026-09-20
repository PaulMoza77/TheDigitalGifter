import { formatPlannerMoney } from "../intelligence/budgetIntelligence";
import type { PlannerIntelligence } from "../intelligence/types";
import type { PlannerActionRequest } from "../intelligence/types";
import { confirmationClassFor, type CopilotToolName } from "./registry";

export type CopilotPlanStep = {
  tool: CopilotToolName;
  preview: string;
  request: PlannerActionRequest;
};

export type CopilotActionPlan = {
  snapshotVersion: string;
  steps: CopilotPlanStep[];
};

export function proposeCopilotPlan(question: string, intel: PlannerIntelligence, snapshotVersion: string): CopilotActionPlan | null {
  const lower = question.trim().toLowerCase();
  const steps: CopilotPlanStep[] = [];

  const guestMatch = lower.match(/add (an? )?guest/) || lower.match(/now we are (\d+)/) || lower.match(/we are (\d+)/);
  if (lower.includes("add") && (lower.includes("guest") || lower.includes("one more"))) {
    steps.push({
      tool: "add_guest",
      preview: "Add one guest (1 adult) to hosting.",
      request: { type: "add_guest", payload: { displayName: "Guest", adults: 1, kids: 0 } },
    });
  } else if (guestMatch && guestMatch[1] && /\d/.test(guestMatch[1])) {
    const count = Number(guestMatch[1]);
    if (Number.isFinite(count) && count > 0) {
      steps.push({
        tool: "add_guest",
        preview: `Record a party size of ${count} (does not invent names).`,
        request: { type: "add_guest", payload: { displayName: `Party of ${count}`, adults: count, kids: 0 } },
      });
    }
  }

  if ((lower.includes("bought") || lower.includes("purchased") || lower.includes("paid")) && lower.includes("gift")) {
    const priced = intel.snapshot.gifts.find((g) => g.status !== "given" && g.status !== "wrapped");
    const amount = lower.match(/\$(\d+)/) || lower.match(/€(\d+)/) || lower.match(/(\d+)\s*(euro|dollars?)/);
    const minor = amount ? Number(amount[1]) * 100 : null;
    if (priced) {
      steps.push({
        tool: "update_gift_status",
        preview: `Mark one open gift as ordered${minor ? ` at ${formatPlannerMoney(minor, intel.snapshot.currency)}` : ""} and refresh budget.`,
        request: {
          type: "update_gift_status",
          payload: { giftId: priced.id, status: "ordered", actualPriceMinor: minor },
        },
      });
    }
  }

  if (lower.includes("hour") && (lower.includes("cook") || lower.includes("menu") || lower.includes("dinner"))) {
    return null;
  }

  if (!steps.length) return null;
  return { snapshotVersion, steps };
}

export function planNeedsConfirmation(plan: CopilotActionPlan): boolean {
  return plan.steps.some((step) => confirmationClassFor(step.tool) !== "none");
}
