import {
  existingGiftsGenerationNote,
  remainingMinorToBudgetKey,
  type GiftFinderRunInput,
  type GiftIdea,
} from "../../giftFinder/logic";
import type { GiftItem, GiftRecipient } from "../types";
import { giftCommittedMinor } from "../intelligence/budgetIntelligence";

export const CONCIERGE_VIBE_CHIPS = [
  { key: "practical", label: "Practical", personality: "practical", refinement: "more_practical" as const },
  { key: "meaningful", label: "Meaningful", personality: "sentimental", refinement: "more_personal" as const },
  { key: "unique", label: "Unique", personality: null, refinement: "more_unique" as const },
  { key: "luxury", label: "Luxury", personality: "luxury_minded", refinement: "more_premium" as const },
  { key: "funny", label: "Funny", personality: "funny", refinement: null },
  { key: "experience", label: "Experience", personality: "loves_experiences", refinement: null, giftType: "experience" as const },
  { key: "last_minute", label: "Last-minute", personality: null, refinement: null, custom: "easy last-minute gift" },
] as const;

export const CONCIERGE_PRICE_CHIPS = [
  { key: "under_25", label: "Under €25" },
  { key: "25_50", label: "€25 - 50" },
  { key: "50_100", label: "€50 - 100" },
  { key: "custom", label: "Custom" },
] as const;

const RECIPIENT_ALIASES: Record<string, string> = {
  mom: "mom",
  mother: "mom",
  mum: "mom",
  mama: "mom",
  dad: "dad",
  father: "dad",
  papa: "dad",
  wife: "wife",
  husband: "husband",
  girlfriend: "girlfriend",
  boyfriend: "boyfriend",
  partner: "partner",
  spouse: "partner",
  daughter: "daughter",
  son: "son",
  teen: "teen",
  child: "child",
  kid: "child",
  kids: "child",
  grandma: "grandma",
  grandmother: "grandma",
  grandpa: "grandpa",
  grandfather: "grandpa",
  friend: "friend",
  coworker: "coworker",
  colleague: "coworker",
  teacher: "teacher",
  family: "other",
};

const RELATIONSHIP_ALIASES: Record<string, string> = {
  family: "close_family",
  close_family: "close_family",
  partner: "partner",
  wife: "partner",
  husband: "partner",
  girlfriend: "partner",
  boyfriend: "partner",
  friend: "friend",
  coworker: "colleague",
  colleague: "colleague",
  teacher: "acquaintance",
  other: "acquaintance",
};

export type ConciergeBudgetContext = {
  budgetMinor: number | null;
  plannedMinor: number;
  committedMinor: number;
  remainingMinor: number | null;
};

export function recipientFinderKeys(relationship: string): {
  recipientKey: string;
  relationshipKey: string;
  ageRangeKey: string;
} {
  const raw = String(relationship || "").trim().toLowerCase();
  const recipientKey = RECIPIENT_ALIASES[raw] || "other";
  const relationshipKey = RELATIONSHIP_ALIASES[raw] || "close_family";
  let ageRangeKey = "35_44";
  if (["child", "son", "daughter", "kid", "kids"].includes(raw)) ageRangeKey = "6_12";
  if (raw === "teen") ageRangeKey = "13_17";
  if (["grandma", "grandfather", "grandpa", "grandmother"].includes(raw)) ageRangeKey = "65_plus";
  return { recipientKey, relationshipKey, ageRangeKey };
}

export function recipientSpendContext(
  recipient: Pick<GiftRecipient, "id" | "budget_minor">,
  gifts: GiftItem[],
): ConciergeBudgetContext {
  const theirs = gifts.filter((g) => g.recipient_id === recipient.id);
  const plannedMinor = theirs.reduce((s, g) => s + (g.planned_price_minor || 0), 0);
  const committedMinor = theirs.reduce((s, g) => s + giftCommittedMinor(g), 0);
  const budgetMinor = recipient.budget_minor;
  return {
    budgetMinor,
    plannedMinor,
    committedMinor,
    remainingMinor: budgetMinor == null ? null : budgetMinor - committedMinor,
  };
}

