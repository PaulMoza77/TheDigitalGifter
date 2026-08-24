import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PET_V2_TEST_PRICE_DISPLAY } from "../types";

export function V2OfferScreen({
  email,
  onEmail,
  onContinue,
  submitted,
}: {
  email: string;
  onEmail: (value: string) => void;
  onContinue: () => void;
  submitted: boolean;
}) {
  if (submitted) {
    return (
      <div className="space-y-4 rounded-3xl border border-[#d4a84b]/35 bg-[#d4a84b]/10 px-5 py-8 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#d4a84b]">Prototype handoff</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[#f6efe4]">No card was charged.</h1>
        <p className="text-sm leading-6 text-[#f6efe4]/70">
          This V2 funnel stops before Stripe. Production checkout still lives on /pet/checkout at $27. Wiring a live
          V2 price would need a separate Stripe price, a separate SKU, and an explicit decision — none of that is in
          this prototype.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-[#f6efe4]">Unlock the collection</h1>
        <p className="mt-2 text-sm leading-6 text-[#f6efe4]/65">
          One-time purchase. No subscription. Email is only needed if we send you to Stripe — not to see your preview.
        </p>
      </div>
      <ul className="space-y-2 text-sm text-[#f6efe4]/72">
        <li>What you would receive: 12 portraits + 2 cinematic clips of the same pet (current paid product).</li>
        <li>This screen’s price copy is {PET_V2_TEST_PRICE_DISPLAY} for the test only.</li>
        <li>Delivery: usually a few minutes after a real payment.</li>
        <li>Likeness: if a paid result does not recognizably look like your pet, we remake it — that policy is for paid orders, not this free preview.</li>
      </ul>
      <div>
        <label htmlFor="v2-email" className="text-sm font-medium text-[#f6efe4]">
          Email for checkout
        </label>
        <Input
          id="v2-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => onEmail(event.target.value)}
          placeholder="you@email.com"
          className="mt-2 h-12 rounded-2xl border-[#f6efe4]/12 bg-[#1a1410] text-[#f6efe4]"
        />
      </div>
      <Button
        type="button"
        onClick={onContinue}
        className="h-12 min-h-[48px] w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63]"
      >
        <Lock className="h-4 w-4" />
        Continue to secure Stripe (prototype — no charge)
      </Button>
      <p className="text-center text-xs text-[#f6efe4]/50">
        Prototype test. This button does not open live Stripe and cannot charge a card.
      </p>
    </div>
  );
}
