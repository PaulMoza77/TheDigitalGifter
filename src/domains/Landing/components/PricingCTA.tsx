// src/components/PricingCTA.tsx
import { Check, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useLoggedInUserQuery, useCheckoutMutation } from "@/data";

const plans = [
  {
    name: "Starter",
    credits: "100 credits",
    price: "€4.98",
    pack: "starter" as const,
    features: [
      "100 AI credits",
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
    pack: "creator" as const,
    features: [
      "250 AI credits",
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
    pack: "pro" as const,
    features: [
      "4000 AI credits",
      "All premium templates",
      "Fastest processing",
      "Bulk generation tools",
      "API access",
      "Commercial use license",
      "Dedicated support",
    ],
    popular: false,
  },
  {
    name: "Enterprise",
    credits: "50,000 credits",
    price: "€499.98",
    pack: "enterprise" as const,
    features: [
      "50,000 AI credits",
      "White-label options",
      "Custom integrations",
      "Priority support 24/7",
      "Bulk generation tools",
      "API access",
      "Dedicated account manager",
    ],
    popular: false,
  },
] as const;

type Pack = (typeof plans)[number]["pack"];

// suportă ambele: string URL sau { checkoutUrl: string }
function extractCheckoutUrl(res: unknown): string | null {
  if (typeof res === "string" && res.startsWith("http")) return res;
  if (
    res &&
    typeof res === "object" &&
    "checkoutUrl" in res &&
    typeof (res as any).checkoutUrl === "string"
  ) {
    return (res as any).checkoutUrl;
  }
  if (
    res &&
    typeof res === "object" &&
    "url" in res &&
    typeof (res as any).url === "string"
  ) {
    return (res as any).url;
  }
  return null;
}

export const PricingCTA = () => {
  const { data: me } = useLoggedInUserQuery();
  const checkout = useCheckoutMutation();

  const handlePlanClick = async (pack: Pack) => {
    // dacă nu e logat, du-l la login (schimbă ruta dacă ai altceva)
    if (!me) {
      window.location.href = "/login";
      return;
    }

    try {
      // IMPORTANT: payload-ul cel mai comun este { pack }
      // dacă la tine se cheamă altfel (ex: { packId } / { plan }), spune-mi eroarea exactă
      const res = await (checkout as any).mutateAsync({ pack });

      const url = extractCheckoutUrl(res);
      if (url) {
        window.location.href = url;
        return;
      }

      // fallback dacă backend-ul deschide el sesiunea fără să returneze url
      console.error("Checkout mutation did not return a checkout url:", res);
      alert("Checkout error: missing checkout URL.");
    } catch (err) {
      console.error(err);
      alert("Checkout failed. Check console for details.");
    }
  };

  const pending = Boolean((checkout as any).isPending ?? (checkout as any).isLoading);

  return (
    <section className="w-full py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          className="text-center mb-20 space-y-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-block px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-300 text-sm mb-4">
            Simple Credit-Based Pricing
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-white">
            Choose Your{" "}
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              Perfect Plan
            </span>
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Pay only for what you use. Credits never expire.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto items-stretch">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.pack}
              className={`relative flex flex-col h-full bg-slate-900/50 backdrop-blur-sm border rounded-2xl p-8 ${
                plan.popular
                  ? "border-blue-500/50 shadow-2xl shadow-blue-500/20 scale-105"
                  : "border-slate-800"
              }`}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-sm font-semibold flex items-center gap-1">
                  <Sparkles className="w-4 h-4" />
                  Most Popular
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">
                  {plan.name}
                </h3>
                <div className="text-slate-400 text-sm mb-4">{plan.credits}</div>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    {plan.price}
                  </span>
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => void handlePlanClick(plan.pack)}
                disabled={pending}
                className={`mt-auto block w-full rounded-xl py-2 sm:py-3 font-semibold text-lg transition-all disabled:opacity-50 ${
                  plan.popular
                    ? "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg shadow-blue-500/50"
                    : "bg-slate-800 hover:bg-slate-700 text-white"
                }`}
              >
                {pending ? "Processing..." : "Get Started"}
              </button>
            </motion.div>
          ))}
        </div>

        <p className="text-center text-sm text-slate-500 mt-8">
          All plans include high-resolution downloads • Credits never expire • Cancel anytime
        </p>
      </div>
    </section>
  );
};
