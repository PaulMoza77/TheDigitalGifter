import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Gift,
  Clock,
  ShieldCheck,
  Zap,
  X,
  BadgeCheck,
} from "lucide-react";
import { useLoggedInUserQuery, useCheckoutMutation } from "@/data";
import { handleCheckout } from "@/lib/checkoutHandler";
import {
  useCreditsFunnel,
  CreditsFunnelMode,
} from "@/contexts/CreditsFunnelContext";
import { SignInButton } from "./SignInButton";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type PackKey = "starter" | "creator" | "pro" | "enterprise";

type Pack = {
  key: PackKey;
  name: string;
  price: number;
  credits: number;
  bonusCredits?: number;
  badge?: string;
  tag?: string;
};

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: CreditsFunnelMode | null;
  requiredCredits?: number | null;
  availableCredits?: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PACKS: Pack[] = [
  {
    key: "starter",
    name: "Starter",
    price: 4.98,
    credits: 100,
    bonusCredits: 10,
    tag: "Perfect to try",
  },
  {
    key: "creator",
    name: "Creator",
    price: 9.98,
    credits: 250,
    bonusCredits: 50,
    badge: "Most popular",
    tag: "Best value",
  },
  {
    key: "pro",
    name: "Pro",
    price: 78.98,
    credits: 4000,
    bonusCredits: 600,
    tag: "For power users",
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: 499.98,
    credits: 50000,
    bonusCredits: 10000,
    tag: "Teams & agencies",
  },
];

const SOCIAL_PROOF_MESSAGES = [
  "👨‍👩‍👧‍👦 12,483 families created Christmas memories this week",
  "⭐ Rated 4.9/5 by parents worldwide",
  '❤️ "My kids replayed it 10 times" — Verified Parent',
  "⚡ Instant delivery — no apps, no editing",
];

const RESERVATION_SECONDS = 10 * 60; // 10 minutes

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function euro(n: number) {
  return `€${n.toFixed(2)}`;
}

function getTotalCredits(p: Pack) {
  return p.credits + (p.bonusCredits ?? 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

function useCountdown(seconds: number, isActive: boolean) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (!isActive) return;
    setLeft(seconds);
    const t = setInterval(() => {
      setLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [seconds, isActive]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return { left, label: `${mm}:${ss}` };
}

function useSocialProofTicker(isActive: boolean) {
  const [ticker, setTicker] = useState(SOCIAL_PROOF_MESSAGES[0]);

  useEffect(() => {
    if (!isActive) return;
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % SOCIAL_PROOF_MESSAGES.length;
      setTicker(SOCIAL_PROOF_MESSAGES[i]);
    }, 4200);
    return () => clearInterval(t);
  }, [isActive]);

  return ticker;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
      {children}
    </span>
  );
}

function GlowCard({
  selected,
  children,
  onClick,
}: {
  selected?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "group relative w-full rounded-xl border bg-gradient-to-b p-4 text-left transition " +
        (selected
          ? "border-white/25 from-white/10 to-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
          : "border-white/10 from-white/6 to-white/3 hover:border-white/20")
      }
    >
      <div
        className={
          "pointer-events-none absolute inset-0 rounded-xl opacity-0 blur-2xl transition group-hover:opacity-100 " +
          (selected ? "opacity-100" : "")
        }
        style={{
          background:
            "radial-gradient(60% 60% at 50% 20%, rgba(56,189,248,0.18), rgba(34,197,94,0.10), transparent)",
        }}
      />
      {children}
    </button>
  );
}

