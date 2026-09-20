import {
  BUDGET_CATEGORY_LABELS,
  BUDGET_DASHBOARD_CATEGORIES,
  type BudgetCategory,
  type BudgetDashboardCategory,
  type BudgetSourceType,
} from "../types";
import type { BudgetTotals, PlannerSnapshot, SnapshotBudgetEntry, SnapshotGift } from "./types";

export const GIFT_SPENT_STATUSES = new Set(["ordered", "arrived", "hidden", "wrapped", "given"]);
export const GIFT_PLANNED_STATUSES = new Set(["idea", "planned"]);

export const SUGGESTED_ALLOCATION: Array<{ category: BudgetDashboardCategory; share: number }> = [
  { category: "gifts", share: 0.5 },
  { category: "food", share: 0.25 },
  { category: "decor", share: 0.1 },
  { category: "other", share: 0.15 },
];

export function dashboardCategoryFor(category: BudgetCategory | "gifts_derived"): BudgetDashboardCategory {
  if (category === "gifts" || category === "gifts_derived") return "gifts";
  if (category === "food") return "food";
  if (category === "decor") return "decor";
  if (category === "travel") return "travel";
  if (category === "events") return "events";
  return "other";
}

export function budgetCategoryLabel(category: BudgetCategory | BudgetDashboardCategory | "gifts_derived"): string {
  if (category === "gifts_derived") return BUDGET_CATEGORY_LABELS.gifts;
  return BUDGET_CATEGORY_LABELS[category as BudgetCategory] || "Other";
}

export function giftCurrencyCompatible(
  gift: Pick<SnapshotGift, "currency">,
  plannerCurrency: string,
): boolean {
  const giftCurrency = String(gift.currency || "").trim().toLowerCase();
  if (!giftCurrency) return true;
  return giftCurrency === String(plannerCurrency || "eur").trim().toLowerCase();
}

export function giftSpentMinor(
  gift: Pick<SnapshotGift, "planned_price_minor" | "actual_price_minor" | "status" | "currency">,
  plannerCurrency?: string,
): number {
  if (plannerCurrency && !giftCurrencyCompatible(gift, plannerCurrency)) return 0;
  if (!GIFT_SPENT_STATUSES.has(gift.status)) return 0;
  if (gift.actual_price_minor != null && gift.actual_price_minor > 0) return gift.actual_price_minor;
  return 0;
}

export function giftPlannedMinor(
  gift: Pick<SnapshotGift, "planned_price_minor" | "actual_price_minor" | "status" | "currency">,
  plannerCurrency?: string,
): number {
  if (plannerCurrency && !giftCurrencyCompatible(gift, plannerCurrency)) return 0;
  if (giftSpentMinor(gift, plannerCurrency) > 0) return 0;
  if (gift.planned_price_minor != null && gift.planned_price_minor > 0) return gift.planned_price_minor;
  return 0;
}

export function giftCommittedMinor(
  gift: Pick<SnapshotGift, "planned_price_minor" | "actual_price_minor" | "status" | "currency">,
  plannerCurrency?: string,
): number {
  return giftSpentMinor(gift, plannerCurrency) + giftPlannedMinor(gift, plannerCurrency);
}

/** Reserved for grocery unit-price integration. Returns null until costs are trustworthy. */
export function groceryEstimatedCostMinor(_snapshot: Pick<PlannerSnapshot, "grocery" | "recipes" | "dishes">): number | null {
  return null;
}

export function isAllocationRow(entry: SnapshotBudgetEntry): boolean {
  if (entry.source_type === "system") return true;
  if (entry.source_type === "gift" || entry.source_type === "grocery") return false;
  const label = String(entry.label || "").trim().toLowerCase();
  if (!label) return true;
  if (label === entry.category) return true;
  const pretty = budgetCategoryLabel(entry.category).toLowerCase();
  return label === pretty || label === "food" || label === "decorations" || label === "activities";
}

export function isGiftDerivedRow(entry: SnapshotBudgetEntry): boolean {
  return entry.source_type === "gift";
}

export type BudgetExpenseLine = {
  id: string;
  category: BudgetCategory;
  dashboardCategory: BudgetDashboardCategory;
  label: string;
  note: string;
  amountMinor: number;
  status: "planned" | "paid";
  source_type: BudgetSourceType;
};

