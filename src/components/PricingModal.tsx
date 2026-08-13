import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Gift,
  X,
  Heart,
  Plus,
  Minus,
} from "lucide-react";

import { useLoggedInUserQuery } from "@/data";
import {
  useCreditsFunnel,
  CreditsFunnelMode,
} from "@/contexts/CreditsFunnelContext";
import { SignInButton } from "./SignInButton";
import { supabase } from "@/lib/supabase";
import {
  isBonusCreditsVisible,
  isCheckoutEnabled,
  productTruth,
} from "@/config/productTruth";

type PackKey = "starter" | "creator" | "pro" | "enterprise";

type Pack = {
  key: PackKey;
  name: string;
  price: number;
  credits: number;
  bonusCredits?: number;
  badge?: string;
  tag: string;
  description: string;
};

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: CreditsFunnelMode | null;
  requiredCredits?: number | null;
  availableCredits?: number | null;
}

type CheckoutResponse = {
  url?: string;
  checkoutUrl?: string;
  sessionUrl?: string;
  error?: string;
};

const PACKS: Pack[] = [
  {
    key: "starter",
    name: "Starter",
    price: 4.98,
    credits: 100,
    bonusCredits: 10,
    tag: "Perfect to try",
    description: "Start creating personal cards, name portraits and memories.",
  },
  {
    key: "creator",
    name: "Creator",
    price: 9.98,
    credits: 250,
    bonusCredits: 50,
    tag: "Creator pack",
    description: "For birthdays, love, apologies and family moments.",
  },
  {
    key: "pro",
    name: "Pro",
    price: 78.98,
    credits: 4000,
    bonusCredits: 600,
    tag: "For power users",
    description: "For creators, agencies and people creating often.",
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: 499.98,
    credits: 50000,
    bonusCredits: 10000,
    tag: "Teams & agencies",
    description: "For high-volume campaigns, teams and business use.",
  },
];

function euro(n: number) {
  return `€${n.toFixed(2)}`;
}

function getDisplayedCredits(pack: Pack) {
  if (isBonusCreditsVisible) {
    return pack.credits + (pack.bonusCredits ?? 0);
  }

  return pack.credits;
}

function getCheckoutUrl(data: CheckoutResponse | string | null): string | null {
  if (!data) return null;

  if (typeof data === "string") {
    return data.startsWith("http") ? data : null;
  }

  return data.checkoutUrl ?? data.url ?? data.sessionUrl ?? null;
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/75">
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
        "group relative w-full overflow-hidden rounded-3xl border p-4 text-left transition " +
        (selected
          ? "border-yellow-300/45 bg-yellow-300/[0.08] shadow-2xl shadow-yellow-500/10"
          : "border-white/10 bg-white/[0.04] hover:border-yellow-300/25 hover:bg-white/[0.06]")
      }
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,230,120,0.16),transparent_38%),radial-gradient(circle_at_100%_100%,rgba(255,83,165,0.12),transparent_34%)]" />
      </div>

      <div className="relative">{children}</div>
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
          <div className="rounded-3xl border border-white/10 bg-black/85 p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-yellow-300/15">
                <Gift className="h-5 w-5 text-yellow-200" />
              </div>

              <div className="flex-1">
                <div className="text-sm font-black text-white">
                  Your next personal gift is one step away.
                </div>

                <div className="mt-1 text-xs leading-5 text-white/60">
                  Come back anytime to unlock credits and create something
                  meaningful.
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
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

function getHeaderContent(
  mode: CreditsFunnelMode | null,
  requiredCredits: number | null,
  availableCredits: number | null
) {
  switch (mode) {
    case "not_logged_in":
      return {
        emoji: "🔐",
        title: "Create your account",
        subtitle:
          "Sign in to save your creations, manage credits and continue securely.",
      };

    case "first_generation":
      return {
        emoji: "🎉",
        title: "Keep creating personal gifts",
        subtitle:
          "Choose a credit pack to continue creating.",
      };

    case "insufficient_credits":
      return {
        emoji: "⚡",
        title: "You need more credits",
        subtitle: `This creation needs ${requiredCredits ?? "?"} credits. You currently have ${availableCredits ?? 0}. Top up to continue.`,
      };

    default:
      return {
        emoji: "🎁",
        title: "Unlock personalized creations",
        subtitle:
          "Create cards, name portraits, apology gifts, birthday surprises, love notes and memories.",
      };
  }
}

