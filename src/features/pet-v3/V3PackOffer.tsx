import { Button } from "@/components/ui/button";
import { v3PackOfferCopy } from "./config";
import { cn } from "@/lib/utils";

export function V3PackOffer({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const offer = v3PackOfferCopy();
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
        Get 12 secret lives and 2 mini clips for{" "}
        <span className="text-[#f3d48a]">{offer.priceDisplay}</span>
      </p>
      <p className="mt-1 text-sm text-[#f6efe4]/65">One-time · no subscription · same cat in every portrait and clip</p>
    </div>
  );
}

export function V3StickyCta({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  const offer = v3PackOfferCopy();
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#f6efe4]/10 bg-[#140e0a]/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <Button
          type="button"
          onClick={onClick}
          className="h-12 min-h-[48px] w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63]"
        >
          {label}
        </Button>
        <p className="mt-1.5 text-center text-[11px] tabular-nums text-[#f6efe4]/55">
          {offer.priceDisplay} one-time · no card for the free preview
        </p>
      </div>
    </div>
  );
}

export function V3ClosingCta({ onClick }: { onClick: () => void }) {
  const offer = v3PackOfferCopy();
  return (
    <section className="rounded-[28px] bg-[#d4a84b] px-6 py-9 text-center text-[#1a140e]">
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        One photo. 12 secret lives. 2 cinematic clips.
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#1a140e]/75">
        Upload one cat photo for a free royal preview. Unlock all 12 secret lives and 2 mini clips for {offer.priceDisplay}.
      </p>
      <Button
        type="button"
        onClick={onClick}
        className="mt-5 h-12 min-h-[48px] w-full rounded-full bg-[#1a140e] px-7 text-base font-semibold text-[#f6efe4] hover:bg-[#2a2018] sm:w-auto"
      >
        Create my free preview
      </Button>
    </section>
  );
}
