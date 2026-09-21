import type { NextBestAction, PlannerInsight, PlannerSnapshot, SnapshotGift } from "./types";
import { formatPlannerMoney } from "./budgetIntelligence";
import { giftLabel } from "./giftIntelligence";

function recipientName(snapshot: PlannerSnapshot, gift: SnapshotGift): string {
  return snapshot.recipients.find((r) => r.id === gift.recipient_id)?.display_name || "this person";
}

export function scoreNextBestAction(input: {
  snapshot: PlannerSnapshot;
  insights: PlannerInsight[];
}): NextBestAction | null {
  const { snapshot, insights } = input;
  const candidates: NextBestAction[] = [];

  const overdue = snapshot.tasks.filter(
    (t) => (t.status === "open" || t.status === "rescheduled") && t.due_on && t.due_on < snapshot.today,
  );
  for (const task of overdue) {
    const days = Math.round((Date.parse(`${snapshot.today}T00:00:00Z`) - Date.parse(`${task.due_on}T00:00:00Z`)) / 86_400_000);
    const pri = task.priority === "high" ? 20 : task.priority === "normal" ? 8 : 0;
    candidates.push({
      id: `task:${task.id}`,
      title: task.title,
      reason: `This task is ${days} day${days === 1 ? "" : "s"} overdue.`,
      score: 90 + days + pri,
      href: "/account/christmas/plan",
      actionType: "none",
      actionPayload: { taskId: task.id },
      category: "tasks",
    });
  }

  const plannedGifts = snapshot.gifts.filter((g) => g.status === "idea" || g.status === "planned");
  for (const gift of plannedGifts) {
    const name = recipientName(snapshot, gift);
    const closeShipping = snapshot.daysLeft <= 21;
    const travel = snapshot.trips.map((t) => t.start_on).filter(Boolean).sort()[0];
    const travelHit = travel && snapshot.daysLeft > 0 && (gift.delivery_on ? gift.delivery_on > travel : closeShipping);
    candidates.push({
      id: `order:${gift.id}`,
      title: `Order ${name}’s gift next`,
      reason: travelHit && travel
        ? `You leave on ${travel}${gift.delivery_on ? ` and delivery is ${gift.delivery_on}` : ""}.`
        : closeShipping
          ? `Christmas is ${snapshot.daysLeft} days away and this gift is still ${gift.status}.`
          : `${giftLabel(gift)} is still not ordered.`,
      score: travelHit ? 96 : closeShipping ? 82 : 50,
      href: `/account/christmas/gifts?gift=${encodeURIComponent(gift.id)}`,
      actionType: "update_gift_status",
      actionPayload: { giftId: gift.id, status: "ordered" },
      category: "gifts",
    });
  }

  for (const insight of insights) {
    if (insight.severity === "info") continue;
    const sev = insight.severity === "urgent" ? 88 : insight.severity === "important" ? 72 : 40;
    candidates.push({
      id: `insight:${insight.id}`,
      title: insight.recommendedAction,
      reason: insight.reason,
      score: sev + insight.priority,
      href: String(insight.actionPayload.href || moduleHref(insight.category)),
      actionType: insight.actionType,
      actionPayload: insight.actionPayload,
      category: insight.category,
    });
  }

  candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return candidates[0] || null;
}

/** Hide a second card that repeats the one next action. */
export function attentionWithoutDuplicates(
  insights: PlannerInsight[],
  action: NextBestAction | null,
): PlannerInsight[] {
  const seen = new Set<string>();
  const out: PlannerInsight[] = [];
  for (const insight of insights) {
    if (action?.id === `insight:${insight.id}`) continue;
    if (action?.id.startsWith("task:") && insight.id === "tasks.overdue_cluster") continue;
    if (action?.title && (insight.title === action.title || insight.recommendedAction === action.title)) continue;
    const href = String(insight.actionPayload.href || "");
    const key = `${insight.title}|${href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(insight);
  }
  return out;
}

function moduleHref(category: string): string {
  if (category === "gifts" || category === "shopping") return "/account/christmas/gifts";
  if (category === "budget") return "/account/christmas/budget";
  if (category === "food") return "/account/christmas/food";
  if (category === "hosting") return "/account/christmas/hosting";
  if (category === "travel") return "/account/christmas/travel";
  if (category === "calendar" || category === "tasks") return "/account/christmas/plan";
  if (category === "cards") return "/account/christmas/cards";
  return "/account/christmas";
}

export function notifyMeta(id: string, severity: PlannerInsight["severity"], dueDate: string | null): Pick<PlannerInsight, "notifyEligible" | "notifyAfter" | "urgency" | "dedupeKey"> {
  return {
    notifyEligible: severity === "important" || severity === "urgent",
    notifyAfter: dueDate,
    urgency: severity,
    dedupeKey: id,
  };
}

export function moneyReason(currency: string, amount: number): string {
  return formatPlannerMoney(amount, currency);
}
