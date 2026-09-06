import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { giftBrowseEmptyStateCopy } from "@/components/giftBrowseEmptyState";

type Props = {
  label?: string | null;
  hasActiveFilters?: boolean;
  emoji?: string;
  onClearFilters?: () => void;
  onExploreCategories?: () => void;
};

export default function GiftBrowseEmptyState({
  label,
  hasActiveFilters = false,
  emoji,
  onClearFilters,
  onExploreCategories,
}: Props) {
  const copy = giftBrowseEmptyStateCopy({ label, hasActiveFilters });

  return (
    <div
      className="rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-16"
      role="status"
      data-testid="gift-browse-empty-state"
    >
      <div className="mx-auto max-w-md text-center">
        {emoji ? (
          <div className="mb-4 text-6xl" aria-hidden="true">
            {emoji}
          </div>
        ) : null}

        <h3 className="mb-2 text-xl font-bold text-[#fffef5]">{copy.title}</h3>

        <p className="mb-6 text-[#c1c8d8]">{copy.description}</p>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to={copy.primaryCtaHref}
            onClick={onExploreCategories}
            className="inline-flex items-center gap-2 rounded-lg border border-transparent bg-[linear-gradient(120deg,#ff4d4d,#ff9866,#ffd976)] px-6 py-3 font-semibold text-[#1a1a1a] transition-all hover:brightness-110"
          >
            {copy.primaryCtaLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>

          {copy.secondaryCtaLabel && onClearFilters ? (
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-6 py-3 font-semibold text-white/85 transition-colors hover:bg-white/10"
            >
              {copy.secondaryCtaLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
