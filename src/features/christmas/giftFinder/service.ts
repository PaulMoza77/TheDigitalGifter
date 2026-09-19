/**
 * Shared Gift Finder generation client.
 * Public Gift Finder and Planner Gift Concierge both call this.
 * Generation stays on the existing christmas-wishlist-funnel engine.
 */

import { supabase } from "@/lib/supabase";
import {
  getOrCreateFinderGuestToken,
  wishlistFunnel,
  type GiftIdea,
} from "../wishlist/wishlistApi";
import type { GiftFinderRunInput } from "./logic";
import {
  EXAMPLE_SETS,
  findExampleForProfile,
  type ExampleGiftIdea,
} from "./examples";
export {
  alreadyHasFinderGift,
  customAmountToBudgetKey,
  existingGiftsGenerationNote,
  filterObviousDuplicates,
  ideaPriceBucket,
  remainingMinorToBudgetKey,
  summarizeExistingGiftTitles,
} from "./logic";
export type { GiftFinderRunInput } from "./logic";

export type { GiftIdea };

export type GiftFinderRunResult = {
  sessionId: string | null;
  ideas: GiftIdea[];
  provider: string;
  usedFallback: boolean;
};

const DEFAULT_CUSTOM_INTEREST = "thoughtful Christmas gift";

function exampleIdeasToGiftIdeas(ideas: ExampleGiftIdea[]): GiftIdea[] {
  return ideas.map((idea, idx) => ({
    id: `curated_${idx}_${idea.ranking_role}`,
    result_key: `curated_${idx}_${idea.ranking_role}`,
    title: idea.title,
    reason: idea.reason,
    budget_min: idea.budget_min,
    budget_max: idea.budget_max,
    currency: "usd",
    category: idea.category,
    gift_type: idea.gift_type,
    ranking_role: idea.ranking_role,
    search_query: idea.search_query,
    tdg_product_key: idea.tdg_product_key,
  }));
}

export function curatedFallbackIdeas(input: {
  recipientKey: string;
  interestKeys: string[];
  personalityKeys: string[];
}): GiftIdea[] {
  const hit =
    findExampleForProfile({
      recipientKey: input.recipientKey,
      interestKeys: input.interestKeys,
      personalityKeys: input.personalityKeys,
    }) || EXAMPLE_SETS[0];
  return exampleIdeasToGiftIdeas(hit.ideas);
}

export async function giftFinderAuthBearer(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

export async function runGiftFinder(input: GiftFinderRunInput): Promise<GiftFinderRunResult> {
  const interestKeys = (input.interestKeys || []).slice(0, 6);
  const customInterest =
    String(input.customInterest || "").trim() ||
    (interestKeys.length ? "" : DEFAULT_CUSTOM_INTEREST);
  const data = await wishlistFunnel<{
    ok: boolean;
    session_id: string;
    ideas: GiftIdea[];
    provider?: string;
    used_fallback?: boolean;
  }>(
    {
      action: "runGiftFinder",
      guest_token: getOrCreateFinderGuestToken(),
      locale: input.locale || "en",
      country_code: input.countryCode || null,
      recipient_key: input.recipientKey,
      relationship_key: input.relationshipKey || null,
      age_range_key: input.ageRangeKey || "35_44",
      interest_keys: interestKeys,
      custom_interest: customInterest,
      personal_detail: String(input.personalDetail || "").slice(0, 280),
      personality_keys: input.personalityKeys || [],
      budget_key: input.budgetKey,
      gift_type_key: input.giftTypeKey || "either",
      vibe_key: input.vibeKey || null,
      refinement_key: input.refinementKey || null,
      force_new: Boolean(input.forceNew),
    },
    await giftFinderAuthBearer(),
  );
  return {
    sessionId: data.session_id || null,
    ideas: data.ideas || [],
    provider: data.provider || "live",
    usedFallback: Boolean(data.used_fallback),
  };
}

export async function runGiftFinderWithFallback(input: GiftFinderRunInput): Promise<GiftFinderRunResult> {
  try {
    const result = await runGiftFinder(input);
    if ((result.ideas || []).length) return result;
    throw new Error("no_ideas");
  } catch (err) {
    const fallback = curatedFallbackIdeas({
      recipientKey: input.recipientKey,
      interestKeys: input.interestKeys || [],
      personalityKeys: input.personalityKeys || [],
    });
    if (fallback.length >= 3) {
      return {
        sessionId: null,
        ideas: fallback,
        provider: "client_curated_fallback",
        usedFallback: true,
      };
    }
    throw err;
  }
}
