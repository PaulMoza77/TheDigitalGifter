import React from "react";
import { useLoggedInUserQuery, useCheckoutMutation } from "@/data";
import { handleCheckout } from "@/lib/checkoutHandler";
import {
  useCreditsFunnel,
  CreditsFunnelMode,
} from "@/contexts/CreditsFunnelContext";
import { SignInButton } from "./SignInButton";

type Pack = "starter" | "creator" | "pro" | "enterprise";

type Plan = {
  pack: Pack;
  name: string;
  price: string;
  credits: number;
  popular?: boolean;
};

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Optional mode override for direct usage (e.g., from header)
  mode?: CreditsFunnelMode | null;
  requiredCredits?: number | null;
  availableCredits?: number | null;
}

/**
 * Get header content based on funnel mode
 */
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
        emoji: "💳",
        title: "Purchase Credits",
        subtitle: "Choose a credit pack to continue creating amazing cards.",
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
  const buyPack = useCheckoutMutation();

  if (!isOpen) return null;

  // Use prop values if provided, otherwise these are undefined (normal pricing modal)
  const mode = propMode ?? null;
  const requiredCredits = propRequired ?? null;
  const availableCredits = propAvailable ?? null;

  const { emoji, title, subtitle } = getHeaderContent(
    mode,
    requiredCredits,
    availableCredits
  );

  const plans: Plan[] = [
    { pack: "starter", name: "Starter", price: "€4.98", credits: 100 },
    {
      pack: "creator",
      name: "Creator",
      price: "€9.98",
      credits: 250,
      popular: true,
    },
    { pack: "pro", name: "Pro", price: "€78.98", credits: 4000 },
    {
      pack: "enterprise",
      name: "Enterprise",
      price: "€499.98",
      credits: 50000,
    },
  ];

  const handleBuy = (pack: Pack) => {
    void handleCheckout({
      pack,
      user: me ?? null,
      checkoutMutation: buyPack,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-festive-green flex items-center gap-3">
              <span>{emoji}</span>
              {title}
            </h2>
            <p className="text-white/70 max-w-md">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-light-muted hover:text-light text-3xl transition-colors"
          >
            ×
          </button>
        </div>

        {/* Sign In Section for not_logged_in mode - styled like pricing cards */}
        {mode === "not_logged_in" && (
          <div className="mb-8 p-6 rounded-2xl border border-white/10 bg-[#12181d] relative overflow-hidden">
            {/* Gradient accent bar at top */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-festive-gradient" />

            {/* Inline flex layout: text on left, button on right */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <p className="text-white font-semibold text-lg">
                  Connect your account to get started with free bonus credits!
                </p>
                <p className="text-white/50 text-sm mt-1">
                  Or purchase credits after signing in ↓
                </p>
              </div>

              {/* Styled sign-in button with gradient */}
              <SignInButton variant="gradient" />
            </div>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {plans.map((p) => (
            <div
              key={p.pack}
              className="rounded-2xl border border-white/10 bg-[#12181d] p-6 relative"
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs px-3 py-1 rounded-full bg-festive-gradient text-white font-semibold">
                  Most popular
                </span>
              )}
              <h3 className="mt-2 text-lg font-semibold text-light">
                {p.name}
              </h3>
              <div className="mt-1 text-3xl font-bold text-light">
                {p.price}
              </div>
              <div className="text-festive-green font-semibold">
                {p.credits}{" "}
                <span className="text-white/60 font-normal">credits</span>
              </div>
              <button
                type="button"
                className="btn-festive w-full mt-4"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("[PricingModal] click", p.pack);
                  handleBuy(p.pack);
                }}
              >
                Purchase
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Connected modal that uses CreditsFunnelContext for state management.
 * Use this in layouts where you want the funnel to be controlled by context.
 */
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
