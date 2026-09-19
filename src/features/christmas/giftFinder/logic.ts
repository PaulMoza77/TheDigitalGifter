import type { GiftIdea } from "../wishlist/wishlistApi";

export type { GiftIdea };

export type GiftFinderRunInput = {
  locale?: string;
  countryCode?: string | null;
  recipientKey: string;
  relationshipKey?: string | null;
  ageRangeKey?: string;
  interestKeys?: string[];
  customInterest?: string;
  personalDetail?: string;
  personalityKeys?: string[];
  budgetKey: string;
  giftTypeKey?: string;
  vibeKey?: string | null;
  refinementKey?: string | null;
  forceNew?: boolean;
};

export function remainingMinorToBudgetKey(remainingMinor: number | null | undefined): string {
  if (remainingMinor == null) return "flexible";
  const major = remainingMinor / 100;
  if (major <= 0) return "under_25";
  if (major < 25) return "under_25";
  if (major < 50) return "25_50";
  if (major < 100) return "50_100";
  if (major < 200) return "100_200";
  return "200_plus";
}

export function customAmountToBudgetKey(major: number): string {
  if (!Number.isFinite(major) || major <= 0) return "flexible";
  return remainingMinorToBudgetKey(Math.round(major * 100));
}

export function ideaPriceBucket(idea: Pick<GiftIdea, "budget_min" | "budget_max">): string {
  const max = idea.budget_max ?? idea.budget_min;
  if (max == null) return "unknown";
  if (max < 25) return "under_25";
  if (max < 50) return "25_50";
  if (max < 100) return "50_100";
  if (max < 200) return "100_200";
  return "200_plus";
}

function normalizeTitle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function summarizeExistingGiftTitles(titles: string[], limit = 8): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of titles) {
    const title = String(raw || "").trim().slice(0, 80);
    if (!title) continue;
    const key = normalizeTitle(title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(title);
    if (out.length >= limit) break;
  }
  return out;
}

export function existingGiftsGenerationNote(titles: string[]): string {
  const compact = summarizeExistingGiftTitles(titles);
  if (!compact.length) return "";
  return `Already considering: ${compact.join(", ")}. Avoid obvious duplicates.`;
}

export function filterObviousDuplicates(ideas: GiftIdea[], existingTitles: string[]): GiftIdea[] {
  const blocked = new Set(summarizeExistingGiftTitles(existingTitles).map(normalizeTitle));
  if (!blocked.size) return ideas;
  const kept = ideas.filter((row) => !blocked.has(normalizeTitle(row.title)));
  return kept.length ? kept : ideas;
}

export function alreadyHasFinderGift(
  existing: Array<{ source_type?: string; source_ref?: string | null; idea?: string; selected_gift?: string }>,
  idea: Pick<GiftIdea, "result_key" | "id" | "title">,
): boolean {
  const ref = idea.result_key || idea.id;
  const title = normalizeTitle(idea.title);
  return existing.some((g) => {
    if (ref && g.source_ref && g.source_ref === ref) return true;
    const label = normalizeTitle(`${g.selected_gift || ""} ${g.idea || ""}`);
    return Boolean(title) && (label === title || label.includes(title));
  });
}
