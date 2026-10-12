import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { MEMORIES_CREATE_ROUTE, MEMORIES_PLANS, type MemoriesPlanKey } from "../config";

export function MemoriesPlansScreen({
  selectedPlanKey,
  commercialMode,
  chargingEnabled,
  disclosures,
  busy,
  error,
  onSelect,
  onCheckout,
}: {
  selectedPlanKey: MemoriesPlanKey | null;
  commercialMode: string;
  chargingEnabled: boolean;
  disclosures: {
    earlyAccess?: string;
    immediate?: string;
    billing?: string;
    cancellation?: string;
  };
  busy: boolean;
  error?: string | null;
  onSelect: (key: MemoriesPlanKey) => void;
  onCheckout: () => void;
}) {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-5 py-10 sm:px-8">
      <div>
        <Link to={MEMORIES_CREATE_ROUTE} className="text-sm text-[#D4AF7A] hover:underline">
          ← Back to upload
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF7A]">
          Step 2 of 3
        </p>
        <h1 className="memories-display mt-2 text-3xl font-semibold text-[#F7F0E4]">
          Choose your plan
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#F4EDE3]/7">
          {disclosures.earlyAccess || "Early Access — Product in Development"}. Monthly membership
          for a future Memories product. Entitlements are provisional.
        </p>
      </div>

      <div className="rounded-none border border-[#D4AF7A]/35 bg-[#2a221a] p-4 text-sm leading-6 text-[#F4EDE3]/8">
        <p>
          <strong className="text-[#D4AF7A]">Commercial mode:</strong> {commercialMode}
        </p>
        <p className="mt-2">{disclosures.immediate}</p>
        <p className="mt-2">{disclosures.billing}</p>
        <p className="mt-2">{disclosures.cancellation}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {Object.values(MEMORIES_PLANS).map((plan) => {
          const selected = selectedPlanKey === plan.key;
          return (
            <button
              key={plan.key}
              type="button"
              onClick={() => onSelect(plan.key)}
              className={`space-y-3 border p-5 text-left transition ${
                selected
                  ? "border-[#D4AF7A] bg-[#2a221a] ring-2 ring-[#D4AF7A]/40"
                  : "border-[#F4EDE3]/15 hover:border-[#D4AF7A]/45"
              }`}
            >
              {plan.badge ? (
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4AF7A]">
                  {plan.badge}
                  <span className="ml-2 font-normal normal-case tracking-normal text-[#F4EDE3]/45">
                    (recommendation)
                  </span>
                </p>
              ) : (
                <p className="text-xs text-transparent">·</p>
              )}
              <h2 className="memories-display text-2xl font-semibold">{plan.name}</h2>
              <p className="text-lg text-[#D4AF7A]">{plan.priceDisplay}</p>
              <ul className="space-y-1.5 text-sm text-[#F4EDE3]/75">
                {plan.features.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
              <p className="text-xs text-[#F4EDE3]/45">{plan.provisionalNote}</p>
            </button>
          );
        })}
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <button
        type="button"
        disabled={!selectedPlanKey || busy}
        onClick={onCheckout}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D4AF7A] px-7 py-3.5 text-sm font-semibold text-[#1a1510] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {chargingEnabled ? "Continue to secure checkout" : "Join early-access waitlist"}
      </button>
      {!chargingEnabled && (
        <p className="text-xs text-[#F4EDE3]/55">
          Checkout is in non-charging waitlist mode until founder-approved commercial terms and
          Stripe Price IDs are configured.
        </p>
      )}
    </div>
  );
}
