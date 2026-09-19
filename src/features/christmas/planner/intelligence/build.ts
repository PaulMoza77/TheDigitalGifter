import { recommendedToday } from "../planGenerator";
import type { IntelligenceBundle, IntelligenceInput, NextBestAction, PlannerInsight, PlannerSnapshot } from "./types";

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function titles(list: Array<{ title: string }>, limit: number): string[] {
  return list
    .map((row) => row.title.trim())
    .filter(Boolean)
    .slice(0, limit);
}

export function snapshotVersion(parts: {
  todayIso: string;
  openTasks: number;
  overdueTasks: number;
  giftsWithoutPlan: number;
  budgetRemainingMinor: number | null;
  mealsCount: number;
  readinessPercent: number;
  tripStartOn: string | null;
}): string {
  return [
    parts.todayIso,
    parts.openTasks,
    parts.overdueTasks,
    parts.giftsWithoutPlan,
    parts.budgetRemainingMinor ?? "na",
    parts.mealsCount,
    parts.readinessPercent,
    parts.tripStartOn || "none",
  ].join(":");
}

export function buildIntelligence(input: IntelligenceInput): IntelligenceBundle {
  const open = input.tasks.filter((t) => t.status === "open" || t.status === "rescheduled");
  const overdue = open.filter((t) => t.due_on && t.due_on < input.todayIso);
  const weekendEnd = addDaysIso(input.todayIso, 2);
  const weekend = recommendedToday(
    open.filter((t) => !t.due_on || t.due_on <= weekendEnd),
    input.todayIso,
    5,
  );
  const skippable = open.filter(
    (t) => t.priority === "low" && t.due_on && t.due_on > addDaysIso(input.todayIso, 10),
  );
  const progressed = new Set(
    input.gifts
      .filter((g) => ["planned", "ordered", "arrived", "hidden", "wrapped", "given"].includes(g.status))
      .map((g) => g.recipient_id),
  );
  const missing = input.recipients.filter((r) => !progressed.has(r.id));
  const plannedGifts = input.gifts.filter((g) => g.status !== "idea").length;
  const wrappedGifts = input.gifts.filter((g) => g.status === "wrapped" || g.status === "given").length;
  const remaining =
    input.budgetPlannedMinor > 0 ? input.budgetPlannedMinor - input.budgetSpentMinor : null;

  const core = {
    todayIso: input.todayIso,
    openTasks: open.length,
    overdueTasks: overdue.length,
    giftsWithoutPlan: missing.length,
    budgetRemainingMinor: remaining,
    mealsCount: input.mealsCount,
    readinessPercent: input.readinessPercent,
    tripStartOn: input.tripStartOn || null,
  };

  const snapshot: PlannerSnapshot = {
    ...core,
    version: snapshotVersion(core),
    seasonYear: input.seasonYear,
    daysLeft: input.daysLeft,
    planMode: input.planMode,
    hosting: input.hosting,
    travelling: input.travelling,
    hasChildren: input.hasChildren,
    currency: input.currency,
    highPriorityOpen: open.filter((t) => t.priority === "high").length,
    recipientCount: input.recipients.length,
    plannedGifts,
    wrappedGifts,
    budgetPlannedMinor: input.budgetPlannedMinor,
    budgetSpentMinor: input.budgetSpentMinor,
    groceryNeedCount: input.groceryNeedCount ?? 0,
    weekendTaskTitles: titles(weekend, 5),
    overdueTaskTitles: titles(overdue, 5),
    skippableTaskTitles: titles(skippable, 5),
    missingGiftNames: missing.map((r) => r.display_name).slice(0, 6),
  };

  const insights: PlannerInsight[] = [];
  if (snapshot.planMode === "rescue") {
    insights.push({
      id: "rescue_mode",
      kind: "rescue_mode",
      module: "today",
      severity: "urgent",
      title: "Rescue mode",
      fact: `${snapshot.daysLeft} days left. Keep the list to gifts that must ship, food shop, then wrap.`,
      href: "/account/christmas",
    });
  }
  if (snapshot.overdueTasks > 0) {
    insights.push({
      id: "overdue_tasks",
      kind: "overdue_tasks",
      module: "plan",
      severity: snapshot.overdueTasks > 3 ? "urgent" : "warn",
      title: "Overdue tasks",
      fact: `${snapshot.overdueTasks} open ${snapshot.overdueTasks === 1 ? "task is" : "tasks are"} past due.`,
      href: "/account/christmas/plan",
    });
  }
  if (snapshot.giftsWithoutPlan > 0) {
    insights.push({
      id: "missing_gifts",
      kind: "missing_gifts",
      module: "gifts",
      severity: snapshot.daysLeft <= 21 ? "urgent" : "warn",
      title: "Gifts still open",
      fact: `${snapshot.giftsWithoutPlan} ${snapshot.giftsWithoutPlan === 1 ? "person still needs" : "people still need"} a planned gift.`,
      href: "/account/christmas/gifts",
    });
  }
  if (snapshot.budgetPlannedMinor <= 0) {
    insights.push({
      id: "budget_unset",
      kind: "budget_unset",
      module: "budget",
      severity: "info",
      title: "No season budget",
      fact: "Set a total in Budget so Copilot can tell you if you are on track.",
      href: "/account/christmas/budget",
    });
  } else if (remaining != null && remaining < 0) {
    insights.push({
      id: "budget_over",
      kind: "budget_over",
      module: "budget",
      severity: "urgent",
      title: "Over budget",
      fact: `You are ${Math.abs(Math.round(remaining / 100))} ${snapshot.currency.toUpperCase()} over the plan.`,
      href: "/account/christmas/budget",
    });
  } else if (remaining != null && remaining <= snapshot.budgetPlannedMinor * 0.15) {
    insights.push({
      id: "budget_tight",
      kind: "budget_tight",
      module: "budget",
      severity: "warn",
      title: "Budget is tight",
      fact: `About ${Math.round(remaining / 100)} ${snapshot.currency.toUpperCase()} remains.`,
      href: "/account/christmas/budget",
    });
  }
  if (snapshot.hosting && snapshot.mealsCount < 1) {
    insights.push({
      id: "no_menu",
      kind: "no_menu",
      module: "food",
      severity: "warn",
      title: "No menu yet",
      fact: "You’re hosting and Christmas Eve / Day meals are still empty.",
      href: "/account/christmas/food",
    });
  }
  if (snapshot.tripStartOn) {
    const conflicts = open.filter((t) => t.due_on && t.due_on >= snapshot.tripStartOn!).length;
    insights.push({
      id: "trip_deadline",
      kind: "trip_deadline",
      module: "travel",
      severity: conflicts ? "warn" : "info",
      title: "Travel date on the plan",
      fact:
        conflicts > 0
          ? `${conflicts} open ${conflicts === 1 ? "task sits" : "tasks sit"} on or after ${snapshot.tripStartOn}.`
          : `Trip starts ${snapshot.tripStartOn}. Dated work is currently before then.`,
      href: "/account/christmas/travel",
    });
  }
  if (skippable.length > 0 && (snapshot.planMode === "rescue" || snapshot.planMode === "sprint")) {
    insights.push({
      id: "low_priority_skip",
      kind: "low_priority_skip",
      module: "plan",
      severity: "info",
      title: "Safe to ignore",
      fact: `${skippable.length} low-priority ${skippable.length === 1 ? "task is" : "tasks are"} more than 10 days out.`,
      href: "/account/christmas/plan",
    });
  }
  if (insights.length === 0) {
    insights.push({
      id: "caught_up",
      kind: "caught_up",
      module: "today",
      severity: "info",
      title: "No obvious gaps",
      fact: "Structured counts look calm. Add a date, a gift, or a meal if you want more signal.",
      href: "/account/christmas",
    });
  } else if (weekend.length > 0) {
    insights.push({
      id: "weekend_focus",
      kind: "weekend_focus",
      module: "today",
      severity: "info",
      title: "This weekend",
      fact: `Top of the list: ${titles(weekend, 2).join("; ") || `${weekend.length} tasks`}.`,
      href: "/account/christmas",
    });
  }

  const nextBestActions: NextBestAction[] = [];
  if (overdue[0]) {
    nextBestActions.push({
      id: "clear_overdue",
      label: "Clear overdue work",
      reason: overdue[0].title,
      href: "/account/christmas/plan",
      module: "plan",
    });
  }
  if (missing[0]) {
    nextBestActions.push({
      id: "plan_gift",
      label: `Plan a gift for ${missing[0].display_name}`,
      reason: "Someone on the list still has no planned gift",
      href: "/account/christmas/gifts",
      module: "gifts",
    });
  }
  if (snapshot.budgetPlannedMinor <= 0) {
    nextBestActions.push({
      id: "set_budget",
      label: "Set a season budget",
      reason: "Budget answers need a total first",
      href: "/account/christmas/budget",
      module: "budget",
    });
  }
  if (snapshot.hosting && snapshot.mealsCount < 1) {
    nextBestActions.push({
      id: "draft_menu",
      label: "Draft Christmas Day",
      reason: "Hosting without a menu is the usual miss",
      href: "/account/christmas/food",
      module: "food",
    });
  }
  if (nextBestActions.length === 0 && weekend[0]) {
    nextBestActions.push({
      id: "do_today",
      label: weekend[0].title,
      reason: "Highest-ranked open task",
      href: "/account/christmas",
      module: "today",
    });
  }

  return {
    snapshot,
    insights: insights.slice(0, 6),
    nextBestActions: nextBestActions.slice(0, 4),
  };
}
