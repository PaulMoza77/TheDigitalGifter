export const GIFT_BROWSE_CATEGORIES_HREF = "/templates";
export const GIFT_BROWSE_CATEGORIES_CTA = "Explore categories";
export const GIFT_BROWSE_CLEAR_FILTERS_CTA = "Clear filters";
export const GIFT_BROWSE_EMPTY_TITLE = "No matching gifts";

export type GiftBrowseEmptyStateCopy = {
  title: string;
  description: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string | null;
};

function sanitizeLabel(label?: string | null): string {
  const trimmed = String(label || "").trim();
  return trimmed || "this selection";
}

export function giftBrowseEmptyStateCopy(input: {
  label?: string | null;
  hasActiveFilters?: boolean;
}): GiftBrowseEmptyStateCopy {
  const label = sanitizeLabel(input.label);
  const hasActiveFilters = Boolean(input.hasActiveFilters);

  const description = hasActiveFilters
    ? `Nothing matches these filters for ${label}. Clear them, or explore other categories to keep going.`
    : `We couldn’t find gifts for ${label}. Explore other categories to find a next step.`;

  return {
    title: GIFT_BROWSE_EMPTY_TITLE,
    description,
    primaryCtaLabel: GIFT_BROWSE_CATEGORIES_CTA,
    primaryCtaHref: GIFT_BROWSE_CATEGORIES_HREF,
    secondaryCtaLabel: hasActiveFilters ? GIFT_BROWSE_CLEAR_FILTERS_CTA : null,
  };
}
