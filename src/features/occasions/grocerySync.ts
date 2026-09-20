import type { OccasionContext } from "../occasions/types";
import { occasionScope } from "../occasions/types";
import type { GroceryAisle } from "../christmas/planner/types";
import type { GroceryMergeRow, SnapshotGrocery } from "../christmas/planner/intelligence/types";

export type GroceryPersistOp =
    | {
      op: "insert";
      ingredientKey: string;
      name: string;
      quantity: string;
      sourceType: "derived";
      sources: string[];
      sourceNotes?: string;
    }
  | {
      op: "update";
      id: string;
      ingredientKey: string;
      quantity: string;
      name: string;
      sources?: string[];
    }
  | { op: "keep"; id: string; reason: "checked" | "manual" | "unchanged" }
  | { op: "delete"; id: string; reason: "stale_derived_need" };

function storedKey(row: SnapshotGrocery): string | null {
  const metaKey = (row as SnapshotGrocery & { ingredient_key?: string | null }).ingredient_key;
  if (metaKey) return metaKey;
  return null;
}

/**
 * Plan grocery row writes so regeneration never duplicates persisted rows.
 * Manual and checked (have/bought) rows are never deleted.
 */
export function planGroceryRegeneration(input: {
  derived: GroceryMergeRow[];
  stored: SnapshotGrocery[];
  occasion?: Partial<OccasionContext> | null;
}): { occasion: OccasionContext; ops: GroceryPersistOp[] } {
  const occasion = occasionScope(input.occasion);
  const ops: GroceryPersistOp[] = [];
  const usedStored = new Set<string>();

  for (const item of input.derived) {
    const match =
      input.stored.find((row) => storedKey(row) === item.key) ||
      input.stored.find((row) => row.id && item.persistedId === row.id) ||
      input.stored.find((row) => {
        const label = row.name.includes("|") ? row.name.split("|").slice(1).join("|") : row.name;
        return label.toLowerCase() === item.name.toLowerCase() && !usedStored.has(row.id);
      });
    if (match) {
      usedStored.add(match.id);
      const persistName = `${item.aisle}|${item.name}`.slice(0, 120);
      const qtyChanged = (match.quantity || "") !== item.displayQuantity;
      const nameChanged = match.name !== persistName;
      if (match.status === "have" || match.status === "bought") {
        ops.push({ op: "keep", id: match.id, reason: "checked" });
        continue;
      }
      if (qtyChanged || nameChanged) {
        ops.push({
          op: "update",
          id: match.id,
          ingredientKey: item.key,
          quantity: item.displayQuantity.slice(0, 40),
          name: persistName,
          sources: item.sources || [],
        });
      } else {
        ops.push({ op: "keep", id: match.id, reason: "unchanged" });
      }
      continue;
    }
    ops.push({
      op: "insert",
      ingredientKey: item.key,
      name: `${item.aisle}|${item.name}`.slice(0, 120),
      quantity: item.displayQuantity.slice(0, 40),
      sourceType: "derived",
      sources: item.sources || [],
      sourceNotes: (item.sources || []).join(" · ").slice(0, 240),
    });
  }

  for (const row of input.stored) {
    if (usedStored.has(row.id)) continue;
    const manual = row.source_type === "manual" || row.source_type === "user";
    if (manual || row.status === "have" || row.status === "bought") {
      ops.push({ op: "keep", id: row.id, reason: manual ? "manual" : "checked" });
      continue;
    }
    if (row.source_type === "derived" || row.source_type === "grocery") {
      ops.push({ op: "delete", id: row.id, reason: "stale_derived_need" });
    } else {
      ops.push({ op: "keep", id: row.id, reason: "manual" });
    }
  }

  return { occasion, ops };
}

export function groceryInsertWouldDuplicate(
  stored: SnapshotGrocery[],
  ingredientKey: string,
): boolean {
  return stored.some((row) => storedKey(row) === ingredientKey);
}

export const GROCERY_AISLE_ORDER: GroceryAisle[] = [
  "produce",
  "meat",
  "dairy",
  "bakery",
  "pantry",
  "frozen",
  "drinks",
  "other",
];
