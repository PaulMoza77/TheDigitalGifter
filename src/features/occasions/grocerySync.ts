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

const UNIT_ALIASES: Record<string, string> = {
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  ml: "ml",
  millilitre: "ml",
  milliliter: "ml",
  l: "l",
  liter: "l",
  litre: "l",
  cup: "cup",
  cups: "cup",
  piece: "piece",
  pieces: "piece",
  pc: "piece",
  pcs: "piece",
  tbsp: "tbsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tsp: "tsp",
  oz: "oz",
  lb: "lb",
  lbs: "lb",
};

function parseQty(raw: string): { n: number; unit: string } | null {
  const match = raw.trim().match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)?$/);
  if (!match) return null;
  const n = Number(match[1].replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const unitRaw = (match[2] || "").toLowerCase();
  return { n, unit: UNIT_ALIASES[unitRaw] || unitRaw };
}

function formatQty(n: number, unit: string): string {
  const shown = Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
  return unit ? `${shown} ${unit}` : shown;
}

/** Combine two quantities when the units match or convert (g/kg, ml/l). */
export function mergeCompatibleQuantity(current: string, incoming: string): string | null {
  const next = incoming.trim();
  const prev = current.trim();
  if (!next) return prev || "";
  if (!prev) return next;
  const left = parseQty(prev);
  const right = parseQty(next);
  if (!left || !right) {
    return prev.toLowerCase() === next.toLowerCase() ? prev : null;
  }
  if (left.unit === right.unit) return formatQty(left.n + right.n, left.unit);
  const grams = (unit: string, n: number) => (unit === "kg" ? n * 1000 : unit === "g" ? n : null);
  const ml = (unit: string, n: number) => (unit === "l" ? n * 1000 : unit === "ml" ? n : null);
  const g = (grams(left.unit, left.n) ?? 0) + (grams(right.unit, right.n) ?? 0);
  if (grams(left.unit, left.n) != null && grams(right.unit, right.n) != null) {
    return g >= 1000 ? formatQty(g / 1000, "kg") : formatQty(g, "g");
  }
  const volume = (ml(left.unit, left.n) ?? 0) + (ml(right.unit, right.n) ?? 0);
  if (ml(left.unit, left.n) != null && ml(right.unit, right.n) != null) {
    return volume >= 1000 ? formatQty(volume / 1000, "l") : formatQty(volume, "ml");
  }
  return null;
}

export type ManualGroceryPlan =
  | { action: "insert"; name: string; quantity: string }
  | { action: "merge"; id: string; quantity: string }
  | { action: "duplicate"; id: string; reason: "same_item" | "incompatible_unit" };

export function planManualGroceryAdd(input: {
  items: Array<{ id: string; name: string; quantity: string }>;
  aisle: string;
  label: string;
  quantity: string;
}): ManualGroceryPlan {
  const label = input.label.trim();
  const storedName = `${input.aisle}|${label}`.slice(0, 120);
  const match = input.items.find((row) => {
    const [aisle, ...rest] = row.name.split("|");
    const rowLabel = rest.length ? rest.join("|") : row.name;
    const rowAisle = rest.length ? aisle : "other";
    return rowAisle === input.aisle && rowLabel.trim().toLowerCase() === label.toLowerCase();
  });
  if (!match) return { action: "insert", name: storedName, quantity: input.quantity.slice(0, 40) };
  const merged = mergeCompatibleQuantity(match.quantity || "", input.quantity || "");
  if (merged == null) return { action: "duplicate", id: match.id, reason: "incompatible_unit" };
  if ((match.quantity || "").trim() === merged.trim() && !input.quantity.trim()) {
    return { action: "duplicate", id: match.id, reason: "same_item" };
  }
  if ((match.quantity || "").trim() === merged.trim()) {
    return { action: "duplicate", id: match.id, reason: "same_item" };
  }
  return { action: "merge", id: match.id, quantity: merged.slice(0, 40) };
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
