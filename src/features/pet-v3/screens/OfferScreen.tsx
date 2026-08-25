import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "../../pet/components/FieldError";
import { PET_V3_FUNNEL_CONFIG, v3PackOfferCopy } from "../config";
import { V3PackOffer } from "../V3PackOffer";

export function V3OfferScreen({
  email,
  petName,
  busy,
  error,
  onEmail,
  onPetName,
  onContinue,
}: {
  email: string;
  petName: string;
  busy?: boolean;
  error?: string | null;
  onEmail: (value: string) => void;
  onPetName: (value: string) => void;
  onContinue: () => void;
}) {
  const copy = PET_V3_FUNNEL_CONFIG.copy;
  const offer = v3PackOfferCopy();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-[#f6efe4]">{copy.offerHeadline}</h1>
        <p className="mt-2 text-sm leading-6 text-[#f6efe4]/65">
          {copy.offerSubhead(offer.headline)}
        </p>
      </div>
      <V3PackOffer />
      <ul className="space-y-2 text-sm text-[#f6efe4]/72">
        <li>12 secret lives of the same cat</li>
        <li>2 mini cinematic clips</li>
        <li>Usually ready a few minutes after payment</li>
        <li>If a paid result does not recognizably look like your cat, we remake it</li>
      </ul>
      <div>
        <Label htmlFor="v3-pet-name" className="text-sm font-medium text-[#f6efe4]">
          Cat’s name
        </Label>
        <Input
          id="v3-pet-name"
          value={petName}
          maxLength={40}
          autoComplete="off"
          onChange={(event) => onPetName(event.target.value)}
          placeholder="Luna"
          className="mt-2 h-12 rounded-2xl border-[#f6efe4]/12 bg-[#1a1410] text-[#f6efe4]"
        />
      </div>
      <div>
        <Label htmlFor="v3-email" className="text-sm font-medium text-[#f6efe4]">
          Email for the gallery
        </Label>
        <Input
          id="v3-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => onEmail(event.target.value)}
          placeholder="you@email.com"
          className="mt-2 h-12 rounded-2xl border-[#f6efe4]/12 bg-[#1a1410] text-[#f6efe4]"
        />
      </div>
      <FieldError id="v3-checkout-error" message={error || undefined} />
      <Button
        type="button"
        disabled={busy}
        onClick={onContinue}
        className="h-12 min-h-[48px] w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63] disabled:opacity-40"
      >
        <Lock className="h-4 w-4" />
        {busy ? "Opening secure checkout…" : copy.unlockCta(offer.priceDisplay)}
      </Button>
      <p className="text-center text-xs text-[#f6efe4]/50">
        Secure one-time Stripe checkout. No subscription.
      </p>
    </div>
  );
}