function ReminderToast({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          className="fixed bottom-6 left-1/2 z-[80] w-[min(520px,calc(100%-24px))] -translate-x-1/2"
        >
          <div className="rounded-2xl border border-white/10 bg-black/80 p-4 backdrop-blur-xl shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                <Gift className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">
                  Don't miss it — Christmas is closer than you think.
                </div>
                <div className="mt-1 text-xs text-white/70">
                  Your Santa message takes less than 1 minute. Come back anytime
                  to unlock credits.
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-xl p-2 text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Close toast"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Header content based on funnel mode
// ─────────────────────────────────────────────────────────────────────────────

function getHeaderContent(
  mode: CreditsFunnelMode | null,
  requiredCredits: number | null,
  availableCredits: number | null
) {
  switch (mode) {
    case "not_logged_in":
      return {
        emoji: "🔐",
        title: "Create an Account",
        subtitle:
          "Sign in to start generating magical cards and receive free bonus credits!",
      };
    case "first_generation":
      return {
        emoji: "🎉",
        title: "Welcome! Let's Get Started",
        subtitle:
          "You've used your bonus credits. Purchase a pack to continue creating beautiful cards!",
      };
    case "insufficient_credits":
      return {
        emoji: "⚡",
        title: "Need More Credits",
        subtitle: `This template needs ${requiredCredits ?? "?"} credits, but you only have ${availableCredits ?? 0}. Top up to continue!`,
      };
    default:
      return {
        emoji: "🎁",
        title: "Unlock your personalized Christmas magic",
        subtitle:
          "Create unforgettable reactions in minutes. Credits unlock instant Santa messages your family will replay again and again.",
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function PricingModal({
  isOpen,
  onClose,
  mode: propMode,
  requiredCredits: propRequired,
  availableCredits: propAvailable,
}: PricingModalProps) {
  const { data: me } = useLoggedInUserQuery();
  const buyPack = useCheckoutMutation();

  const [selected, setSelected] = useState<PackKey>("creator");
  const [bundleCount, setBundleCount] = useState(1);
  const [showToast, setShowToast] = useState(false);

  // Funnel mode
  const mode = propMode ?? null;
  const requiredCredits = propRequired ?? null;
  const availableCredits = propAvailable ?? null;

  // FOMO: Countdown timer
  const { label: holdLabel, left: holdLeft } = useCountdown(
    RESERVATION_SECONDS,
    isOpen
  );

  // Social proof ticker
  const ticker = useSocialProofTicker(isOpen);

  // Header content
  const { emoji, title, subtitle } = getHeaderContent(
    mode,
    requiredCredits,
    availableCredits
  );

  // Selected pack
  const selPack = useMemo(
    () => PACKS.find((p) => p.key === selected) ?? PACKS[1],
    [selected]
  );

  // Tiered bundle discount: 2 = 10%, 3 = 15%, 4 = 20%
  const getDiscount = (count: number) => {
    if (count >= 4) return 0.2;
    if (count >= 3) return 0.15;
    if (count >= 2) return 0.1;
    return 0;
  };
  const getDiscountLabel = (count: number) => {
    if (count >= 4) return "20% OFF";
    if (count >= 3) return "15% OFF";
    if (count >= 2) return "10% OFF";
    return "offer";
  };
  const bundleDiscount = getDiscount(bundleCount);
  const priceNow = selPack.price * bundleCount * (1 - bundleDiscount);
  const totalCredits = getTotalCredits(selPack) * bundleCount;

  // Checkout handler
  const handleBuy = () => {
    // For bundles, we still process as individual pack checkouts.
    // A production system might have a dedicated bundle endpoint.
    void handleCheckout({
      pack: selected,
      user: me ?? null,
      checkoutMutation: buyPack,
    });
  };

  // Close modal and show reminder toast
  const closeModal = () => {
    onClose();
    setShowToast(true);
  };

  if (!isOpen) {
    return (
      <ReminderToast open={showToast} onClose={() => setShowToast(false)} />
    );
  }

  return (
    <>
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeModal}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="relative w-[min(980px,calc(100%-16px))] max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-3xl border border-white/12 bg-[#0B1020]/90 shadow-2xl backdrop-blur-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Purchase credits"
          >
            {/* Gradient background */}
            <div
              className="absolute inset-0 opacity-70 pointer-events-none"
              style={{
                background:
                  "radial-gradient(700px 420px at 30% 0%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(700px 420px at 85% 30%, rgba(34,197,94,0.14), transparent 58%)",
              }}
            />

            <div className="relative p-6 md:p-7">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  {/* Reservation timer pill */}
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                    <Clock className="h-4 w-4" /> Reserved for {holdLabel}{" "}
                    minutes
                  </div>

                  <h2 className="mt-3 text-xl font-semibold md:text-2xl text-white">
                    {emoji} {title}
                  </h2>
                  <p className="mt-1 text-sm text-white/70 max-w-lg">
                    {subtitle}
                  </p>

                  {/* Trust pills */}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Pill>
                      <BadgeCheck className="h-4 w-4" /> No subscriptions
                    </Pill>
                    <Pill>
                      <Zap className="h-4 w-4" /> Instant delivery
                    </Pill>
                    <Pill>
                      <ShieldCheck className="h-4 w-4" /> Secure checkout
                    </Pill>
                  </div>
                </div>

                {/* Close button */}
                <button
                  onClick={closeModal}
                  className="rounded-2xl border border-white/10 bg-white/5 p-2 text-white/70 hover:bg-white/10 hover:text-white transition"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Price anchor */}
              <div className="mt-3 text-sm text-white/70">
                Average families spend{" "}
                <span className="text-white">€19–€29</span> per personalized
                Christmas gift. Credits start from{" "}
                <span className="text-white">€4.98</span>.
              </div>

              {/* Sign In Section for not_logged_in mode */}
              {mode === "not_logged_in" && (
                <div className="mt-6 p-5 rounded-2xl border border-white/10 bg-white/5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-rose-500 to-emerald-400" />
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-center sm:text-left">
                      <p className="text-white font-semibold text-lg">
                        Connect your account to get started with free bonus
                        credits!
                      </p>
                      <p className="text-white/50 text-sm mt-1">
                        Or purchase credits after signing in ↓
                      </p>
                    </div>
                    <SignInButton variant="gradient" />
                  </div>
                </div>
              )}

              {/* Packs grid */}
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {PACKS.map((p) => {
                  const isSel = p.key === selected;
                  return (
                    <div key={p.key} className="relative">
                      {/* Badge */}
                      {p.badge && (
                        <div className="absolute -top-3 left-5 z-10">
                          <span className="inline-flex items-center rounded-full bg-gradient-to-r from-sky-400/20 to-emerald-300/20 px-3 py-1 text-[11px] font-semibold text-white border border-white/10">
                            {p.badge}
                          </span>
                        </div>
                      )}

                      <GlowCard
                        selected={isSel}
                        onClick={() => setSelected(p.key)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-sm font-semibold text-white">
                              {p.name}
                            </div>
                            <div className="mt-1 text-xl font-semibold tracking-tight text-white">
                              {euro(p.price)}
                            </div>
                            <div className="mt-1 text-sm text-white/70">
                              <span className="text-white">{p.credits}</span>{" "}
                              credits
                              {p.bonusCredits ? (
                                <>
                                  {" "}
                                  <span className="text-white/60">+</span>{" "}
                                  <span className="text-white">
                                    {p.bonusCredits}
                                  </span>{" "}
                                  <span className="text-white/70">bonus</span>
                                </>
                              ) : null}
                            </div>
                            <div className="mt-2 text-xs text-white/60">
                              {p.tag}
                            </div>

                            {/* Bundle controls */}
                            <div className="mt-3 inline-flex items-center gap-2">
                              <div className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 overflow-hidden">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelected(p.key);
                                    setBundleCount((c) => Math.max(1, c - 1));
                                  }}
                                  className="h-7 w-7 grid place-items-center text-sm font-semibold text-white/70 hover:bg-white/10"
                                >
                                  −
                                </button>
                                <div className="px-2 text-[11px] font-medium text-white/80">
                                  {isSel ? bundleCount : 1}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelected(p.key);
                                    setBundleCount((c) => Math.min(4, c + 1));
                                  }}
                                  className="h-7 w-7 grid place-items-center text-sm font-semibold text-emerald-400 hover:bg-emerald-500/10"
                                >
                                  +
                                </button>
                              </div>

                              <div className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/80">
                                🎁 Buy {isSel ? bundleCount : 1} & unlock{" "}
                                {getDiscountLabel(isSel ? bundleCount : 1)}
                              </div>
                            </div>
                          </div>

                          {/* Icon */}
                          <div className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                            <Sparkles className="h-5 w-5 text-white/80" />
                          </div>
                        </div>

                        {/* Purchase button */}
                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Use bundleCount if this pack is already selected, otherwise 1
                              const qty = selected === p.key ? bundleCount : 1;
                              console.log("[PricingModal] Purchase clicked", {
                                pack: p.key,
                                isSelected: selected === p.key,
                                bundleCount,
                                qty,
                              });
                              setSelected(p.key);
                              // Trigger checkout with correct quantity
                              void handleCheckout({
                                pack: p.key,
                                quantity: qty,
                                user: me ?? null,
                                checkoutMutation: buyPack,
                              });
                            }}
                            className="h-10 w-full rounded-xl bg-gradient-to-r from-orange-500 via-rose-500 to-emerald-400 text-sm font-semibold text-white hover:opacity-90 transition"
                          >
                            {isSel && bundleCount > 1
                              ? `Purchase ${bundleCount}x`
                              : "Purchase"}
                          </button>
                        </div>
                      </GlowCard>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                {/* Social proof */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/70">Live social proof</div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {ticker}
                  </div>
                  <div className="mt-2 text-xs text-white/60">
                    ⏳ Credits valid until Dec 24 • ✔ No subscriptions • ⚡
                    Instant delivery
                  </div>
                </div>

                {/* Checkout summary */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 min-w-[280px]">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-white/70">Total</div>
                    <div className="text-sm font-semibold text-white">
                      {euro(priceNow)}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-white/60">
                    You'll get{" "}
                    <span className="text-white">{totalCredits}</span> credits
                    (incl. bonus)
                    {bundleDiscount > 0 ? (
                      <span className="text-white">
                        {" "}
                        • {getDiscountLabel(bundleCount)} applied
                      </span>
                    ) : (
                      <span className="text-white/70">
                        {" "}
                        • Add 1 more pack to unlock 10% OFF
                      </span>
                    )}
                  </div>

                  {/* CTA */}
                  <button
                    onClick={handleBuy}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 via-rose-500 to-emerald-400 px-4 py-3 text-sm font-semibold text-white shadow-2xl shadow-orange-500/10 hover:opacity-95 transition"
                  >
                    🎅 Create my Santa message
                    <span className="text-white/90">→</span>
                  </button>

                  <div className="mt-2 text-center text-[11px] text-white/60">
                    Secure checkout • Instant delivery • One-time payment
                  </div>

                  {/* Urgency warning near zero */}
                  {holdLeft <= 60 && (
                    <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/80">
                      ⚠️ Reservation ends soon. Don't lose your spot.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      <ReminderToast open={showToast} onClose={() => setShowToast(false)} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Connected modal that uses CreditsFunnelContext for state management.
// Use this in layouts where you want the funnel to be controlled by context.
// ─────────────────────────────────────────────────────────────────────────────

export function CreditsFunnelModal() {
  const { isOpen, mode, requiredCredits, availableCredits, closeFunnel } =
    useCreditsFunnel();

  return (
    <PricingModal
      isOpen={isOpen}
      onClose={closeFunnel}
      mode={mode}
      requiredCredits={requiredCredits}
      availableCredits={availableCredits}
    />
  );
}
