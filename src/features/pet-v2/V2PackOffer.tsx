import { Button } from "@/components/ui/button";
import { PET_SALE_EXPIRES_AT_ISO, PET_SALE_EXPIRES_AT_MS } from "../pet/flashSale";
import { SaleCountdown, useSaleCountdown } from "../pet/components/SaleOffer";
import {
  PET_V2_PRODUCTION_PRICE_CENTS,
  PET_V2_PRODUCTION_PRICE_DISPLAY,
  PET_V2_TEST_PRICE_CENTS,
  PET_V2_TEST_PRICE_DISPLAY,
} from "./types";
import { cn } from "@/lib/utils";

export function v2PackOfferCopy(nowMs = Date.now()) {
  const saleActive = nowMs < PET_SALE_EXPIRES_AT_MS;
  if (!saleActive) {
    return {
      saleActive: false,
      headline: `Get 12 secret lives and 2 mini clips for ${PET_V2_PRODUCTION_PRICE_DISPLAY}`,
      priceDisplay: PET_V2_PRODUCTION_PRICE_DISPLAY,
      compareAtDisplay: PET_V2_PRODUCTION_PRICE_DISPLAY,
      amountCents: PET_V2_PRODUCTION_PRICE_CENTS,
      expiresAt: null as string | null,
    };
  }
  return {
    saleActive: true,
    headline: `Get 12 secret lives and 2 mini clips for only ${PET_V2_TEST_PRICE_DISPLAY}`,
    priceDisplay: PET_V2_TEST_PRICE_DISPLAY,
    compareAtDisplay: PET_V2_PRODUCTION_PRICE_DISPLAY,
    amountCents: PET_V2_TEST_PRICE_CENTS,
    expiresAt: PET_SALE_EXPIRES_AT_ISO,
  };
}

export function V2PackOffer({
  className,
  compact = false,
  onExpire,
}: {
  className?: string;
  compact?: boolean;
  onExpire?: () => void;
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
          {offer.saleActive ? "24-hour offer" : "What you get"}
        </p>
      )}
      <p className={cn("font-semibold tracking-tight text-[#f6efe4]", compact ? "text-base" : "mt-1 text-lg")}>
        Get 12 secret lives and 2 mini clips for{offer.saleActive ? " only" : ""}{" "}
        {offer.saleActive ? (
          <>
            <s className="font-medium text-[#f6efe4]/45">{offer.compareAtDisplay}</s>{" "}
            <span className="text-[#f3d48a]">{offer.priceDisplay}</span>
          </>
        ) : (
          <span className="text-[#f3d48a]">{offer.priceDisplay}</span>
        )}
      </p>
      {offer.saleActive ? (
        <SaleCountdown expiresAt={offer.expiresAt} onExpire={onExpire} className="mt-2 text-sm" />
      ) : null}
      <p className="mt-1 text-sm text-[#f6efe4]/65">One-time · no subscription · same pet in every portrait and clip</p>
    </div>
  );
}

/** One-line urgency — no extra bordered box. Sticky CTA already repeats the timer. */
export function V2SaleLine({ onExpire }: { onExpire?: () => void }) {
  const offer = v2PackOfferCopy();
  const countdown = useSaleCountdown(offer.expiresAt, onExpire);
  if (!offer.saleActive || !countdown) return null;
  return (
    <p className="mt-3 text-sm font-medium tabular-nums text-[#f3d48a]" role="timer">
      <s className="font-medium text-[#f6efe4]/45">{offer.compareAtDisplay}</s> {offer.priceDisplay} today · {countdown} left
    </p>
  );
}

export function V2StickyCta({
  onClick,
  label,
  onExpire,
}: {
  onClick: () => void;
  label: string;
  onExpire?: () => void;
}) {
  const offer = v2PackOfferCopy();
  const countdown = useSaleCountdown(offer.expiresAt, onExpire);
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
          {offer.saleActive && countdown
            ? `${offer.compareAtDisplay} → ${offer.priceDisplay} today · ${countdown} left`
            : `${offer.priceDisplay} one-time · no card for the free preview`}
        </p>
      </div>
    </div>
  );
}

export function V2ClosingCta({
  onClick,
  onExpire,
}: {
  onClick: () => void;
  onExpire?: () => void;
}) {
  const offer = v2PackOfferCopy();
  const countdown = useSaleCountdown(offer.expiresAt, onExpire);
  return (
    <section className="rounded-[28px] bg-[#d4a84b] px-6 py-9 text-center text-[#1a140e]">
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">See your pet in another life.</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#1a140e]/75">
        Upload one photo for a free preview. Unlock 12 secret lives and 2 mini clips
        {offer.saleActive ? ` for ${offer.priceDisplay} today.` : ` for ${offer.priceDisplay}.`}
      </p>
      {offer.saleActive && countdown ? (
        <p className="mt-3 font-mono text-2xl font-semibold tabular-nums tracking-wide" role="timer">
          {countdown}
        </p>
      ) : null}
      {offer.saleActive ? (
        <p className="mt-0.5 text-xs text-[#1a140e]/60">Until the price goes back to {offer.compareAtDisplay}</p>
      ) : null}
      <Button
        type="button"
        onClick={onClick}
        className="mt-5 h-12 min-h-[48px] w-full rounded-full bg-[#1a140e] px-7 text-base font-semibold text-[#f6efe4] hover:bg-[#2a2018] sm:w-auto"
      >
        Upload your pet photo
      </Button>
    </section>
  );
}
