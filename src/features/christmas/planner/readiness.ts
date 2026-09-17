import type { GiftItem, GiftRecipient, PlannerProfile, PlannerTask } from "./types";

export type ReadinessBreakdown = {
  percent: number;
  parts: Array<{ key: string; label: string; weight: number; score: number; detail: string }>;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function computeReadiness(input: {
  profile: Pick<PlannerProfile, "hosting" | "travelling" | "total_budget_minor" | "onboarding_completed_at">;
  tasks: Array<Pick<PlannerTask, "status" | "category">>;
  recipients: Array<Pick<GiftRecipient, "id">>;
  gifts: Array<Pick<GiftItem, "recipient_id" | "status">>;
  cardsPrepared?: number;
  cardsNeeded?: number;
  mealsCount?: number;
}): ReadinessBreakdown {
  const relevantTasks = input.tasks.filter((t) => t.status !== "skipped");
  const taskDone = relevantTasks.filter((t) => t.status === "done").length;
  const taskScore = relevantTasks.length ? taskDone / relevantTasks.length : input.profile.onboarding_completed_at ? 0.15 : 0;

  const recCount = input.recipients.length;
  const progressed = new Set(
    input.gifts
      .filter((g) => ["planned", "ordered", "arrived", "hidden", "wrapped", "given"].includes(g.status))
      .map((g) => g.recipient_id),
  );
  const giftScore = recCount ? progressed.size / recCount : 0;

  const budgetScore = input.profile.total_budget_minor && input.profile.total_budget_minor > 0 ? 1 : 0;

  const cardsNeeded = input.cardsNeeded ?? 0;
  const cardsPrepared = input.cardsPrepared ?? 0;
  const cardScore = cardsNeeded > 0 ? clamp01(cardsPrepared / cardsNeeded) : 1;

  const mealScore = input.profile.hosting ? clamp01((input.mealsCount ?? 0) / 2) : 1;

  const parts = [
    {
      key: "tasks",
      label: "Tasks",
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
      detail: budgetScore ? "Season budget set" : "Set a total budget",
    },
    {
      key: "cards",
      label: "Cards",
      weight: 10,
      score: cardScore,
      detail: cardsNeeded ? `${cardsPrepared}/${cardsNeeded} cards prepared` : "No card list yet (counts as ready)",
    },
  ];

  if (input.profile.hosting) {
    parts.push({
      key: "meals",
      label: "Meals / hosting",
      weight: 10,
      score: mealScore,
      detail: mealScore >= 1 ? "Menus started" : "Add Christmas Eve or Day meals",
    });
  } else {
    const extra = parts.find((p) => p.key === "tasks");
    if (extra) extra.weight += 10;
  }

  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  const weighted = parts.reduce((s, p) => s + p.weight * clamp01(p.score), 0);
  const percent = Math.round((weighted / totalWeight) * 100);

  return { percent, parts };
}
