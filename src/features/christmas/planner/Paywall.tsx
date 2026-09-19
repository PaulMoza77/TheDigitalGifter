import { type PlannerFeatureKey } from "./types";
import { PlannerLockedModule } from "./plannerUi";

export function PlannerPaywall({
  feature,
  title,
  body,
}: {
  feature: PlannerFeatureKey;
  title: string;
  body: string;
}) {
  const bullets =
    feature === "budget"
      ? ["Planned vs spent at a glance", "Gift prices roll in automatically", "Category caps without a spreadsheet"]
      : feature === "food_planner"
        ? ["Menus for Eve and Christmas Day", "One grocery list from dishes", "Prep times you can actually follow"]
        : feature === "hosting"
          ? ["Guests and RSVPs in one place", "Dietary notes, not sensitive data", "Home prep checklist"]
          : feature === "travel"
            ? ["Trips and packing lists", "Booking notes only", "Never passport or card data"]
            : feature === "recipes"
              ? ["Original TDG recipes", "Save into Eve and Day menus", "Ingredients into grocery"]
              : undefined;
  return <PlannerLockedModule feature={feature} title={title} body={body} bullets={bullets} />;
}

export function money(minor: number | null | undefined, currency: string): string {
  const n = Number(minor || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency || "eur").toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${(currency || "eur").toUpperCase()}`;
  }
}
