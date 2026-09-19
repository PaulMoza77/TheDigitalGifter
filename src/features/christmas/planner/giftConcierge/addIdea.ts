import { supabase } from "@/lib/supabase";
import { alreadyHasFinderGift, type GiftIdea } from "../../giftFinder/logic";
import type { GiftItem } from "../types";

export async function addFinderIdeaToPlanner(input: {
  profileId: string;
  recipientId: string;
  idea: GiftIdea;
  existing: GiftItem[];
}): Promise<{ gift: GiftItem; duplicate: boolean }> {
  const hit = input.existing.find((g) =>
    alreadyHasFinderGift(
      [
        {
          source_type: g.source_type,
          source_ref: g.source_ref,
          idea: g.idea,
          selected_gift: g.selected_gift,
        },
      ],
      input.idea,
    ),
  );
  if (hit) return { gift: hit, duplicate: true };

  const title = input.idea.title.trim().slice(0, 200);
  const sourceRef = String(input.idea.result_key || input.idea.id || "").slice(0, 80) || null;
  const { data, error } = await supabase
    .from("christmas_gift_items")
    .insert({
      profile_id: input.profileId,
      recipient_id: input.recipientId,
      idea: title,
      selected_gift: title,
      status: "idea",
      source_type: "gift_finder",
      source_ref: sourceRef,
    })
    .select("*")
    .maybeSingle();
  if (error || !data) throw new Error("Could not add this idea to the planner.");
  return { gift: data as GiftItem, duplicate: false };
}
