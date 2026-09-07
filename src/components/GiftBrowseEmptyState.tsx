import { Link } from "react-router-dom";
import { Gift } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  GIFT_BROWSE_EMPTY_CTA_HREF,
  GIFT_BROWSE_EMPTY_CTA_LABEL,
  giftBrowseEmptyStateCopy,
} from "@/components/giftBrowseEmptyState";

type Props = {
  title?: string;
  description?: string;
  primaryCtaLabel?: string;
  primaryCtaTo?: string;
  subjectLabel?: string | null;
  hasActiveFilters?: boolean;
  emoji?: string | null;
  showClearFilters?: boolean;
  onClearFilters?: () => void;
  className?: string;
};

export default function GiftBrowseEmptyState({
  title,
  description,
  primaryCtaLabel,
  primaryCtaTo,
  subjectLabel,
  hasActiveFilters = false,
  emoji,
  showClearFilters = false,
  onClearFilters,
  className,
}: Props) {
  const copy = giftBrowseEmptyStateCopy({ subjectLabel, hasActiveFilters });
  const heading = title ?? copy.title;
  const body = description ?? copy.description;
  const ctaLabel = primaryCtaLabel ?? copy.primaryCtaLabel;
  const ctaTo = primaryCtaTo ?? copy.primaryCtaTo;
  const clearLabel = copy.secondaryCtaLabel;

  return (
    <div
      role="status"
      data-testid="gift-browse-empty-state"
      className={cn(
        "rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-16",
        className
      )}
    >
      <div className="mx-auto max-w-md text-center">
        <div className="mb-4 flex justify-center text-6xl" aria-hidden="true">
          {emoji ? emoji : <Gift className="h-12 w-12 text-cyan-200" />}
        </div>

        <h3 className="mb-2 text-xl font-bold text-[#fffef5]">{heading}</h3>

        <p className="mb-6 text-[#c1c8d8]">{body}</p>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to={ctaTo || GIFT_BROWSE_EMPTY_CTA_HREF}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-transparent bg-[linear-gradient(120deg,#ff4d4d,#ff9866,#ffd976)] px-6 py-3 font-semibold text-[#1a1a1a] transition-all hover:brightness-110"
          >
            {ctaLabel || GIFT_BROWSE_EMPTY_CTA_LABEL}
          </Link>

          {showClearFilters && onClearFilters && clearLabel ? (
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/5 px-6 py-3 font-semibold text-white/85 transition-colors hover:bg-white/10"
            >
              {clearLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