export function expenseLinesFromEntries(entries: SnapshotBudgetEntry[]): BudgetExpenseLine[] {
  const out: BudgetExpenseLine[] = [];
  for (const entry of entries) {
    if (isGiftDerivedRow(entry)) continue;
    if (isAllocationRow(entry)) {
      if ((entry.spent_minor || 0) > 0) {
        out.push({
          id: `${entry.id}:legacy-spent`,
          category: entry.category,
          dashboardCategory: dashboardCategoryFor(entry.category),
          label: entry.label && !isAllocationRow({ ...entry, spent_minor: 0 }) ? entry.label : "Earlier spending",
          note: "",
          amountMinor: entry.spent_minor,
          status: "paid",
          source_type: entry.source_type || "manual",
        });
      }
      continue;
    }
    const paid = (entry.spent_minor || 0) > 0;
    out.push({
      id: entry.id,
      category: entry.category,
      dashboardCategory: dashboardCategoryFor(entry.category),
      label: entry.label || budgetCategoryLabel(entry.category),
      note: String(entry.source_ref || "").slice(0, 200),
      amountMinor: paid ? entry.spent_minor : entry.planned_minor,
      status: paid ? "paid" : "planned",
      source_type: entry.source_type || "manual",
    });
  }
  return out;
}

export type CategoryBudgetRow = {
  category: BudgetDashboardCategory;
  label: string;
  budgetMinor: number;
  spentMinor: number;
  plannedMinor: number;
  remainingMinor: number;
  overMinor: number;
};

export function suggestedAllocations(totalMinor: number): Array<{ category: BudgetDashboardCategory; label: string; minor: number }> {
  const total = Math.max(0, Math.round(totalMinor) || 0);
  const rows = SUGGESTED_ALLOCATION.map((row, index) => {
    const minor = index === SUGGESTED_ALLOCATION.length - 1
      ? 0
      : Math.round(total * row.share);
    return { category: row.category, label: budgetCategoryLabel(row.category), minor };
  });
  const used = rows.slice(0, -1).reduce((s, r) => s + r.minor, 0);
  rows[rows.length - 1]!.minor = Math.max(0, total - used);
  return rows;
}

