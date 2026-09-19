import type { PlannerSnapshot, SnapshotTask, TravelConflict } from "./types";

const PRE_TRAVEL_CATEGORIES = new Set(["gifts", "shopping", "cards", "food"]);
const PRE_TRAVEL_KEYS = new Set([
  "order_shipped_gifts",
  "order_remaining",
  "start_buying",
  "wrap_gifts",
  "send_cards",
  "grocery_shop",
  "pack_bags",
]);

function shiftIso(iso: string, days: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000;
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function earliestDeparture(snapshot: PlannerSnapshot): string | null {
  if (!snapshot.profile.travelling) return null;
  const dates = snapshot.trips.map((t) => t.start_on).filter((d): d is string => Boolean(d)).sort();
  return dates[0] || null;
}

export function shouldCompleteBeforeTravel(task: SnapshotTask): boolean {
  if (task.status === "done" || task.status === "skipped") return false;
  if (PRE_TRAVEL_CATEGORIES.has(task.category)) return true;
  if (task.template_key && PRE_TRAVEL_KEYS.has(task.template_key)) return true;
  return false;
}

export function detectTravelConflicts(snapshot: PlannerSnapshot): TravelConflict[] {
  const depart = earliestDeparture(snapshot);
  if (!depart) return [];
  const suggested = shiftIso(depart, -2) < snapshot.today ? snapshot.today : shiftIso(depart, -2);
  return snapshot.tasks
    .filter(shouldCompleteBeforeTravel)
    .filter((task) => {
      if (!task.due_on) return true;
      return task.due_on > depart;
    })
    .map((task) => ({
      taskId: task.id,
      title: task.title,
      oldDate: task.due_on,
      suggestedDate: suggested,
      reason: `This should happen before you leave on ${depart}.`,
    }));
}