export function PricingModal({
  isOpen,
  onClose,
  mode: propMode,
  requiredCredits: propRequired,
  availableCredits: propAvailable,
}: PricingModalProps) {
  const { data: me } = useLoggedInUserQuery();

  const [selected, setSelected] = useState<PackKey>("creator");
  const [bundleCount, setBundleCount] = useState(1);
  const [showToast, setShowToast] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const mode = propMode ?? null;
  const requiredCredits = propRequired ?? null;
  const availableCredits = propAvailable ?? null;

  const { emoji, title, subtitle } = getHeaderContent(
    mode,
    requiredCredits,
    availableCredits
  );

  const selectedPack = useMemo(
    () => PACKS.find((pack) => pack.key === selected) ?? PACKS[1],
    [selected]
  );

  const priceNow = selectedPack.price * bundleCount;
  const totalCredits = getDisplayedCredits(selectedPack) * bundleCount;

  async function doCheckout(pack: PackKey, quantity: number) {
    if (isPaying) return;

    setErrorMessage("");

    if (!isCheckoutEnabled) {
      setErrorMessage(productTruth.copy.checkoutUnavailable);
      return;
    }

    if (!me?.email) {
      setErrorMessage("Please sign in before continuing.");
      return;
    }

    setIsPaying(true);

    try {
      const successUrl = `${window.location.origin}/account/dashboard?checkout=success`;
      const cancelUrl = `${window.location.origin}/?checkout=cancelled`;

      const { data, error } = await supabase.functions.invoke<CheckoutResponse>(
        "create-checkout-session",
        {
          body: {
            pack,
            plan: pack,
            product_type: "credits",
            source: "tdg",
            email: me.email,
            user_id: me.id ?? null,
            quantity,
            success_url: successUrl,
            cancel_url: cancelUrl,
          },
        }
      );

      if (error) {
        console.error("[PricingModal] checkout function error:", error);
        setErrorMessage(error.message || "Checkout failed. Please try again.");
        return;
      }

      if (data?.error) {
        console.error("[PricingModal] checkout response error:", data.error);
        setErrorMessage(data.error);
        return;
      }

      const checkoutUrl = getCheckoutUrl(data);

      if (!checkoutUrl) {
        console.error("[PricingModal] missing checkout URL:", data);
        setErrorMessage("Checkout error: missing Stripe URL.");
        return;
      }

      window.location.href = checkoutUrl;
    } catch (error) {
      console.error("[PricingModal] checkout fatal error:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Checkout failed. Please try again."
      );
    } finally {
      setIsPaying(false);
    }
  }

  const closeModal = () => {
    if (isPaying) return;

    onClose();
    setShowToast(true);
    setErrorMessage("");
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
          <button
            type="button"
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
            onClick={closeModal}
            aria-label="Close pricing modal"
          />

          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="relative max-h-[90vh] w-[min(980px,calc(100%-16px))] overflow-y-auto overflow-x-hidden rounded-[2rem] border border-white/10 bg-[#050711]/95 shadow-2xl backdrop-blur-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Credit packs"
          >
            <div className="pointer-events-none absolute inset-0 opacity-90">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,230,120,0.16),transparent_34%),radial-gradient(circle_at_88%_22%,rgba(255,83,165,0.13),transparent_32%),radial-gradient(circle_at_45%_100%,rgba(56,189,248,0.09),transparent_42%)]" />
            </div>

            <div className="relative p-6 md:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-yellow-300/25 bg-yellow-300/10 px-3 py-1 text-xs font-bold text-yellow-100">
                    Credit packs
                  </div>

                  <h2 className="mt-4 max-w-2xl text-2xl font-black leading-tight tracking-tight text-white md:text-3xl">
                    {emoji} {title}
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
                    {subtitle}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Pill>
                      <Heart className="h-4 w-4" /> Made for {productTruth.brandName}
                    </Pill>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-2xl border border-white/10 bg-white/5 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white/65">
                Credits can be used for personal cards, name portraits, love
                gifts, apology visuals, birthday surprises and more. Packs start
                from <span className="font-bold text-white">€4.98</span>.
              </div>

              {mode === "not_logged_in" || !me?.email ? (
                <div className="mt-6 overflow-hidden rounded-3xl border border-yellow-300/25 bg-yellow-300/[0.08] p-5">
                  <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                    <div className="text-center sm:text-left">
                      <p className="text-lg font-black text-white">
                        Sign in before purchasing credits.
                      </p>

                      <p className="mt-1 text-sm leading-6 text-white/60">
                        Sign in so a purchase can be linked to your account
                        when checkout is available.
                      </p>
                    </div>

                    <SignInButton variant="gradient" />
                  </div>
                </div>
              ) : null}

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {PACKS.map((pack) => {
                  const isSelected = pack.key === selected;
                  const quantity = isSelected ? bundleCount : 1;

                  return (
                    <div key={pack.key} className="relative">
                      {pack.badge ? (
                        <div className="absolute -top-3 left-5 z-10">
                          <span className="inline-flex items-center rounded-full border border-yellow-300/25 bg-gradient-to-r from-yellow-300 to-pink-400 px-3 py-1 text-[11px] font-black text-black shadow-lg">
                            {pack.badge}
                          </span>
                        </div>
                      ) : null}

                      <GlowCard
                        selected={isSelected}
                        onClick={() => setSelected(pack.key)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-sm font-black text-white">
                              {pack.name}
                            </div>

                            <div className="mt-1 text-2xl font-black tracking-tight text-white">
                              {euro(pack.price)}
                            </div>

                            <div className="mt-1 text-sm text-white/70">
                              <span className="font-bold text-white">
                                {pack.credits}
                              </span>{" "}
                              credits
                              {isBonusCreditsVisible && pack.bonusCredits ? (
                                <>
                                  {" "}
                                  <span className="text-white/45">+</span>{" "}
                                  <span className="font-bold text-white">
                                    {pack.bonusCredits}
                                  </span>{" "}
                                  bonus
                                </>
                              ) : null}
                            </div>

                            <div className="mt-2 text-xs font-medium text-white/55">
                              {pack.tag}
                            </div>

                            <p className="mt-3 max-w-sm text-xs leading-5 text-white/50">
                              {pack.description}
                            </p>

                            <div className="mt-4 flex flex-wrap items-center gap-2">
                              <div className="inline-flex items-center overflow-hidden rounded-xl border border-white/10 bg-black/25">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelected(pack.key);
                                    setBundleCount((current) =>
                                      Math.max(1, current - 1)
                                    );
                                  }}
                                  className="grid h-8 w-8 place-items-center text-white/70 transition hover:bg-white/10 hover:text-white"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>

                                <div className="px-3 text-xs font-black text-white/85">
                                  {quantity}
                                </div>

                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelected(pack.key);
                                    setBundleCount((current) =>
                                      Math.min(4, current + 1)
                                    );
                                  }}
                                  className="grid h-8 w-8 place-items-center text-yellow-200 transition hover:bg-yellow-300/10"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
                            <Sparkles className="h-5 w-5 text-yellow-100" />
                          </div>
                        </div>

                        <div className="mt-5">
                          <button
                            type="button"
                            disabled={!isCheckoutEnabled || isPaying || !me?.email}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelected(pack.key);
                              void doCheckout(pack.key, quantity);
                            }}
                            className={
                              "h-11 w-full rounded-2xl bg-gradient-to-r from-yellow-300 via-orange-300 to-pink-400 text-sm font-black text-black transition " +
                              (!isCheckoutEnabled || isPaying || !me?.email
                                ? "cursor-not-allowed opacity-60"
                                : "hover:scale-[1.01] hover:opacity-95")
                            }
                          >
                            {!isCheckoutEnabled
                              ? "Checkout unavailable"
                              : isPaying
                                ? "Opening checkout..."
                                : quantity > 1
                                  ? `Select ${quantity}x`
                                  : "Select pack"}
                          </button>
                        </div>
                      </GlowCard>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-[1fr_400px] md:items-stretch">
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">
                    Credits
                  </div>

                  <div className="mt-2 text-sm font-bold leading-6 text-white">
                    {productTruth.copy.checkoutUnavailable}
                  </div>

                  {errorMessage ? (
                    <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
                      {errorMessage}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-3xl border border-yellow-300/20 bg-yellow-300/[0.07] p-5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">
                      Total
                    </div>

                    <div className="text-lg font-black text-white">
                      {euro(priceNow)}
                    </div>
                  </div>

                  <div className="mt-2 text-sm leading-6 text-white/65">
                    Selected pack:{" "}
                    <span className="font-black text-white">
                      {selectedPack.name}
                    </span>
                    {isBonusCreditsVisible ? (
                      <>
                        {" "}
                        · {totalCredits} credits
                      </>
                    ) : (
                      <>
                        {" "}
                        · {selectedPack.credits} credits
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={!isCheckoutEnabled || isPaying || !me?.email}
                    onClick={() => void doCheckout(selected, bundleCount)}
                    className={
                      "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-yellow-300 via-orange-300 to-pink-400 px-4 py-4 text-sm font-black text-black shadow-2xl shadow-yellow-500/10 transition " +
                      (!isCheckoutEnabled || isPaying || !me?.email
                        ? "cursor-not-allowed opacity-60"
                        : "hover:scale-[1.01] hover:opacity-95")
                    }
                  >
                    {!isCheckoutEnabled
                      ? "Checkout unavailable"
                      : isPaying
                        ? "Opening checkout..."
                        : "Continue"}
                  </button>

                  <div className="mt-3 text-center text-[11px] font-medium text-white/45">
                    {productTruth.copy.checkoutUnavailable}
                  </div>
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