export function existingGiftTitlesForRecipient(gifts: GiftItem[], recipientId: string): string[] {
  return gifts
    .filter((g) => g.recipient_id === recipientId)
    .map((g) => g.selected_gift || g.idea)
    .filter(Boolean);
}

export function generalizedRelationshipCategory(relationship: string): string {
  const { relationshipKey } = recipientFinderKeys(relationship);
  return relationshipKey;
}

export type ConciergeDraft = {
  interests: string;
  vibeKeys: string[];
  priceKey: string | null;
  customBudget: string;
};

export function buildConciergeFinderInput(opts: {
  recipient: GiftRecipient;
  gifts: GiftItem[];
  currency: string;
  locale?: string;
  countryCode?: string | null;
  draft: ConciergeDraft;
  likeIdea?: GiftIdea | null;
  avoidTitles?: string[];
}): GiftFinderRunInput {
  const keys = recipientFinderKeys(opts.recipient.relationship);
  const spend = recipientSpendContext(opts.recipient, opts.gifts);
  const existing = existingGiftTitlesForRecipient(opts.gifts, opts.recipient.id);
  const avoid = [...existing, ...(opts.avoidTitles || [])];
  const vibeRows = CONCIERGE_VIBE_CHIPS.filter((chip) => opts.draft.vibeKeys.includes(chip.key));
  const personalityKeys = vibeRows.map((row) => row.personality).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const refinement =
    opts.likeIdea ? "more_unique" : vibeRows.map((row) => row.refinement).find(Boolean) || null;
  const giftType = vibeRows.some((row) => "giftType" in row && row.giftType)
    ? "experience"
    : "either";
  const customBits = [
    opts.draft.interests.trim().slice(0, 120),
    ...vibeRows.map((row) => ("custom" in row ? row.custom : "")).filter(Boolean),
  ].filter(Boolean);
  let budgetKey = remainingMinorToBudgetKey(spend.remainingMinor);
  if (opts.draft.priceKey && opts.draft.priceKey !== "custom") budgetKey = opts.draft.priceKey;
  if (opts.draft.priceKey === "custom" && opts.draft.customBudget) {
    const n = Number(opts.draft.customBudget);
    if (Number.isFinite(n) && n > 0) budgetKey = remainingMinorToBudgetKey(Math.round(n * 100));
  }

  const notes = [
    existingGiftsGenerationNote(avoid),
    opts.likeIdea ? `More like: ${opts.likeIdea.title.slice(0, 80)}.` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 280);

  return {
    locale: opts.locale || "en",
    countryCode: opts.countryCode || null,
    recipientKey: keys.recipientKey,
    relationshipKey: keys.relationshipKey,
    ageRangeKey: keys.ageRangeKey,
    interestKeys: [],
    customInterest: customBits.join("; ") || undefined,
    personalDetail: notes,
    personalityKeys,
    budgetKey,
    giftTypeKey: giftType,
    refinementKey: refinement,
    forceNew: Boolean(opts.likeIdea),
  };
}

export type BudgetFit = "fits" | "above" | "unknown";

export function suggestionBudgetFit(
  idea: Pick<GiftIdea, "budget_min" | "budget_max">,
  remainingMinor: number | null,
): BudgetFit {
  if (remainingMinor == null) return "unknown";
  const remainingMajor = remainingMinor / 100;
  const min = idea.budget_min;
  const max = idea.budget_max;
  if (min == null && max == null) return "unknown";
  if (min != null && min > remainingMajor) return "above";
  if (max != null && max <= remainingMajor) return "fits";
  if (min != null && min <= remainingMajor) return "fits";
  return "above";
}

export function typicalPriceLabel(idea: Pick<GiftIdea, "budget_min" | "budget_max">): string | null {
  if (idea.budget_min == null && idea.budget_max == null) return null;
  if (idea.budget_min != null && idea.budget_max != null) {
    return `Typically €${idea.budget_min} - ${idea.budget_max}`;
  }
  const n = idea.budget_max ?? idea.budget_min;
  return n != null ? `Typically around €${n}` : null;
}
