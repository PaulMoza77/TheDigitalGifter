import { useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";

const plans = [
  {
    name: "Starter",
    credits: "100 credits",
    price: "€4.98",
    pack: "starter",
    features: [
      "100 credits",
      "All premium templates",
      "High-resolution downloads",
      "Email support",
      "Print-quality output",
    ],
    popular: false,
  },
  {
    name: "Creator",
    credits: "250 credits",
    price: "€9.98",
    pack: "creator",
    features: [
      "250 credits",
      "All premium templates",
      "Priority processing",
      "High-resolution downloads",
      "Priority email support",
      "Commercial use license",
    ],
    popular: true,
  },
  {
    name: "Pro",
    credits: "4000 credits",
    price: "€78.98",
    pack: "pro",
    features: [
      "4000 credits",
      "All premium templates",
      "Fastest delivery",
      "Bulk creation tools",
      "Commercial use license",
      "Dedicated support",
    ],
    popular: false,
  },
  {
    name: "Enterprise",
    credits: "50,000 credits",
    price: "€499.98",
    pack: "enterprise",
    features: [
      "50,000 credits",
      "White-label options",
      "Custom integrations",
      "Priority support 24/7",
      "Bulk creation tools",
      "Dedicated account manager",
    ],
    popular: false,
  },
] as const;

type Pack = (typeof plans)[number]["pack"];

type CheckoutResponse = {
  url?: string;
  checkoutUrl?: string;
  sessionUrl?: string;
  error?: string;
};

function getCheckoutUrl(data: CheckoutResponse | string | null): string | null {
  if (!data) return null;

  if (typeof data === "string") {
    return data.startsWith("http") ? data : null;
  }

  return data.checkoutUrl ?? data.url ?? data.sessionUrl ?? null;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export const PricingCTA = () => {
  const [loadingPack, setLoadingPack] = useState<Pack | null>(null);
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedPlan = plans.find((plan) => plan.pack === selectedPack) ?? null;

  const openEmailModal = async (pack: Pack) => {
    setErrorMessage("");
    setSelectedPack(pack);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.email) {
      setEmail(user.email);
    }
  };

  const closeEmailModal = () => {
    if (loadingPack) return;

    setSelectedPack(null);
    setErrorMessage("");
  };

  const handleCheckout = async () => {
    if (!selectedPack || loadingPack) return;

    const cleanEmail = email.trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setLoadingPack(selectedPack);
    setErrorMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const successUrl = `${window.location.origin}/account/dashboard?checkout=success`;
      const cancelUrl = `${window.location.origin}/?checkout=cancelled`;

      const { data, error } = await supabase.functions.invoke<CheckoutResponse>(
        "create-checkout-session",
        {
          body: {
            pack: selectedPack,
            plan: selectedPack,
            product_type: "credits",
            source: "tdg",
            email: cleanEmail,
            user_id: user?.id ?? null,
            success_url: successUrl,
            cancel_url: cancelUrl,
          },
        }
      );

      if (error) {
        console.error("[PricingCTA] checkout function error:", error);
        setErrorMessage(error.message || "Checkout failed. Please try again.");
        return;
      }

      if (data?.error) {
        console.error("[PricingCTA] checkout response error:", data.error);
        setErrorMessage(data.error);
        return;
      }

      const checkoutUrl = getCheckoutUrl(data);

      if (!checkoutUrl) {
        console.error("[PricingCTA] missing checkout URL:", data);
        setErrorMessage("Checkout error: missing Stripe URL.");
        return;
      }

      window.location.href = checkoutUrl;
    } catch (error) {
      console.error("[PricingCTA] checkout fatal error:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Checkout failed. Please try again."
      );
    } finally {
      setLoadingPack(null);
    }
  };

  return (
    <section className="w-full bg-gradient-to-b from-black via-slate-950/70 to-black px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.div
          className="mx-auto mb-20 max-w-3xl text-center"
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
        >
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-yellow-400/25 bg-yellow-400/10 px-4 py-2 text-sm font-bold text-yellow-200">
            <Sparkles className="h-4 w-4" />
            Simple credit packs
          </div>

          <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            Choose the plan that fits{" "}
            <span className="bg-gradient-to-r from-yellow-300 via-orange-300 to-pink-400 bg-clip-text text-transparent">
              your moments.
            </span>
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/60">
            Buy credits once and use them whenever you want to create something
            personal, beautiful, and meaningful.
          </p>
        </motion.div>

        <div className="mx-auto grid max-w-7xl grid-cols-1 items-stretch gap-8 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan, index) => {
            const isLoading = loadingPack === plan.pack;

            return (
              <motion.div
                key={plan.pack}
                className={`relative flex h-full flex-col rounded-3xl border bg-white/[0.04] p-8 shadow-xl ${
                  plan.popular
                    ? "scale-[1.02] border-yellow-300/45 shadow-yellow-500/10"
                    : "border-white/10"
                }`}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08, duration: 0.45 }}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-gradient-to-r from-yellow-300 via-orange-300 to-pink-400 px-4 py-1 text-sm font-black text-black">
                    <Sparkles className="h-4 w-4" />
                    Most Popular
                  </div>
                )}

                <div className="mb-8 text-center">
                  <h3 className="mb-2 text-2xl font-black text-white">
                    {plan.name}
                  </h3>

                  <div className="mb-4 text-sm text-white/45">
                    {plan.credits}
                  </div>

                  <div className="text-5xl font-black">
                    <span className="bg-gradient-to-r from-yellow-300 via-orange-300 to-pink-400 bg-clip-text text-transparent">
                      {plan.price}
                    </span>
                  </div>
                </div>

                <ul className="mb-8 space-y-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-400" />
                      <span className="text-sm text-white/70">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => void openEmailModal(plan.pack)}
                  disabled={Boolean(loadingPack)}
                  className={`mt-auto w-full rounded-2xl py-4 text-base font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    plan.popular
                      ? "bg-gradient-to-r from-yellow-300 via-orange-300 to-pink-400 text-black shadow-2xl shadow-yellow-500/20 hover:scale-[1.02]"
                      : "bg-white/10 text-white hover:bg-white/15"
                  }`}
                >
                  {isLoading ? "Opening checkout..." : "Get Started"}
                </button>
              </motion.div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-white/40">
          High-resolution downloads included • Credits never expire
        </p>
      </div>

      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
            <button
              type="button"
              onClick={closeEmailModal}
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white/70 transition hover:bg-white/15 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="pr-10">
              <div className="mb-4 inline-flex rounded-full border border-yellow-400/25 bg-yellow-400/10 px-3 py-1 text-xs font-bold text-yellow-200">
                {selectedPlan.name} • {selectedPlan.price}
              </div>

              <h3 className="text-2xl font-black text-white">
                Where should we send your credits?
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/55">
                Enter your email to continue securely to Stripe checkout.
              </p>
            </div>

            <div className="mt-6">
              <label className="mb-2 block text-sm font-bold text-white/80">
                Email address
              </label>

              <input
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setErrorMessage("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleCheckout();
                  }
                }}
                type="email"
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-4 text-white outline-none transition placeholder:text-white/30 focus:border-yellow-300/60"
              />

              {errorMessage && (
                <p className="mt-3 text-sm font-medium text-red-300">
                  {errorMessage}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => void handleCheckout()}
              disabled={Boolean(loadingPack)}
              className="mt-6 w-full rounded-2xl bg-gradient-to-r from-yellow-300 via-orange-300 to-pink-400 py-4 font-black text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingPack ? "Opening checkout..." : "Continue to Stripe"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};