import React from "react";

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
  onBuyPack: (pack: Pack) => Promise<void> | void;
}

export function PricingModal({
  isOpen,
  onClose,
  onBuyPack,
}: PricingModalProps) {
  if (!isOpen) return null;

  const plans: Plan[] = [
    { pack: "starter", name: "Starter", price: "€4.98", credits: 25 },
    {
      pack: "creator",
      name: "Creator",
      price: "€9.98",
      credits: 50,
      popular: true,
    },
    { pack: "pro", name: "Pro", price: "€78.98", credits: 500 },
    { pack: "enterprise", name: "Enterprise", price: "€499.98", credits: 5000 },
  ];

  const handleBuy = async (pack: Pack) => {
    await onBuyPack(pack);
    onClose(); // opțional: închide după inițiere
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-festive-green">
            💳 Purchase Credits
          </h2>
          <button
            onClick={onClose}
            className="text-light-muted hover:text-light text-3xl transition-colors"
          >
            ×
          </button>
        </div>

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
                  e.preventDefault(); // oprește refresh-ul
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
