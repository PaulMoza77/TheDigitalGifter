import type { PlannerInsight, PlannerSnapshot } from "./types";
import { computeBudgetTotals, formatPlannerMoney } from "./budgetIntelligence";
import {
  computeRecipientBudgets,
  giftsArrivingAfterTravel,
  giftsNeedingOrder,
  lateDeliveryGifts,
  recipientsMissingPlannedGift,
} from "./giftIntelligence";
import { detectFoodCompleteness, guestCount } from "./foodIntelligence";
import { homePrepOpen, missingHostingTemplateKeys, rsvpGaps, unmatchedDietaryCount } from "./hostingIntelligence";
import { detectTravelConflicts, earliestDeparture } from "./travelIntelligence";
import { notifyMeta } from "./recommendations";

function insight(partial: Omit<PlannerInsight, "notifyEligible" | "notifyAfter" | "urgency" | "dedupeKey">): PlannerInsight {
  return { ...partial, ...notifyMeta(partial.id, partial.severity, partial.dueDate) };
}

export function collectInsights(snapshot: PlannerSnapshot, dismissedIds: string[] = []): PlannerInsight[] {
  const dismissed = new Set(dismissedIds);
  const currency = snapshot.currency;
  const budget = computeBudgetTotals(snapshot);
  const out: PlannerInsight[] = [];

  const missing = recipientsMissingPlannedGift(snapshot);
  if (missing.length > 0 && snapshot.recipients.length > 0) {
    const sev = snapshot.daysLeft <= 21 ? "important" : "suggestion";
    out.push(
      insight({
        id: "gifts.missing_ideas",
        type: "gift_coverage",
        severity: sev,
        category: "gifts",
        title: `${missing.length} ${missing.length === 1 ? "gift still needs" : "gifts still need"} an idea`,
        body: `You have ${snapshot.recipients.length} ${snapshot.recipients.length === 1 ? "person" : "people"} on your gift list and ${missing.length} ${missing.length === 1 ? "does" : "do"} not have a planned gift yet.`,
        reason: "Gift coverage is measured from recipients without a gift in planned or later status.",
        recommendedAction: "Choose gift ideas",
        actionType: "open_module",
        actionPayload: { href: "/account/christmas/gifts" },
        dueDate: null,
        priority: 20 + missing.length,
        dismissible: false,
        autoResolvable: true,
      }),
    );
  }

  const unordered = giftsNeedingOrder(snapshot);
  if (unordered.length > 0 && snapshot.daysLeft <= 28) {
    out.push(
      insight({
        id: "gifts.need_order",
        type: "shipping",
        severity: snapshot.daysLeft <= 14 ? "important" : "suggestion",
        category: "shopping",
        title: `${unordered.length} ${unordered.length === 1 ? "gift still needs" : "gifts still need"} ordering`,
        body: "Planned gifts without an order are at shipping risk as Christmas gets closer.",
        reason: "Only gifts still in idea or planned status are counted. No retailer estimates are invented.",
        recommendedAction: "Order remaining gifts",
        actionType: "open_module",
        actionPayload: { href: "/account/christmas/shopping" },
        dueDate: null,
        priority: 18,
        dismissible: false,
        autoResolvable: true,
      }),
    );
  }

  for (const row of lateDeliveryGifts(snapshot)) {
    out.push(
      insight({
        id: `gifts.late_delivery:${row.gift.id}`,
        type: "shipping",
        severity: row.daysBeforeChristmas < 0 ? "urgent" : "important",
        category: "gifts",
        title: "Delivery is close to Christmas",
        body: `${row.gift.selected_gift || row.gift.idea} is marked to arrive ${row.gift.delivery_on}.`,
        reason: "The saved delivery date is within three days of Christmas Day.",
        recommendedAction: "Check this delivery",
        actionType: "open_module",
        actionPayload: { href: `/account/christmas/gifts?gift=${row.gift.id}`, giftId: row.gift.id },
        dueDate: row.gift.delivery_on,
        priority: 22,
        dismissible: true,
        autoResolvable: true,
      }),
    );
  }

  for (const row of giftsArrivingAfterTravel(snapshot)) {
    out.push(
      insight({
        id: `gifts.travel_delivery:${row.gift.id}`,
        type: "shipping",
        severity: "urgent",
        category: "travel",
        title: "A gift may arrive after you leave",
        body: `${row.gift.selected_gift || row.gift.idea} arrives ${row.gift.delivery_on}, after travel starts on ${row.departOn}.`,
        reason: "Saved delivery date is after the earliest trip start date.",
        recommendedAction: "Change the order or packing plan",
        actionType: "open_module",
        actionPayload: { href: `/account/christmas/gifts?gift=${row.gift.id}` },
        dueDate: row.departOn,
        priority: 28,
        dismissible: false,
        autoResolvable: true,
      }),
    );
  }

  const recipientBudgets = computeRecipientBudgets(snapshot);
  for (const row of recipientBudgets.filter((r) => r.status === "over" && r.budgetMinor != null)) {
    out.push(
      insight({
        id: `gifts.recipient_over:${row.recipientId}`,
        type: "recipient_budget",
        severity: "important",
        category: "budget",
        title: `${row.displayName} is over their gift budget`,
        body: `${formatPlannerMoney(row.committedMinor, currency)} planned against ${formatPlannerMoney(row.budgetMinor || 0, currency)}.`,
        reason: "Recipient budget compared with planned or actual gift prices for that person only.",
        recommendedAction: "Review gifts over budget",
        actionType: "open_module",
        actionPayload: { href: "/account/christmas/gifts" },
        dueDate: null,
        priority: 16,
        dismissible: false,
        autoResolvable: true,
      }),
    );
  }

  if (budget.totalBudgetMinor != null && budget.overForecastMinor > 0) {
    out.push(
      insight({
        id: "budget.forecast_over",
        type: "forecast",
        severity: budget.overForecastMinor > budget.totalBudgetMinor * 0.15 ? "important" : "suggestion",
        category: "budget",
        title: "Your current plan is over budget",
        body: `At your current plan, you’re likely to spend ${formatPlannerMoney(budget.forecastMinor, currency)} against a ${formatPlannerMoney(budget.totalBudgetMinor, currency)} budget.`,
        reason: "Forecast is gift planned/actual prices plus other manual category plans, without double-counting gift rows as budget expenses.",
        recommendedAction: "Review gifts over budget",
        actionType: "open_module",
        actionPayload: { href: "/account/christmas/budget" },
        dueDate: null,
        priority: 19,
        dismissible: false,
        autoResolvable: true,
      }),
    );
  }

  if (budget.totalBudgetMinor != null && budget.totalBudgetMinor > 0) {
    const allocated = budget.forecastMinor;
    const gap = budget.totalBudgetMinor - allocated;
    if (gap > budget.totalBudgetMinor * 0.4 && snapshot.recipients.length > 0) {
      out.push(
        insight({
          id: "budget.unallocated",
          type: "unallocated",
          severity: "info",
          category: "budget",
          title: "A large share of the budget is still unallocated",
          body: `${formatPlannerMoney(gap, currency)} of ${formatPlannerMoney(budget.totalBudgetMinor, currency)} is not yet tied to gifts or other planned categories.`,
          reason: "Unallocated gap is total budget minus current forecast.",
          recommendedAction: "Assign recipient budgets",
          actionType: "open_module",
          actionPayload: { href: "/account/christmas/budget" },
          dueDate: null,
          priority: 6,
          dismissible: true,
          autoResolvable: true,
        }),
      );
    }
  }

  for (const meal of detectFoodCompleteness(snapshot)) {
    if (!meal.missing.length) continue;
    const dessert = meal.missing.includes("dessert");
    out.push(
      insight({
        id: `food.completeness:${meal.section}`,
        type: "food_completeness",
        severity: "suggestion",
        category: "food",
        title: dessert && meal.missing.length === 1 ? `${meal.title} has no dessert planned` : `${meal.title} is still missing ${meal.missing.join(", ")}`,
        body: `${meal.title} has ${meal.present.join(" and ") || "a start"} but no ${meal.missing.join(" or ")} yet.`,
        reason: "Recommended meal categories are suggestions, not cultural rules.",
        recommendedAction: dessert ? "Add a dessert" : "Finish the menu",
        actionType: "open_module",
        actionPayload: { href: "/account/christmas/food" },
        dueDate: meal.section === "christmas_day" ? `${snapshot.season}-12-25` : null,
        priority: 12,
        dismissible: true,
        autoResolvable: true,
      }),
    );
  }

  const guests = guestCount(snapshot);
  if (snapshot.profile.hosting && guests > 0) {
    const gaps = rsvpGaps(snapshot);
    if (gaps > 0) {
      out.push(
        insight({
          id: "hosting.rsvp_gaps",
          type: "rsvp",
          severity: "suggestion",
          category: "hosting",
          title: `${gaps} ${gaps === 1 ? "guest has" : "guests have"} no RSVP status`,
          body: "Guests still marked maybe need a yes or no before rooms and food can settle.",
          reason: "Counted from guests with rsvp = maybe.",
          recommendedAction: "Confirm guests",
          actionType: "open_module",
          actionPayload: { href: "/account/christmas/hosting" },
          dueDate: null,
          priority: 11,
          dismissible: false,
          autoResolvable: true,
        }),
      );
    }
    const diet = unmatchedDietaryCount(snapshot);
    if (diet > 0) {
      out.push(
        insight({
          id: "hosting.dietary",
          type: "dietary",
          severity: "important",
          category: "hosting",
          title: `${diet} dietary ${diet === 1 ? "requirement needs" : "requirements need"} a matching menu note`,
          body: "Saved dietary notes were not found in current dish names.",
          reason: "Simple name match against dishes — recipes are not silently rewritten.",
          recommendedAction: "Check dietary needs",
          actionType: "open_module",
          actionPayload: { href: "/account/christmas/food" },
          dueDate: null,
          priority: 14,
          dismissible: true,
          autoResolvable: true,
        }),
      );
    }
    if (homePrepOpen(snapshot) > 0 && snapshot.daysLeft <= 10) {
      out.push(
        insight({
          id: "hosting.home_prep",
          type: "home",
          severity: "suggestion",
          category: "hosting",
          title: "Home prep is still open",
          body: `${homePrepOpen(snapshot)} hosting home tasks are not done yet.`,
          reason: "Counted from incomplete home items while hosting is on.",
          recommendedAction: "Prepare the house",
          actionType: "open_module",
          actionPayload: { href: "/account/christmas/hosting" },
          dueDate: null,
          priority: 8,
          dismissible: true,
          autoResolvable: true,
        }),
      );
    }
  }

  if (missingHostingTemplateKeys(snapshot).length > 0) {
    out.push(
      insight({
        id: "hosting.tasks_missing",
        type: "hosting_plan",
        severity: "info",
        category: "tasks",
        title: "Hosting tasks can be added to your plan",
        body: "Confirm guests, dietary needs, menu, rooms, and the final shop — added once, never duplicated.",
        reason: "Hosting is on and those system template keys are not on the plan yet.",
        recommendedAction: "Add hosting tasks",
        actionType: "ensure_hosting_tasks",
        actionPayload: {},
        dueDate: null,
        priority: 9,
        dismissible: true,
        autoResolvable: true,
      }),
    );
  }

  const conflicts = detectTravelConflicts(snapshot);
  const depart = earliestDeparture(snapshot);
  if (conflicts.length > 0 && depart) {
    out.push(
      insight({
        id: "travel.task_conflicts",
        type: "travel_conflict",
        severity: "important",
        category: "travel",
        title: `${conflicts.length} ${conflicts.length === 1 ? "task conflicts" : "tasks conflict"} with your ${depart} travel date`,
        body: "These should happen before you leave. Dates will not change until you apply suggestions.",
        reason: "Open gift, shopping, food, or card tasks are due after departure — or have no date.",
        recommendedAction: "Review changes",
        actionType: "review_reschedule",
        actionPayload: {
          href: "/account/christmas/travel",
          conflicts,
        },
        dueDate: depart,
        priority: 24,
        dismissible: false,
        autoResolvable: true,
      }),
    );
  }

  const openOverdue = snapshot.tasks.filter(
    (t) => (t.status === "open" || t.status === "rescheduled") && t.due_on && t.due_on < snapshot.today,
  );
  if (openOverdue.length >= 3) {
    out.push(
      insight({
        id: "tasks.overdue_cluster",
        type: "overdue",
        severity: "important",
        category: "tasks",
        title: `${openOverdue.length} tasks are overdue`,
        body: "Clearing the oldest dates first is the fastest way to raise readiness.",
        reason: "Open tasks with due dates before today.",
        recommendedAction: "Open today’s plan",
        actionType: "open_module",
        actionPayload: { href: "/account/christmas/plan" },
        dueDate: snapshot.today,
        priority: 15,
        dismissible: false,
        autoResolvable: true,
      }),
    );
  }

  const cardsNeeded = snapshot.cards.filter((c) => c.status === "needed").length;
  if (cardsNeeded > 0 && snapshot.daysLeft <= 12) {
    out.push(
      insight({
        id: "cards.outstanding",
        type: "cards",
        severity: "suggestion",
        category: "cards",
        title: `${cardsNeeded} ${cardsNeeded === 1 ? "card is" : "cards are"} still outstanding`,
        body: "Cards marked needed have not been prepared or sent.",
        reason: "Counted from the card tracker only when you use it.",
        recommendedAction: "Send remaining cards",
        actionType: "open_module",
        actionPayload: { href: "/account/christmas/cards" },
        dueDate: null,
        priority: 7,
        dismissible: true,
        autoResolvable: true,
      }),
    );
  }

  const unique = new Map<string, PlannerInsight>();
  for (const item of out) {
    if (dismissed.has(item.id) && item.dismissible) continue;
    if (!unique.has(item.id)) unique.set(item.id, item);
  }

  return [...unique.values()].sort((a, b) => {
    const sev = { urgent: 0, important: 1, suggestion: 2, info: 3 };
    if (sev[a.severity] !== sev[b.severity]) return sev[a.severity] - sev[b.severity];
    if (a.priority !== b.priority) return b.priority - a.priority;
    return a.id.localeCompare(b.id);
  });
}

export function attentionInsights(insights: PlannerInsight[]): PlannerInsight[] {
  return insights.filter((i) => i.severity === "urgent" || i.severity === "important" || i.severity === "suggestion").slice(0, 3);
}
