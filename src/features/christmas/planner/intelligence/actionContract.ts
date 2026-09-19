import type { PlannerActionRequest, PlannerActionType, PlannerSnapshot } from "./types";
import { GIFT_ITEM_STATUSES, TASK_CATEGORIES } from "../types";

export const DESTRUCTIVE_ACTIONS = new Set<PlannerActionType>(["reschedule_tasks"]);

export function validatePlannerAction(request: PlannerActionRequest): { ok: true } | { ok: false; error: string; code: string } {
  if (!request || !request.type) return { ok: false, error: "Missing action type.", code: "invalid_payload" };
  const p = request.payload || {};
  switch (request.type) {
    case "create_task":
      if (!String(p.title || "").trim()) return { ok: false, error: "Task title is required.", code: "invalid_payload" };
      if (p.category && !(TASK_CATEGORIES as readonly string[]).includes(String(p.category))) {
        return { ok: false, error: "Unknown task category.", code: "invalid_payload" };
      }
      return { ok: true };
    case "reschedule_task":
      if (!p.taskId || !p.dueOn) return { ok: false, error: "Task and new date are required.", code: "invalid_payload" };
      return { ok: true };
    case "reschedule_tasks":
      if (!Array.isArray(p.changes) || p.changes.length === 0) {
        return { ok: false, error: "No schedule changes provided.", code: "invalid_payload" };
      }
      return { ok: true };
    case "add_recipient":
      if (!String(p.displayName || "").trim()) return { ok: false, error: "Name is required.", code: "invalid_payload" };
      return { ok: true };
    case "set_recipient_budget":
      if (!p.recipientId) return { ok: false, error: "Recipient is required.", code: "invalid_payload" };
      if (p.budgetMinor != null && (!Number.isFinite(Number(p.budgetMinor)) || Number(p.budgetMinor) < 0)) {
        return { ok: false, error: "Budget must be a positive amount.", code: "invalid_payload" };
      }
      return { ok: true };
    case "add_gift_idea":
      if (!p.recipientId || !String(p.idea || "").trim()) return { ok: false, error: "Recipient and idea are required.", code: "invalid_payload" };
      return { ok: true };
    case "update_gift_status":
      if (!p.giftId || !(GIFT_ITEM_STATUSES as readonly string[]).includes(String(p.status))) {
        return { ok: false, error: "Gift and a valid status are required.", code: "invalid_payload" };
      }
      return { ok: true };
    case "set_total_budget":
      if (!Number.isFinite(Number(p.totalMinor)) || Number(p.totalMinor) < 0) {
        return { ok: false, error: "Total budget must be a positive amount.", code: "invalid_payload" };
      }
      return { ok: true };
    case "add_meal":
      if (!String(p.title || "").trim()) return { ok: false, error: "Meal title is required.", code: "invalid_payload" };
      return { ok: true };
    case "add_grocery_item":
      if (!String(p.name || "").trim()) return { ok: false, error: "Item name is required.", code: "invalid_payload" };
      return { ok: true };
    case "add_event":
      if (!String(p.title || "").trim() || !p.startsOn) return { ok: false, error: "Event title and date are required.", code: "invalid_payload" };
      return { ok: true };
    case "ensure_hosting_tasks":
      return { ok: true };
    default:
      return { ok: false, error: "Unknown action.", code: "invalid_payload" };
  }
}

export function previewPlannerAction(request: PlannerActionRequest, snapshot?: PlannerSnapshot): Record<string, unknown> {
  if (request.type === "reschedule_tasks") {
    return { changes: request.payload.changes || [] };
  }
  if (request.type === "ensure_hosting_tasks" && snapshot) {
    return { keys: snapshot.tasks.map((t) => t.template_key).filter(Boolean) };
  }
  return { type: request.type, payload: request.payload };
}
