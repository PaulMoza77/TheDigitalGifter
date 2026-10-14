import { Link } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";
import {
  MEMORIES_CREATE_ROUTE,
  MEMORIES_PLAN_COMPARISON,
  MEMORIES_PLANS,
  MEMORIES_PLANS_FAQ,
  type MemoriesPlanKey,
} from "../config";

function PlanCard({
  planKey,
  selected,
  busy,
  chargingEnabled,
  onSelect,
  onChoose,
}: {
  planKey: MemoriesPlanKey;
  selected: boolean;
  busy: boolean;
  chargingEnabled: boolean;
  onSelect: (key: MemoriesPlanKey) => void;
  onChoose: (key: MemoriesPlanKey) => void;
}) {
  const plan = MEMORIES_PLANS[planKey];
  const isPlus = planKey === "plus";

  return (
    <article
      className={`relative flex h-full flex-col border p-5 sm:p-6 transition ${
        isPlus
          ? "border-[#D4AF7A]/70 bg-[#2a221a]"
          : selected
            ? "border-[#D4AF7A]/55 bg-[#231c16]"
            : "border-[#F4EDE3]/14 bg-[#1f1914]"
      } ${selected ? "ring-2 ring-[#D4AF7A]/35" : ""}`}
    >
      {plan.badge ? (
        <p className="mb-3 inline-flex w-fit rounded-full bg-[#D4AF7A]/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D4AF7A]">
          {plan.badge}
        </p>
      ) : (
        <p className="mb-3 h-[26px]" aria-hidden>
          {" "}
        </p>
      )}

      <button
        type="button"
        onClick={() => onSelect(planKey)}
        className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF7A]/60"
        aria-pressed={selected}
        aria-label={`Select ${plan.displayName}`}
      >
        <h2 className="memories-display text-2xl font-semibold text-[#F7F0E4] sm:text-[1.7rem]">
          {plan.name}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#F4EDE3]/72">{plan.tagline}</p>

        <div className="mt-5 flex items-end gap-1">
          <span className="memories-display text-4xl font-semibold leading-none text-[#D4AF7A] sm:text-[2.75rem]">
            {plan.priceAmount}
          </span>
          <span className="pb-1 text-sm text-[#F4EDE3]/55">{plan.pricePeriod}</span>
        </div>

        <p className="mt-4 text-sm font-semibold text-[#F7F0E4]">
          {plan.monthlyAnimations} photo animations / month
        </p>

        <ul className="mt-5 space-y-3">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm leading-5 text-[#F4EDE3]/78">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF7A]" aria-hidden />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </button>

      <div className="mt-auto pt-6">
        <button
          type="button"
          disabled={busy}
          onClick={() => onChoose(planKey)}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
            isPlus
              ? "bg-[#D4AF7A] text-[#1a1510] hover:bg-[#e0c08a]"
              : selected
                ? "bg-[#D4AF7A] text-[#1a1510] hover:bg-[#e0c08a]"
                : "border border-[#D4AF7A]/45 bg-transparent text-[#F4EDE3] hover:border-[#D4AF7A] hover:bg-[#D4AF7A]/10"
          }`}
        >
          {busy && selected ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {plan.ctaLabel}
        </button>
        <p className="mt-2 text-center text-[11px] leading-4 text-[#F4EDE3]/45">
          {chargingEnabled ? "Continues to secure checkout" : "Saves your preference · no charge today"}
        </p>
      </div>
    </article>
  );
}

export function MemoriesPlansScreen({
  selectedPlanKey,
  chargingEnabled,
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
  onCheckout: (planKey: MemoriesPlanKey) => void;
}) {
  function handleChoose(key: MemoriesPlanKey) {
    onSelect(key);
    onCheckout(key);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-5 py-10 sm:px-8 sm:py-12">
      <div>
        <Link to={MEMORIES_CREATE_ROUTE} className="text-sm text-[#D4AF7A] hover:underline">
          ← Back to upload
        </Link>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF7A]">
          Step 2 of 3
        </p>
        <h1 className="memories-display mt-3 max-w-3xl text-[2rem] font-semibold leading-tight text-[#F7F0E4] sm:text-4xl">
          Choose how you&apos;d like to preserve their memories.
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[#F4EDE3]/75">
          Start with a few precious moments, or create a lasting collection of memories your family
          can revisit.
        </p>
        <div className="mt-6 max-w-3xl border border-[#D4AF7A]/30 bg-[#2a221a]/80 px-4 py-3.5 text-sm leading-6 text-[#F4EDE3]/85">
          <p>
            <strong className="font-semibold text-[#D4AF7A]">Early Access:</strong> Memories is being
            developed. Choose your preferred membership today to join the waitlist. No payment is
            taken yet.
          </p>
        </div>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-3 lg:gap-5">
        {(Object.keys(MEMORIES_PLANS) as MemoriesPlanKey[]).map((key) => (
          <PlanCard
            key={key}
            planKey={key}
            selected={selectedPlanKey === key}
            busy={busy}
            chargingEnabled={chargingEnabled}
            onSelect={onSelect}
            onChoose={handleChoose}
          />
        ))}
      </div>

      {error ? (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      <section aria-labelledby="memories-plan-compare">
        <h2
          id="memories-plan-compare"
          className="memories-display text-2xl font-semibold text-[#F7F0E4] sm:text-3xl"
        >
          What&apos;s the difference?
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-[#F4EDE3]/65">
          A simple look at the proposed membership benefits for when Memories launches.
        </p>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#F4EDE3]/15 text-[#D4AF7A]">
                <th scope="col" className="py-3 pr-4 font-semibold">
                  Feature
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Starter
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Plus
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Legacy
                </th>
              </tr>
            </thead>
            <tbody>
              {MEMORIES_PLAN_COMPARISON.map((row) => (
                <tr key={row.label} className="border-b border-[#F4EDE3]/08">
                  <th scope="row" className="py-3 pr-4 font-medium text-[#F4EDE3]/85">
                    {row.label}
                  </th>
                  <td className="px-3 py-3 text-[#F4EDE3]/7">{row.starter}</td>
                  <td className="px-3 py-3 text-[#F4EDE3]/85">{row.plus}</td>
                  <td className="px-3 py-3 text-[#F4EDE3]/7">{row.legacy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="memories-plan-faq" className="max-w-3xl">
        <h2
          id="memories-plan-faq"
          className="memories-display text-2xl font-semibold text-[#F7F0E4] sm:text-3xl"
        >
          Questions before you choose
        </h2>
        <div className="mt-6 space-y-3">
          {MEMORIES_PLANS_FAQ.map((item) => (
            <details key={item.q} className="border-b border-[#F4EDE3]/12 pb-3">
              <summary className="cursor-pointer list-none py-2 text-left text-base font-semibold text-[#F7F0E4] marker:content-none">
                {item.q}
              </summary>
              <p className="mt-1 text-sm leading-6 text-[#F4EDE3]/7">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
