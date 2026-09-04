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
  const closeRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => closeRef.current?.focus(), 50);
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
        className="absolute inset-0 bg-[#07050a]/75 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-amber-200/20 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        style={{
          background:
            "linear-gradient(165deg, #2a1824 0%, #141c24 48%, #122018 100%)",
          animation: "gt-modal-in 520ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(245,215,110,0.28), transparent 70%)",
          }}
        />
        <div className="relative px-6 pb-6 pt-8 text-center text-rose-50">
          <p className="text-4xl" aria-hidden>
            🎁
          </p>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/80">
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
            ref={closeRef}
            type="button"
            disabled={claiming}
            onClick={onClaim}
            className="mt-7 w-full rounded-xl bg-gradient-to-b from-amber-200 to-amber-300 py-3.5 text-sm font-semibold text-slate-900 shadow-[0_8px_24px_rgba(245,215,110,0.25)] transition hover:from-amber-100 hover:to-amber-200 disabled:opacity-60"
          >
            {claiming ? "Claiming…" : claimLabel}
          </button>

          {showOpenAnother && onOpenAnother ? (
            <button
              type="button"
              onClick={onOpenAnother}
              className="mt-3 w-full rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-medium text-rose-50/90 transition hover:bg-white/10"
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
