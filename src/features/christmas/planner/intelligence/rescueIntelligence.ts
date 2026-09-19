import type { PlannerSnapshot, RescueAssessment, SnapshotTask } from "./types";

const NICE_TO_HAVE = new Set(["decorating", "events", "personal"]);
const ESSENTIAL_CATEGORIES = new Set(["gifts", "shopping", "food", "travel", "hosting", "cards"]);
const ESSENTIAL_KEYS = new Set([
  "order_shipped_gifts",
  "order_remaining",
  "wrap_gifts",
  "send_cards",
  "grocery_shop",
  "menu_draft",
  "guest_rsvp",
  "dietary_check",
  "sleeping",
  "travel_book",
  "pack_bags",
  "rescue_today",
]);

export function isEssentialTask(task: SnapshotTask, snapshot: PlannerSnapshot): boolean {
  if (task.status === "done" || task.status === "skipped") return false;
  if (task.template_key && ESSENTIAL_KEYS.has(task.template_key)) return true;
  if (ESSENTIAL_CATEGORIES.has(task.category)) {
    if (task.category === "hosting" && !snapshot.profile.hosting) return false;
    if (task.category === "travel" && !snapshot.profile.travelling) return false;
    if (task.category === "food" && !snapshot.profile.hosting) return false;
    if (task.category === "cards" && snapshot.cards.length === 0) return false;
    return true;
  }
  if (task.priority === "high") return true;
  return false;
}

export function isNiceToHaveTask(task: SnapshotTask): boolean {
  if (task.template_key === "rescue_today") return false;
  return NICE_TO_HAVE.has(task.category) && task.priority !== "high";
}

export function assessRescue(input: {
  snapshot: PlannerSnapshot;
  readinessPercent: number;
  unresolvedEssentials: number;
}): RescueAssessment {
  const { snapshot, readinessPercent, unresolvedEssentials } = input;
  const late = snapshot.daysLeft <= 7;
  const behind = readinessPercent < 55 || unresolvedEssentials >= 3;
  const preparedRescue = snapshot.profile.preparedLevel === "rescue";
  const active = snapshot.daysLeft >= 0 && (snapshot.planMode === "rescue" || ((late || preparedRescue) && behind));

  const open = snapshot.tasks.filter((t) => t.status === "open" || t.status === "rescheduled");
  const essential = open.filter((t) => isEssentialTask(t, snapshot));
  const deprioritized = open.filter((t) => isNiceToHaveTask(t));

  return {
    active,
    essentialRemaining: Math.max(unresolvedEssentials, essential.length),
    reason: active
      ? "Fewer than eight days remain and essential Christmas work is still open."
      : "Rescue stays off until the season is late and essentials are behind.",
    essentialTaskIds: essential.map((t) => t.id),
    deprioritizedTaskIds: deprioritized.map((t) => t.id),
  };
}

export function prioritizeRescueTasks<T extends { id: string }>(tasks: T[], rescue: RescueAssessment): T[] {
  if (!rescue.active) return tasks;
  const essential = new Set(rescue.essentialTaskIds);
  const deprioritized = new Set(rescue.deprioritizedTaskIds);
  return [...tasks].sort((a, b) => {
    const ae = essential.has(a.id) ? 0 : deprioritized.has(a.id) ? 2 : 1;
    const be = essential.has(b.id) ? 0 : deprioritized.has(b.id) ? 2 : 1;
    return ae - be;
  });
}
