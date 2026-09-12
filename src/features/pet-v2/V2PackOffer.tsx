import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SaleCountdown, useSaleCountdown } from "../pet/components/SaleOffer";
import { usePetCurrency, usePetT } from "../pet/i18n";
import type { PetCurrency } from "../pet/i18n/currency";
import { cn } from "@/lib/utils";
import { v2FlashSale } from "./v2FlashSale";

export function v2PackOfferCopy(nowMs = Date.now(), currency: PetCurrency | string = "usd") {
  const sale = v2FlashSale(nowMs, currency);
  return {
    saleActive: sale.saleActive,
    currency: sale.currency,
    headline: `Get 12 secret lives and 2 mini clips for only ${sale.priceDisplay}`,
    priceDisplay: sale.priceDisplay,
    compareAtDisplay: sale.compareAtDisplay,
    amountCents: sale.amountCents,
    expiresAt: sale.expiresAt,
  };
}

function useV2OfferState(onExpire?: () => void) {
  const currency = usePetCurrency();
  const [offer, setOffer] = useState(() => v2PackOfferCopy(Date.now(), currency));

  useEffect(() => {
    setOffer(v2PackOfferCopy(Date.now(), currency));
  }, [currency]);

  const refresh = () => {
    setOffer(v2PackOfferCopy(Date.now(), currency));
    onExpire?.();
  };

  return { offer, refresh, currency };
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
  const t = usePetT();
  const { offer, refresh } = useV2OfferState(onExpire);
  return (
    <div
      className={cn(
        "rounded-2xl border border-[#d4a84b]/40 bg-[#d4a84b]/12 px-4 py-3",
        className,
      )}
    >
      {compact ? null : (
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d4a84b]">
          {t("v2.pack.badge")}
        </p>
      )}
      <p className={cn("font-semibold tracking-tight text-[#f6efe4]", compact ? "text-base" : "mt-1 text-lg")}>
        {t("v2.pack.headlineRich")}{" "}
        <s className="font-medium text-[#f6efe4]/45">{offer.compareAtDisplay}</s>{" "}
        <span className="text-[#f3d48a]">{offer.priceDisplay}</span>
      </p>
      <SaleCountdown expiresAt={offer.expiresAt} onExpire={refresh} className="mt-2 text-sm" />
      <p className="mt-1 text-sm text-[#f6efe4]/65">{t("v2.pack.fine")}</p>
    </div>
  );
}

/** One-line urgency — no extra bordered box. Sticky CTA already repeats the timer. */
export function V2SaleLine({ onExpire }: { onExpire?: () => void }) {
  const t = usePetT();
  const { offer, refresh } = useV2OfferState(onExpire);
  const countdown = useSaleCountdown(offer.expiresAt, () => refresh());
  if (!countdown) return null;
  return (
    <p className="mt-3 text-sm font-medium tabular-nums text-[#f3d48a]" role="timer">
      {t("v2.landing.saleLine", {
        compare: offer.compareAtDisplay,
        price: offer.priceDisplay,
        countdown,
      })}
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
  const t = usePetT();
  const { offer, refresh } = useV2OfferState(onExpire);
  const countdown = useSaleCountdown(offer.expiresAt, () => refresh());
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
          {countdown
            ? t("v2.landing.stickySale", {
                compare: offer.compareAtDisplay,
                price: offer.priceDisplay,
                countdown,
              })
            : t("v2.landing.stickyIdle", { price: offer.priceDisplay })}
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
  const t = usePetT();
  const { offer, refresh } = useV2OfferState(onExpire);
  const countdown = useSaleCountdown(offer.expiresAt, () => refresh());
  return (
    <section className="rounded-[28px] bg-[#d4a84b] px-6 py-9 text-center text-[#1a140e]">
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("v2.landing.closingH2")}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#1a140e]/75">
        {t("v2.landing.closingLede", { price: offer.priceDisplay })}
      </p>
      {countdown ? (
        <p className="mt-3 font-mono text-2xl font-semibold tabular-nums tracking-wide" role="timer">
          {countdown}
        </p>
      ) : null}
      <p className="mt-0.5 text-xs text-[#1a140e]/60">
        {t("v2.landing.closingRenew", {
          compare: offer.compareAtDisplay,
          price: offer.priceDisplay,
        })}
      </p>
      <Button
        type="button"
        onClick={onClick}
        className="mt-5 h-12 min-h-[48px] w-full rounded-full bg-[#1a140e] px-7 text-base font-semibold text-[#f6efe4] hover:bg-[#2a2018] sm:w-auto"
      >
        {t("v2.landing.cta")}
      </Button>
    </section>
  );
}
