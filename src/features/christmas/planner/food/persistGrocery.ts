import { supabase } from "@/lib/supabase";
import type { GroceryPersistOp } from "@/features/occasions/grocerySync";

export async function applyGroceryOps(profileId: string, ops: GroceryPersistOp[]): Promise<{ inserted: number; updated: number; deleted: number }> {
  let inserted = 0;
  let updated = 0;
  let deleted = 0;
  const toInsert = ops.filter((op): op is Extract<GroceryPersistOp, { op: "insert" }> => op.op === "insert");
  const toUpdate = ops.filter((op): op is Extract<GroceryPersistOp, { op: "update" }> => op.op === "update");
  const toDelete = ops.filter((op): op is Extract<GroceryPersistOp, { op: "delete" }> => op.op === "delete");

  if (toInsert.length) {
    const { error } = await supabase.from("christmas_grocery_items").insert(
      toInsert.map((op) => ({
        profile_id: profileId,
        name: op.name,
        quantity: op.quantity,
        status: "need",
        source_type: "derived",
        ingredient_key: op.ingredientKey,
        source_notes: op.sourceNotes || (op.sources || []).join(" · ").slice(0, 240),
      })),
    );
    if (!error) inserted = toInsert.length;
  }
  for (const op of toUpdate) {
    const { error } = await supabase
      .from("christmas_grocery_items")
      .update({
        quantity: op.quantity,
        name: op.name,
        ingredient_key: op.ingredientKey,
        source_type: "derived",
        source_notes: op.sources?.join(" · ").slice(0, 240) || "",
      })
      .eq("id", op.id)
      .eq("profile_id", profileId);
    if (!error) updated += 1;
  }
  for (const op of toDelete) {
    const { error } = await supabase.from("christmas_grocery_items").delete().eq("id", op.id).eq("profile_id", profileId);
    if (!error) deleted += 1;
  }
  return { inserted, updated, deleted };
}
