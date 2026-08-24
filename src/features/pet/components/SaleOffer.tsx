import { useEffect, useRef, useState } from "react";
import { formatSaleCountdown } from "../flashSale";
import { cn } from "@/lib/utils";

export function useSaleCountdown(expiresAt: string | null | undefined, onExpire?: () => void) {
  const [label, setLabel] = useState(() => {
    if (!expiresAt) return "";
    return formatSaleCountdown(Date.parse(expiresAt) - Date.now());
  });
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  useEffect(() => {
    if (!expiresAt) {
      setLabel("");
      return;
    }
    let expired = false;
    const startedActive = Date.parse(expiresAt) > Date.now();
    const tick = () => {
      const remaining = Date.parse(expiresAt) - Date.now();
      if (remaining <= 0) {
        setLabel("");
        if (startedActive && !expired) {
          expired = true;
          expireRef.current?.();
        }
        return false;
      }
      setLabel(formatSaleCountdown(remaining));
      return true;
    };
    if (!tick()) return;
    const interval = window.setInterval(() => {
      if (!tick()) window.clearInterval(interval);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  return label;
}

export function SalePriceLabel({
  priceDisplay,
  compareAtDisplay,
  className,
  suffix,
}: {
  priceDisplay: string;
  compareAtDisplay?: string | null;
  className?: string;
  suffix?: string;
}) {
  const showCompare = Boolean(compareAtDisplay && compareAtDisplay !== priceDisplay);
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      {showCompare ? (
        <s className="text-[#f6efe4]/45">{compareAtDisplay}</s>
      ) : null}
      <span className="font-semibold tracking-tight text-[#f3d48a]">{priceDisplay}</span>
      {suffix ? <span className="font-normal text-[#f6efe4]/70">{suffix}</span> : null}
    </span>
  );
}

export function SaleCountdown({
  expiresAt,
  onExpire,
  className,
}: {
  expiresAt?: string | null;
  onExpire?: () => void;
  className?: string;
}) {
  const label = useSaleCountdown(expiresAt, onExpire);
  if (!label) return null;
  return (
    <p className={cn("font-medium tabular-nums text-[#f3d48a]", className)} role="timer">
      Ends in {label}
    </p>
  );
}

export function SaleBanner({
  priceDisplay,
  compareAtDisplay,
  saleExpiresAt,
  onExpire,
}: {
  priceDisplay: string;
  compareAtDisplay?: string | null;
  saleExpiresAt?: string | null;
  onExpire?: () => void;
}) {
  const countdown = useSaleCountdown(saleExpiresAt, onExpire);
  if (!countdown) return null;
  return (
    <div className="mt-5 max-w-md rounded-2xl border border-[#d4a84b]/40 bg-[#d4a84b]/12 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d4a84b]">
        24-hour offer
      </p>
      <SalePriceLabel
        priceDisplay={priceDisplay}
        compareAtDisplay={compareAtDisplay}
        suffix="today"
        className="mt-1 text-lg"
      />
      <p
        className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-wide text-[#f3d48a]"
        role="timer"
      >
        {countdown}
      </p>
      <p className="mt-0.5 text-xs text-[#f6efe4]/55">Ends in hours : minutes : seconds</p>
    </div>
  );
}
