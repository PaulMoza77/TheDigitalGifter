export const GIFT_BROWSE_EMPTY_CTA_LABEL = "Explore categories";
export const GIFT_BROWSE_EMPTY_CTA_HREF = "/categories/occasions";

export type GiftBrowseEmptyCopyInput = {
  subjectLabel?: string | null;
  hasActiveFilters?: boolean;
};

export type GiftBrowseEmptyCopy = {
  title: string;
  description: string;
  primaryCtaLabel: string;
  primaryCtaTo: string;
};

function normalizeSubject(value?: string | null): string | null {
  const subject = String(value || "").trim();
  if (!subject) return null;

  const lowered = subject.toLowerCase();
  if (lowered === "all" || lowered === "this category") return null;

  return subject;
}

export function formatGiftBrowseCategoryLabel(category?: string | null): string | null {
  const value = String(category || "").trim();
  if (!value || value.toLowerCase() === "all") return null;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function giftBrowseEmptyStateCopy(
  input: GiftBrowseEmptyCopyInput = {}
): GiftBrowseEmptyCopy {
  const subject = normalizeSubject(input.subjectLabel);
  const title = subject ? `No matching gifts for ${subject}` : "No matching gifts";

  const description = input.hasActiveFilters
    ? `Nothing matches these filters${
        subject ? ` for ${subject}` : ""
      }. Explore another category or clear filters to keep creating a personalized gift.`
    : `We couldn't find gifts${
        subject ? ` for ${subject}` : " that match this browse"
      }. Explore categories to pick a new direction and keep going.`;

  return {
    title,
    description,
    primaryCtaLabel: GIFT_BROWSE_EMPTY_CTA_LABEL,
    primaryCtaTo: GIFT_BROWSE_EMPTY_CTA_HREF,
  };
}