export function computeBudgetTotals(snapshot: PlannerSnapshot): BudgetTotals {
  const currency = snapshot.currency;
  const gifts = snapshot.gifts;
  const giftSpent = gifts.reduce((s, g) => s + giftSpentMinor(g, currency), 0);
  const giftPlanned = gifts.reduce((s, g) => s + giftPlannedMinor(g, currency), 0);
  const giftCommitted = gifts.reduce((s, g) => s + giftCommittedMinor(g, currency), 0);
  const giftsWithoutPrice = gifts.filter((g) => giftCurrencyCompatible(g, currency) && giftCommittedMinor(g, currency) <= 0).length;

  const manual = snapshot.budgetEntries.filter((r) => !isGiftDerivedRow(r));
  const allocations = manual.filter((r) => isAllocationRow(r));
  const expenses = manual.filter((r) => !isAllocationRow(r));

  const groceryHint = groceryEstimatedCostMinor(snapshot);

  const caps: Record<BudgetDashboardCategory, number> = {
    gifts: 0,
    food: 0,
    decor: 0,
    travel: 0,
    events: 0,
    other: 0,
  };
  const manualSpentBy: Record<BudgetDashboardCategory, number> = { ...caps };
  const manualPlannedBy: Record<BudgetDashboardCategory, number> = { ...caps };

  for (const row of allocations) {
    const key = dashboardCategoryFor(row.category);
    caps[key] += row.planned_minor || 0;
    manualSpentBy[key] += row.spent_minor || 0;
  }
  for (const row of expenses) {
    const key = dashboardCategoryFor(row.category);
    if ((row.spent_minor || 0) > 0) manualSpentBy[key] += row.spent_minor;
    else manualPlannedBy[key] += row.planned_minor || 0;
  }
  if (groceryHint != null && groceryHint > 0) {
    manualPlannedBy.food += groceryHint;
  }

  const manualSpentMinor = BUDGET_DASHBOARD_CATEGORIES.reduce((s, k) => s + manualSpentBy[k], 0);
  const manualPlannedMinor = BUDGET_DASHBOARD_CATEGORIES.reduce((s, k) => s + manualPlannedBy[k], 0);
  const spentMinor = giftSpent + manualSpentMinor;
  const plannedOutstandingMinor = giftPlanned + manualPlannedMinor;
  const forecastMinor = spentMinor + plannedOutstandingMinor;

  const total = snapshot.profile.totalBudgetMinor;
  const remainingMinor = total != null ? total - forecastMinor : null;
  const remainingAfterSpendMinor = total != null ? total - spentMinor : null;
  const overForecastMinor = total != null ? Math.max(0, forecastMinor - total) : 0;

  const categoryRows: CategoryBudgetRow[] = BUDGET_DASHBOARD_CATEGORIES.map((category) => {
    const spent = category === "gifts" ? giftSpent + manualSpentBy.gifts : manualSpentBy[category];
    const planned = category === "gifts" ? giftPlanned + manualPlannedBy.gifts : manualPlannedBy[category];
    const budget = caps[category];
    const remaining = budget - spent;
    return {
      category,
      label: budgetCategoryLabel(category),
      budgetMinor: budget,
      spentMinor: spent,
      plannedMinor: planned,
      remainingMinor: remaining,
      overMinor: Math.max(0, spent - budget),
    };
  });

  const categoryForecast: BudgetTotals["categoryForecast"] = categoryRows.map((row) => ({
    category: row.category === "gifts" ? "gifts_derived" : row.category,
    plannedMinor: row.budgetMinor,
    spentMinor: row.spentMinor,
    forecastMinor: row.spentMinor + row.plannedMinor,
    source: row.category === "gifts" ? "gifts" : "manual",
  }));

  return {
    totalBudgetMinor: total,
    giftPlannedMinor: giftPlanned,
    giftSpentMinor: giftSpent,
    giftCommittedMinor: giftCommitted,
    manualPlannedMinor,
    manualSpentMinor,
    spentMinor,
    plannedOutstandingMinor,
    forecastMinor,
    remainingMinor,
    remainingAfterSpendMinor,
    overForecastMinor,
    giftsWithoutPriceCount: giftsWithoutPrice,
    groceryCostKnown: groceryHint != null,
    groceryPlannedMinor: groceryHint,
    categoryRows,
    categoryForecast,
  };
}

export function collectBudgetCopy(snapshot: PlannerSnapshot, totals = computeBudgetTotals(snapshot)): string[] {
  const currency = snapshot.currency;
  const lines: string[] = [];
  if (totals.overForecastMinor > 0) {
    lines.push(
      `You’re ${formatPlannerMoney(totals.overForecastMinor, currency)} over your Christmas budget — easy to ease back.`,
    );
  } else if (totals.remainingAfterSpendMinor != null && totals.remainingAfterSpendMinor >= 0) {
    lines.push(`You have ${formatPlannerMoney(totals.remainingAfterSpendMinor, currency)} left.`);
  }
  const gifts = totals.categoryRows.find((r) => r.category === "gifts");
  if (gifts && gifts.budgetMinor > 0) {
    const used = Math.round((gifts.spentMinor / gifts.budgetMinor) * 100);
    if (used >= 78) lines.push(`Your gift budget is ${Math.min(used, 100)}% used.`);
  }
  for (const row of totals.categoryRows) {
    if (row.budgetMinor > 0 && row.spentMinor > row.budgetMinor) {
      lines.push(
        `You are ${formatPlannerMoney(row.spentMinor - row.budgetMinor, currency)} over your ${row.label} budget.`,
      );
    }
  }
  if (totals.plannedOutstandingMinor > 0) {
    lines.push(
      `You still have ${formatPlannerMoney(totals.plannedOutstandingMinor, currency)} planned but not yet spent.`,
    );
  }
  if (totals.giftsWithoutPriceCount > 0) {
    lines.push(
      `${totals.giftsWithoutPriceCount} ${totals.giftsWithoutPriceCount === 1 ? "gift doesn’t" : "gifts don’t"} have a budget yet.`,
    );
  }
  return lines;
}

export function formatPlannerMoney(minor: number, currency: string): string {
  const n = (Number(minor) || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency || "eur").toUpperCase(),
      maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    }).format(n);
  } catch {
    return `${n.toFixed(n % 1 === 0 ? 0 : 2)} ${(currency || "eur").toUpperCase()}`;
  }
}
