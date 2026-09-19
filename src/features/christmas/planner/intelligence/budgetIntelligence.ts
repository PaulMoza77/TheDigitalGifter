import type { BudgetCategory } from "../types";
import type { BudgetTotals, PlannerSnapshot, SnapshotGift } from "./types";

const PROGRESSED = new Set(["planned", "ordered", "arrived", "hidden", "wrapped", "given"]);

export function giftCommittedMinor(gift: Pick<SnapshotGift, "planned_price_minor" | "actual_price_minor">): number {
  if (gift.actual_price_minor != null && gift.actual_price_minor > 0) return gift.actual_price_minor;
  if (gift.planned_price_minor != null && gift.planned_price_minor > 0) return gift.planned_price_minor;
  return 0;
}

export function giftSpentMinor(gift: Pick<SnapshotGift, "actual_price_minor">): number {
  return gift.actual_price_minor != null && gift.actual_price_minor > 0 ? gift.actual_price_minor : 0;
}

export function giftForecastMinor(gift: Pick<SnapshotGift, "planned_price_minor" | "actual_price_minor" | "status">): number {
  if (gift.actual_price_minor != null && gift.actual_price_minor > 0) return gift.actual_price_minor;
  if (!PROGRESSED.has(gift.status) && gift.status !== "idea") return gift.planned_price_minor || 0;
  return gift.planned_price_minor || 0;
}

export function computeBudgetTotals(snapshot: PlannerSnapshot): BudgetTotals {
  const gifts = snapshot.gifts;
  const giftSpent = gifts.reduce((s, g) => s + giftSpentMinor(g), 0);
  const giftPlanned = gifts.reduce((s, g) => {
    if (giftSpentMinor(g) > 0) return s;
    return s + (g.planned_price_minor || 0);
  }, 0);
  const giftCommitted = gifts.reduce((s, g) => s + giftCommittedMinor(g), 0);

  const manual = snapshot.budgetEntries;
  const giftsCategory = manual.filter((r) => r.category === "gifts");
  const otherManual = manual.filter((r) => r.category !== "gifts");

  const manualSpent = manual.reduce((s, r) => s + (r.spent_minor || 0), 0);
  const otherPlanned = otherManual.reduce((s, r) => s + (r.planned_minor || 0), 0);
  const otherSpent = otherManual.reduce((s, r) => s + (r.spent_minor || 0), 0);
  const giftsCategoryPlanned = giftsCategory.reduce((s, r) => s + r.planned_minor, 0);
  const manualPlanned = manual.reduce((s, r) => s + (r.planned_minor || 0), 0);

  const spentMinor = giftSpent + manualSpent;
  const otherForecast = otherManual.reduce((s, r) => s + Math.max(r.planned_minor || 0, r.spent_minor || 0), 0);
  const forecastMinor = giftCommitted + otherForecast;

  const total = snapshot.profile.totalBudgetMinor;
  const remainingMinor = total != null ? total - spentMinor : null;
  const overForecastMinor = total != null ? Math.max(0, forecastMinor - total) : 0;

  const categories: BudgetTotals["categoryForecast"] = [];
  const cats = new Set<BudgetCategory>([...manual.map((r) => r.category), "gifts"]);
  for (const category of cats) {
    if (category === "gifts") {
      categories.push({
        category: "gifts_derived",
        plannedMinor: giftsCategoryPlanned,
        spentMinor: giftSpent,
        forecastMinor: giftCommitted,
        source: "gifts",
      });
      const giftsManualSpent = giftsCategory.reduce((s, r) => s + r.spent_minor, 0);
      if (giftsManualSpent > 0 || giftsCategoryPlanned > 0) {
        categories.push({
          category: "gifts",
          plannedMinor: giftsCategoryPlanned,
          spentMinor: giftsManualSpent,
          forecastMinor: Math.max(giftsCategoryPlanned, giftsManualSpent),
          source: "manual",
        });
      }
      continue;
    }
    const rows = otherManual.filter((r) => r.category === category);
    const planned = rows.reduce((s, r) => s + r.planned_minor, 0);
    const spent = rows.reduce((s, r) => s + r.spent_minor, 0);
    categories.push({
      category,
      plannedMinor: planned,
      spentMinor: spent,
      forecastMinor: Math.max(planned, spent),
      source: "manual",
    });
  }

  return {
    totalBudgetMinor: total,
    giftPlannedMinor: giftPlanned,
    giftSpentMinor: giftSpent,
    giftCommittedMinor: giftCommitted,
    manualPlannedMinor: manualPlanned,
    manualSpentMinor: manualSpent,
    spentMinor,
    forecastMinor,
    remainingMinor,
    overForecastMinor,
    categoryForecast: categories,
  };
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
