import { useEffect, useId, useRef } from "react";
import { GIFT_TREE_PAID_OFFERS } from "./rewardCatalog";

type Props = {
  open: boolean;
  purchasing: boolean;
  error?: string | null;
  onClose: () => void;
  onPurchase: (packageKey: string) => void;
};

/**
 * Paid “Get more chances” sheet after the free gift is used.
 * Higher-value pack (5 chances) is the primary CTA — never present $4.99 as “1 more”.
 */
export function MoreChancesModal({
  open,
  purchasing,
  error,
  onClose,
  onPurchase,
}: Props) {
  const titleId = useId();
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => primaryRef.current?.focus(), 40);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const five = GIFT_TREE_PAID_OFFERS.find((o) => o.packageKey === "open_five");
  const one = GIFT_TREE_PAID_OFFERS.find((o) => o.packageKey === "open_another");

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-[#07050a]/78 backdrop-blur-[3px]"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-md overflow-hidden rounded-[28px] border border-amber-200/25 shadow-[0_28px_90px_rgba(0,0,0,0.6)]"
        style={{
          background:
            "linear-gradient(165deg, rgba(48,32,28,0.97) 0%, rgba(22,24,30,0.98) 55%, rgba(18,28,24,0.98) 100%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(232,201,122,0.35), transparent 70%)",
          }}
        />
        <div className="relative px-6 pb-7 pt-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/75">
            Best value
          </p>
          <h2 id={titleId} className="mt-2 font-serif text-3xl text-amber-50">
            Get 5 More Chances
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-rose-100/70">
            Your free Christmas gift is already open. Unlock five more presents under
            the tree — rewards apply to your account when you claim them.
          </p>

          <div className="mt-6 space-y-3">
            {five ? (
              <button
                ref={primaryRef}
                type="button"
                disabled={purchasing || !five.purchasable}
                onClick={() => onPurchase(five.packageKey)}
                className="relative flex w-full flex-col items-center rounded-full bg-gradient-to-b from-[#f3e2b5] via-[#e0c078] to-[#c9a35a] px-5 py-3.5 text-[#2a1c0e] shadow-[0_12px_40px_rgba(201,163,90,0.35)] transition enabled:hover:brightness-105 disabled:opacity-60"
              >
                <span className="absolute right-4 top-2 rounded-full bg-[#2a1c0e]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  Best value
                </span>
                <span className="text-[15px] font-semibold tracking-wide">
                  {purchasing ? "Starting checkout…" : five.label}
                </span>
                <span className="text-[11px] font-medium text-[#4a3820]/80">
                  {five.priceCents > 0
                    ? `$${(five.priceCents / 100).toFixed(2)} · 5 extra openings`
                    : five.description}
                </span>
              </button>
            ) : null}

            {one ? (
              <button
                type="button"
                disabled={purchasing || !one.purchasable}
                onClick={() => onPurchase(one.packageKey)}
                className="w-full rounded-full border border-amber-100/25 bg-white/5 px-5 py-3 text-sm font-medium text-amber-50/90 transition hover:bg-white/10 disabled:opacity-60"
              >
                {one.label}
                {one.priceCents > 0 ? ` · $${(one.priceCents / 100).toFixed(2)}` : ""}
              </button>
            ) : null}
          </div>

          {error ? (
            <p className="mt-3 text-sm text-red-200" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            className="mt-5 text-xs text-rose-100/55 underline-offset-4 hover:underline"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
