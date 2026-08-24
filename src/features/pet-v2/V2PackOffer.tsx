import { PET_V2_PRODUCTION_PRICE_DISPLAY, PET_V2_TEST_PRICE_CENTS, PET_V2_TEST_PRICE_DISPLAY } from "./types";
import { cn } from "@/lib/utils";

export function v2PackOfferCopy() {
  return {
    headline: `Get 12 secret lives and 2 mini clips for only ${PET_V2_TEST_PRICE_DISPLAY}`,
    priceDisplay: PET_V2_TEST_PRICE_DISPLAY,
    compareAtDisplay: PET_V2_PRODUCTION_PRICE_DISPLAY,
    amountCents: PET_V2_TEST_PRICE_CENTS,
  };
}

export function V2PackOffer({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const offer = v2PackOfferCopy();
  return (
    <div
      className={cn(
        "rounded-2xl border border-[#d4a84b]/40 bg-[#d4a84b]/12 px-4 py-3",
        className,
      )}
    >
      {compact ? null : (
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d4a84b]">
          What you get
        </p>
      )}
      <p className={cn("font-semibold tracking-tight text-[#f6efe4]", compact ? "text-base" : "mt-1 text-lg")}>
        Get 12 secret lives and 2 mini clips for only{" "}
        <s className="font-medium text-[#f6efe4]/45">{offer.compareAtDisplay}</s>{" "}
        <span className="text-[#f3d48a]">{offer.priceDisplay}</span>
      </p>
      <p className="mt-1 text-sm text-[#f6efe4]/65">One-time · no subscription · same pet in every portrait and clip</p>
    </div>
  );
}
