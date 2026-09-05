import { useEffect, useId, useRef } from "react";
import type { GiftTreeRewardDef } from "./rewardCatalog";

type Props = {
  reward: GiftTreeRewardDef;
  open: boolean;
  authenticated: boolean;
  claiming: boolean;
  onClaim: () => void;
  onClose: () => void;
  onOpenAnother?: () => void;
  showOpenAnother?: boolean;
  claimHint?: string | null;
};

export function RewardRevealModal({
  reward,
  open,
  authenticated,
  claiming,
  onClaim,
  onClose,
  onOpenAnother,
  showOpenAnother,
  claimHint,
}: Props) {
  const titleId = useId();
  const claimRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => claimRef.current?.focus(), 40);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
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
  }, [open, onClose]);

  if (!open) return null;

  const needsLogin = reward.requiresAuthToGrant && !authenticated;
  const claimLabel = needsLogin ? "Sign in to Claim" : "Claim My Gift";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-label="Close reward"
        className="absolute inset-0 bg-[#07050a]/78 backdrop-blur-[3px]"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-md overflow-hidden rounded-[28px] border border-amber-200/20 shadow-[0_28px_90px_rgba(0,0,0,0.6)]"
        style={{
          background:
            "linear-gradient(165deg, rgba(48,32,28,0.96) 0%, rgba(22,24,30,0.98) 52%, rgba(18,28,24,0.98) 100%)",
          animation: "gt-modal-in 520ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-44"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(232,201,122,0.32), transparent 70%)",
          }}
        />
        <div className="relative px-6 pb-7 pt-9 text-center text-rose-50">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background:
                "linear-gradient(145deg, #8b2430 0%, #5a1820 100%)",
              boxShadow: "0 8px 24px rgba(139,36,48,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
            }}
            aria-hidden
          >
            <span className="font-serif text-2xl text-amber-200">?</span>
          </div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/80">
            You won
          </p>
          <h2 id={titleId} className="mt-2 font-serif text-3xl leading-tight text-amber-50">
            {reward.title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-rose-100/75">{reward.description}</p>
          {claimHint ? (
            <p className="mt-3 text-xs text-amber-100/70" role="status">
              {claimHint}
            </p>
          ) : null}

          <button
            ref={claimRef}
            type="button"
            disabled={claiming}
            onClick={onClaim}
            className="mt-7 w-full rounded-full bg-gradient-to-b from-[#f3e2b5] via-[#e0c078] to-[#c9a35a] py-3.5 text-sm font-semibold text-[#2a1c0e] shadow-[0_10px_30px_rgba(201,163,90,0.3)] transition hover:brightness-105 disabled:opacity-60"
          >
            {claiming ? "Claiming…" : claimLabel}
          </button>

          {showOpenAnother && onOpenAnother ? (
            <button
              type="button"
              onClick={onOpenAnother}
              className="mt-3 w-full rounded-full border border-white/15 bg-white/5 py-3 text-sm font-medium text-rose-50/90 transition hover:bg-white/10"
            >
              Open Another Gift
            </button>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            className="mt-4 text-xs text-rose-100/55 underline-offset-4 hover:underline"
          >
            Keep exploring
          </button>
        </div>
      </div>
      <style>{`
        @keyframes gt-modal-in {
          from { opacity: 0; transform: translateY(18px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="gt-modal-in"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
