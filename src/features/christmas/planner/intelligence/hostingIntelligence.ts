import { addDays, isoDate, type LocalDateParts } from "../date";
import type { SnapshotTask } from "./types";
import type { PlannerSnapshot } from "./types";

export const HOSTING_TASK_TEMPLATES = [
  { template_key: "guest_rsvp", title: "Confirm guests", category: "hosting" as const, offsetDays: 18, priority: "high" as const },
  { template_key: "dietary_check", title: "Check dietary needs", category: "hosting" as const, offsetDays: 14, priority: "high" as const },
  { template_key: "menu_draft", title: "Plan menu", category: "food" as const, offsetDays: 21, priority: "high" as const },
  { template_key: "sleeping", title: "Prepare guest rooms", category: "hosting" as const, offsetDays: 10, priority: "normal" as const },
  { template_key: "grocery_shop", title: "Final grocery shop", category: "food" as const, offsetDays: 3, priority: "high" as const },
];

export function missingHostingTemplateKeys(snapshot: PlannerSnapshot): string[] {
  if (!snapshot.profile.hosting) return [];
  const have = new Set(snapshot.tasks.map((t) => t.template_key).filter(Boolean));
  return HOSTING_TASK_TEMPLATES.filter((t) => !have.has(t.template_key)).map((t) => t.template_key);
}

export function hostingTasksToInsert(
  snapshot: PlannerSnapshot,
  today: LocalDateParts,
  christmas: LocalDateParts,
): Array<Omit<SnapshotTask, "id"> & { notes: string }> {
  const missing = new Set(missingHostingTemplateKeys(snapshot));
  return HOSTING_TASK_TEMPLATES.filter((t) => missing.has(t.template_key)).map((tpl) => {
    const due = addDays(christmas, -tpl.offsetDays);
    const dueUtc = Date.UTC(due.year, due.month - 1, due.day);
    const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
    const clamped = dueUtc < todayUtc ? today : due;
    return {
      title: tpl.title,
      category: tpl.category,
      due_on: isoDate(clamped),
      status: "open" as const,
      priority: tpl.priority,
      origin: "system" as const,
      template_key: tpl.template_key,
      notes: "",
    };
  });
}

export function rsvpGaps(snapshot: PlannerSnapshot): number {
  if (!snapshot.profile.hosting) return 0;
  return snapshot.guests.filter((g) => g.rsvp === "maybe").length;
}

export function unmatchedDietaryCount(snapshot: PlannerSnapshot): number {
  if (!snapshot.profile.hosting) return 0;
  const dietaryGuests = snapshot.guests.filter((g) => g.dietary.trim());
  if (!dietaryGuests.length) return 0;
  const menu = snapshot.dishes.map((d) => d.dish_name.toLowerCase()).join(" ");
  return dietaryGuests.filter((g) => {
    const need = g.dietary.toLowerCase();
    if (!need) return false;
    const token = need.split(/[,\s]+/).find((t) => t.length > 3);
    if (!token) return true;
    return !menu.includes(token);
  }).length;
}

export function sleepingShortfall(snapshot: PlannerSnapshot): { overnight: number; beds: number } | null {
  if (!snapshot.profile.hosting) return null;
  const people = (g: { adults: number; kids: number }) => g.adults + g.kids;
  const overnight = snapshot.guests.filter((g) => g.rsvp === "yes").reduce((s, g) => s + people(g), 0);
  const beds = snapshot.guests.filter((g) => g.sleeping.trim()).reduce((s, g) => s + people(g), 0);
  if (!overnight || !beds) return null;
  if (beds >= overnight) return null;
  return { overnight, beds };
}

export function homePrepOpen(snapshot: PlannerSnapshot): number {
  if (!snapshot.profile.hosting) return 0;
  return snapshot.home.filter((h) => h.status !== "done").length;
}
