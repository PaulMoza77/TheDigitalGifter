import { useEffect, useId, useRef, useState } from "react";
import { CustomStripeCheckout } from "@/features/pet/components/CustomStripeCheckout";
import { GIFT_TREE_PAID_OFFERS, type GiftTreeRewardDef } from "./rewardCatalog";

export type RewardRevealStep =
  | "reveal"
  | "email"
  | "saved"
  | "upsell"
  | "checkout";

type Props = {
  reward: GiftTreeRewardDef;
  open: boolean;
  step: RewardRevealStep;
  email: string;
  claiming: boolean;
  purchasing: boolean;
  claimHint?: string | null;
  purchaseError?: string | null;
  remainingOpens?: number;
  checkout?: {
    clientSecret: string;
    publishableKey: string;
    amountCents: number;
    currency: string;
    packageKey: string;
  } | null;
  onEmailChange: (value: string) => void;
  onSendGift: () => void;
  onSkipUpsell: () => void;
  onSelectPack: (packageKey: string) => void;
  onCloseCheckout: () => void;
  onClose: () => void;
  onCreateNow?: () => void;
};

export function RewardRevealModal({
  reward,
  open,
  step,
  email,
  claiming,
  purchasing,
  claimHint,
  purchaseError,
  remainingOpens = 0,
  checkout,
  onEmailChange,
  onSendGift,
  onSkipUpsell,
  onSelectPack,
  onCloseCheckout,
  onClose,
  onCreateNow,
}: Props) {
  const titleId = useId();
  const primaryRef = useRef<HTMLButtonElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [selectedPack, setSelectedPack] = useState<string>("open_five");

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      if (step === "email") emailRef.current?.focus();
      else primaryRef.current?.focus();
    }, 40);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (step === "checkout") onCloseCheckout();
        else onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, step, onClose, onCloseCheckout]);

  if (!open) return null;

  const one = GIFT_TREE_PAID_OFFERS.find((o) => o.packageKey === "open_another");
  const five = GIFT_TREE_PAID_OFFERS.find((o) => o.packageKey === "open_five");

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center p-3 sm:items-end sm:pb-8 sm:pt-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-[#07050a]/55 backdrop-blur-[2px]"
        onClick={step === "checkout" ? onCloseCheckout : onClose}
      />
      <div
        className="relative z-10 w-full max-w-md overflow-hidden rounded-[24px] border border-amber-100/15 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        style={{
          background:
            "linear-gradient(165deg, rgba(52,34,30,0.92) 0%, rgba(22,24,30,0.94) 55%, rgba(18,28,24,0.94) 100%)",
          backdropFilter: "blur(16px)",
          animation: "gt-sheet-in 420ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-36"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(232,201,122,0.28), transparent 70%)",
          }}
        />

        <div className="relative px-5 pb-5 pt-7 text-center text-rose-50 sm:px-6">
          {step === "reveal" || step === "email" ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/75">
                🎁 Your Christmas Gift
              </p>
              <h2 id={titleId} className="mt-2 font-serif text-[1.7rem] leading-tight text-amber-50 sm:text-3xl">
                {reward.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-rose-100/75">{reward.description}</p>
            </>
          ) : null}

          {step === "saved" ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/75">
                It&apos;s yours 🎄
              </p>
              <h2 id={titleId} className="mt-2 font-serif text-[1.7rem] leading-tight text-amber-50 sm:text-3xl">
                We&apos;ve sent your gift to {email}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-rose-100/75">
                Your free Christmas gift is already saved. Opening more is optional.
              </p>
            </>
          ) : null}

          {step === "upsell" || step === "checkout" ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/75">
                Want to open another? 🎁
              </p>
              <h2 id={titleId} className="mt-2 font-serif text-[1.7rem] leading-tight text-amber-50 sm:text-3xl">
                Your free gift is already yours
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-rose-100/75">
                Optionally unlock more presents under the tree.
              </p>
            </>
          ) : null}

          {claimHint ? (
            <p className="mt-3 text-xs text-amber-100/70" role="status">
              {claimHint}
            </p>
          ) : null}

          {step === "reveal" ? (
            <button
              ref={primaryRef}
              type="button"
              onClick={onSendGift}
              className="mt-6 w-full rounded-full bg-gradient-to-b from-[#f3e2b5] via-[#e0c078] to-[#c9a35a] py-3.5 text-sm font-semibold text-[#2a1c0e] shadow-[0_10px_30px_rgba(201,163,90,0.28)] transition hover:brightness-105"
            >
              Send my gift 🎁
            </button>
          ) : null}

          {step === "email" ? (
            <form
              className="mt-5 text-left"
              onSubmit={(e) => {
                e.preventDefault();
                onSendGift();
              }}
            >
              <label htmlFor="gt-email" className="block text-sm font-medium text-amber-50/90">
                Where should we send your gift?
              </label>
              <input
                ref={emailRef}
                id="gt-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                placeholder="Email address"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-rose-50 outline-none ring-amber-200/30 placeholder:text-rose-100/35 focus:ring-2"
              />
              <p className="mt-2 text-xs text-rose-100/55">
                We&apos;ll save it here so you don&apos;t lose it.
              </p>
              <button
                ref={primaryRef}
                type="submit"
                disabled={claiming || !email.trim()}
                className="mt-4 w-full rounded-full bg-gradient-to-b from-[#f3e2b5] via-[#e0c078] to-[#c9a35a] py-3.5 text-sm font-semibold text-[#2a1c0e] shadow-[0_10px_30px_rgba(201,163,90,0.28)] transition hover:brightness-105 disabled:opacity-60"
              >
                {claiming ? "Sending…" : "Send my gift 🎁"}
              </button>
            </form>
          ) : null}

          {step === "saved" ? (
            <div className="mt-6 space-y-3">
              {onCreateNow ? (
                <button
                  ref={primaryRef}
                  type="button"
                  onClick={onCreateNow}
                  className="w-full rounded-full bg-gradient-to-b from-[#f3e2b5] via-[#e0c078] to-[#c9a35a] py-3.5 text-sm font-semibold text-[#2a1c0e]"
                >
                  Create now
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onSelectPack("open_five")}
                className="w-full rounded-full border border-white/15 bg-white/5 py-3 text-sm font-medium text-rose-50/90 transition hover:bg-white/10"
              >
                Want to open another?
              </button>
              <button
                type="button"
                onClick={onSkipUpsell}
                className="w-full text-sm text-amber-100/80 underline-offset-4 hover:underline"
              >
                Skip for now
              </button>
            </div>
          ) : null}

          {step === "upsell" || step === "checkout" ? (
            <div className="mt-5 space-y-3">
              {one ? (
                <button
                  type="button"
                  disabled={purchasing}
                  onClick={() => {
                    setSelectedPack(one.packageKey);
                    onSelectPack(one.packageKey);
                  }}
                  className={`flex w-full flex-col items-center rounded-2xl border px-5 py-3.5 transition ${
                    selectedPack === one.packageKey
                      ? "border-amber-200/35 bg-white/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <span className="text-[15px] font-semibold text-amber-50">{one.label}</span>
                  <span className="text-[12px] text-amber-100/70">
                    ${(one.priceCents / 100).toFixed(2)}
                  </span>
                </button>
              ) : null}

              {five ? (
                <button
                  ref={primaryRef}
                  type="button"
                  disabled={purchasing}
                  onClick={() => {
                    setSelectedPack(five.packageKey);
                    onSelectPack(five.packageKey);
                  }}
                  className={`relative flex w-full flex-col items-center rounded-2xl border px-5 py-3.5 transition ${
                    selectedPack === five.packageKey
                      ? "border-amber-200/45 bg-gradient-to-b from-[#f3e2b5]/20 via-white/10 to-white/5"
                      : "border-amber-200/25 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <span className="absolute right-3 top-3 rounded-full bg-amber-200/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100">
                    Best Value
                  </span>
                  <span className="text-[15px] font-semibold text-amber-50">{five.label}</span>
                  <span className="text-[12px] text-amber-100/70">
                    ${(five.priceCents / 100).toFixed(2)}
                  </span>
                </button>
              ) : null}

              {purchaseError ? (
                <p className="text-sm text-red-200" role="alert">
                  {purchaseError}
                </p>
              ) : null}

              {step === "checkout" && checkout ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-left">
                  <CustomStripeCheckout
                    clientSecret={checkout.clientSecret}
                    publishableKey={checkout.publishableKey}
                    dueDisplay={`$${(checkout.amountCents / 100).toFixed(2)}`}
                  />
                </div>
              ) : null}

              {remainingOpens > 0 ? (
                <p className="text-xs text-amber-100/70" role="status">
                  🎁 You have {remainingOpens} gift{remainingOpens === 1 ? "" : "s"} waiting
                </p>
              ) : null}

              <button
                type="button"
                onClick={onSkipUpsell}
                className="w-full py-2 text-sm font-medium text-amber-100/85 underline-offset-4 hover:underline"
              >
                Skip for now
              </button>
            </div>
          ) : null}

          {step !== "upsell" && step !== "checkout" && step !== "saved" ? (
            <button
              type="button"
              onClick={onClose}
              className="mt-4 text-xs text-rose-100/55 underline-offset-4 hover:underline"
            >
              Keep exploring
            </button>
          ) : null}
        </div>
      </div>
      <style>{`
        @keyframes gt-sheet-in {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="gt-sheet-in"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
