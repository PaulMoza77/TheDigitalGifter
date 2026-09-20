import { describe, expect, it } from "vitest";
import { planGroceryRegeneration } from "./grocerySync";
import { foodTablesForOccasion, occasionMealSection } from "./persistence";
import { occasionScope } from "./types";
import type { GroceryMergeRow, SnapshotGrocery } from "../christmas/planner/intelligence/types";

describe("occasion seam", () => {
  it("defaults to Christmas 2026 without renaming tables", () => {
    expect(occasionScope(null).key).toBe("christmas");
    expect(foodTablesForOccasion().recipes).toBe("christmas_recipes");
    expect(occasionMealSection("christmas_day")).toBe("christmas_day");
    expect(occasionMealSection("christmas_day", { key: "birthday" })).toBe("other");
  });
});

describe("grocery regeneration", () => {
  const derived: GroceryMergeRow[] = [
    {
      key: "carrot|g",
      name: "carrot",
      aisle: "produce",
      displayQuantity: "800 g",
      status: "need",
      persistedId: null,
      derived: true,
      sources: ["Citrus honey roasted carrots"],
    },
  ];

  it("inserts once and updates instead of duplicating", () => {
    const first = planGroceryRegeneration({ derived, stored: [] });
    expect(first.ops.filter((o) => o.op === "insert")).toHaveLength(1);
    const stored: SnapshotGrocery[] = [
      {
        id: "g1",
        name: "produce|carrot",
        quantity: "800 g",
        status: "need",
        source_type: "derived",
        meal_item_id: null,
        ingredient_key: "carrot|g",
      },
    ];
    const second = planGroceryRegeneration({ derived, stored });
    expect(second.ops.some((o) => o.op === "insert")).toBe(false);
    const scaled: GroceryMergeRow[] = [{ ...derived[0], displayQuantity: "1600 g" }];
    const third = planGroceryRegeneration({ derived: scaled, stored });
    expect(third.ops.some((o) => o.op === "update")).toBe(true);
  });

  it("keeps checked and manual rows", () => {
    const stored: SnapshotGrocery[] = [
      {
        id: "have1",
        name: "produce|carrot",
        quantity: "800 g",
        status: "have",
        source_type: "derived",
        meal_item_id: null,
        ingredient_key: "carrot|g",
      },
      {
        id: "man1",
        name: "other|napkins",
        quantity: "1 pack",
        status: "need",
        source_type: "manual",
        meal_item_id: null,
      },
    ];
    const ops = planGroceryRegeneration({ derived, stored }).ops;
    expect(ops.find((o) => o.op === "keep" && o.id === "have1")).toBeTruthy();
    expect(ops.find((o) => o.op === "keep" && o.id === "man1")).toBeTruthy();
    expect(ops.some((o) => o.op === "delete" && o.id === "man1")).toBe(false);
  });
});
