import { recommendedToday } from "../planGenerator";
import { computeBudgetTotals } from "./budgetIntelligence";
import { deriveCalendarItems } from "./calendarIntelligence";
import { detectFoodCompleteness, mergeGroceryList, buildPrepTimeline, servingHints } from "./foodIntelligence";
import { computeRecipientBudgets, deriveShoppingItems } from "./giftIntelligence";
import { missingHostingTemplateKeys } from "./hostingIntelligence";
import { attentionInsights, collectInsights } from "./insights";
import { readinessFromSnapshot } from "./readinessIntelligence";
import { scoreNextBestAction } from "./recommendations";
import { assessRescue, isEssentialTask, prioritizeRescueTasks } from "./rescueIntelligence";
import { detectTravelConflicts } from "./travelIntelligence";
import type { PlannerIntelligence, PlannerSnapshot } from "./types";

export function runPlannerIntelligence(
  snapshot: PlannerSnapshot,
  dismissedIds: string[] = [],
): PlannerIntelligence {
  const budget = computeBudgetTotals(snapshot);
  const food = detectFoodCompleteness(snapshot);
  const foodComplete = food.length > 0 && food.every((m) => m.missing.length === 0);
  const readiness = readinessFromSnapshot(snapshot, budget, foodComplete);
  const insights = collectInsights(snapshot, dismissedIds);
  const nextBestAction = scoreNextBestAction({ snapshot, insights });
  const giftGaps = snapshot.recipients.length
    ? snapshot.recipients.filter(
        (r) => !snapshot.gifts.some((g) => g.recipient_id === r.id && ["planned", "ordered", "arrived", "hidden", "wrapped", "given"].includes(g.status)),
      ).length
    : 0;
  const essentialOpen = snapshot.tasks.filter((t) => (t.status === "open" || t.status === "rescheduled") && isEssentialTask(t, snapshot)).length;
  const unresolvedEssentials = essentialOpen + giftGaps + (budget.overForecastMinor > 0 ? 1 : 0);
  const rescue = assessRescue({ snapshot, readinessPercent: readiness.percent, unresolvedEssentials });

  const openTasks = snapshot.tasks.filter((t) => t.status === "open" || t.status === "rescheduled");
  const ranked = rescue.active ? prioritizeRescueTasks(openTasks, rescue) : openTasks;
  const todayPriorities = recommendedToday(ranked, snapshot.today, 5);

  return {
    snapshot,
    insights,
    attention: attentionInsights(insights),
    nextBestAction,
    readiness,
    rescue,
    budget,
    recipientBudgets: computeRecipientBudgets(snapshot),
    shopping: deriveShoppingItems(snapshot.gifts),
    calendar: deriveCalendarItems(snapshot),
    grocery: mergeGroceryList(snapshot),
    foodCompleteness: food,
    prepTimeline: buildPrepTimeline(snapshot),
    servingHints: servingHints(snapshot),
    travelConflicts: detectTravelConflicts(snapshot),
    hostingTaskKeysNeeded: missingHostingTemplateKeys(snapshot),
    todayPriorities,
  };
}
