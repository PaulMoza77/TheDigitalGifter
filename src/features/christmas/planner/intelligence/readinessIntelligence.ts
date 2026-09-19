import type { GiftItem, GiftRecipient, PlannerProfile, PlannerTask } from "../types";
import type { BudgetTotals, PlannerSnapshot } from "./types";

export type ReadinessBreakdown = {
  percent: number;
  parts: Array<{ key: string; label: string; weight: number; score: number; detail: string }>;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

const PLANNED_PLUS = ["planned", "ordered", "arrived", "hidden", "wrapped", "given"];

export function computeReadiness(input: {
  profile: Pick<PlannerProfile, "hosting" | "travelling" | "total_budget_minor" | "onboarding_completed_at">;
  tasks: Array<Pick<PlannerTask, "status" | "category">>;
  recipients: Array<Pick<GiftRecipient, "id">>;
  gifts: Array<Pick<GiftItem, "recipient_id" | "status">>;
  cardsPrepared?: number;
  cardsNeeded?: number;
  mealsCount?: number;
  travellingActive?: boolean;
  travelPacked?: boolean;
  budgetOverForecast?: boolean;
  foodComplete?: boolean;
}): ReadinessBreakdown {
  const relevantTasks = input.tasks.filter((t) => t.status !== "skipped");
  const taskDone = relevantTasks.filter((t) => t.status === "done").length;
  const taskScore = relevantTasks.length ? taskDone / relevantTasks.length : input.profile.onboarding_completed_at ? 0.15 : 0;

  const recCount = input.recipients.length;
  const progressed = new Set(
    input.gifts.filter((g) => PLANNED_PLUS.includes(g.status)).map((g) => g.recipient_id),
  );
  const giftScore = recCount ? progressed.size / recCount : 0;

  const budgetSet = Boolean(input.profile.total_budget_minor && input.profile.total_budget_minor > 0);
  const budgetScore = !budgetSet ? 0 : input.budgetOverForecast ? 0.55 : 1;

  const cardsNeeded = input.cardsNeeded ?? 0;
  const cardsPrepared = input.cardsPrepared ?? 0;
  const usesCards = cardsNeeded > 0;
  const cardScore = usesCards ? clamp01(cardsPrepared / cardsNeeded) : 1;

  const hosting = input.profile.hosting;
  const travelling = input.travellingActive ?? input.profile.travelling;

  const mealScore = hosting ? (input.foodComplete ? 1 : clamp01((input.mealsCount ?? 0) / 2)) : 1;
  const travelScore = travelling ? (input.travelPacked ? 1 : 0.35) : 1;

  const parts: ReadinessBreakdown["parts"] = [
    {
      key: "tasks",
      label: "Plan",
      weight: 35,
      score: taskScore,
      detail: `${taskDone}/${relevantTasks.length || 0} relevant tasks done`,
    },
    {
      key: "gifts",
      label: "Gifts",
      weight: 30,
      score: giftScore,
      detail: recCount ? `${progressed.size}/${recCount} people have a planned gift` : "Add recipients to start",
    },
    {
      key: "budget",
      label: "Budget",
      weight: 15,
      score: budgetScore,
      detail: !budgetSet ? "Set a total budget" : input.budgetOverForecast ? "Forecast is over budget" : "Season budget set",
    },
  ];

  if (usesCards) {
    parts.push({
      key: "cards",
      label: "Cards",
      weight: 8,
      score: cardScore,
      detail: `${cardsPrepared}/${cardsNeeded} cards prepared`,
    });
  }

  if (hosting) {
    parts.push({
      key: "meals",
      label: "Food",
      weight: 12,
      score: mealScore,
      detail: mealScore >= 1 ? "Menus look complete" : "Add Christmas Eve or Day meals",
    });
  }

  if (travelling) {
    parts.push({
      key: "travel",
      label: "Travel",
      weight: 10,
      score: travelScore,
      detail: input.travelPacked ? "Packing noted" : "Add packing or confirm trip dates",
    });
  }

  if (!hosting && !travelling && !usesCards) {
    const extra = parts.find((p) => p.key === "tasks");
    if (extra) extra.weight += 10;
  } else if (!hosting) {
    const extra = parts.find((p) => p.key === "tasks");
    if (extra) extra.weight += 8;
  }

  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  const weighted = parts.reduce((s, p) => s + p.weight * clamp01(p.score), 0);
  const percent = Math.round((weighted / totalWeight) * 100);

  return { percent, parts };
}

export function readinessFromSnapshot(snapshot: PlannerSnapshot, budget: BudgetTotals, foodComplete: boolean): ReadinessBreakdown {
  const cardsNeeded = snapshot.cards.length;
  const cardsPrepared = snapshot.cards.filter((c) => c.status === "prepared" || c.status === "sent").length;
  const packed = snapshot.trips.some((t) => t.packing.trim().length > 0);
  return computeReadiness({
    profile: {
      hosting: snapshot.profile.hosting,
      travelling: snapshot.profile.travelling,
      total_budget_minor: snapshot.profile.totalBudgetMinor,
      onboarding_completed_at: snapshot.profile.onboardingCompleted ? "yes" : null,
    },
    tasks: snapshot.tasks,
    recipients: snapshot.recipients,
    gifts: snapshot.gifts,
    cardsNeeded,
    cardsPrepared,
    mealsCount: snapshot.meals.length,
    travellingActive: snapshot.profile.travelling && snapshot.trips.length > 0,
    travelPacked: packed,
    budgetOverForecast: budget.overForecastMinor > 0,
    foodComplete,
  });
}
