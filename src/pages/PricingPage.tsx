import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { PricingModal } from "@/components/PricingModal";

/**
 * Dedicated /pricing route — opens the existing credits PricingModal.
 * Keeps one-time Christmas packs out of this recurring/credit purchase UI.
 */
export default function PricingPage() {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(true);
  }, []);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center text-white" data-testid="pricing-page">
      <PageHead
        title="Buy AI credits | The Digital Gifter"
        description="Purchase one-time AI credit packs for the Digital Gifter generator. Not a Christmas pack checkout."
        noindex
      />
      <h1 className="text-3xl font-semibold">AI credits</h1>
      <p className="mt-3 text-sm text-zinc-400">
        One-time credit packs for the generator. Christmas photo packs are a separate checkout and are
        not subscriptions.
      </p>
      <button
        type="button"
        className="mt-6 rounded-full bg-[#ffd976] px-5 py-3 text-sm font-semibold text-zinc-950"
        onClick={() => setOpen(true)}
      >
        View credit packs
      </button>
      <p className="mt-4 text-sm text-zinc-500">
        Looking for Christmas portraits?{" "}
        <Link className="text-amber-200 underline" to="/christmas-ai-photos">
          Open Christmas packs
        </Link>
      </p>
      <PricingModal isOpen={open} onClose={() => setOpen(false)} />
    </div>
  );
}
