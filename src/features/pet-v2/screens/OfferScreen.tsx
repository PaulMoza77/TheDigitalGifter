import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "../../pet/components/FieldError";
import { SubtypePicker } from "../../pet/components/SubtypePicker";
import { V2PackOffer, v2PackOfferCopy } from "../V2PackOffer";
import type { PetSubtype } from "../../pet/types";
import type { PetV2Species } from "../types";

export function V2OfferScreen({
  species,
  email,
  petName,
  subtype,
  subtypeDetail,
  busy,
  error,
  onEmail,
  onPetName,
  onSubtype,
  onContinue,
}: {
  species: PetV2Species;
  email: string;
  petName: string;
  subtype: PetSubtype | null;
  subtypeDetail: string | null;
  busy?: boolean;
  error?: string | null;
  onEmail: (value: string) => void;
  onPetName: (value: string) => void;
  onSubtype: (subtype: PetSubtype, detail?: string) => void;
  onContinue: () => void;
}) {
  const [offer, setOffer] = useState(() => v2PackOfferCopy());
  const refreshOffer = () => setOffer(v2PackOfferCopy());
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-[#f6efe4]">Unlock the collection</h1>
        <p className="mt-2 text-sm leading-6 text-[#f6efe4]/65">
          {offer.headline}. One-time. No subscription.
        </p>
      </div>
      <V2PackOffer onExpire={refreshOffer} />
      <ul className="space-y-2 text-sm text-[#f6efe4]/72">
        <li>12 secret lives of the same pet</li>
        <li>2 mini cinematic clips</li>
        <li>Usually ready a few minutes after payment</li>
        <li>If a paid result does not recognizably look like your pet, we remake it</li>
      </ul>
      {species === "other" ? (
        <SubtypePicker
          value={subtype}
          detail={subtypeDetail}
          onChange={onSubtype}
        />
      ) : null}
      <div>
        <Label htmlFor="v2-pet-name" className="text-sm font-medium text-[#f6efe4]">
          Pet’s name
        </Label>
        <Input
          id="v2-pet-name"
          value={petName}
          maxLength={40}
          autoComplete="off"
          onChange={(event) => onPetName(event.target.value)}
          placeholder="Charlie"
          className="mt-2 h-12 rounded-2xl border-[#f6efe4]/12 bg-[#1a1410] text-[#f6efe4]"
        />
      </div>
      <div>
        <Label htmlFor="v2-email" className="text-sm font-medium text-[#f6efe4]">
          Email for the gallery
        </Label>
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
      <FieldError id="v2-checkout-error" message={error || undefined} />
      <Button
        type="button"
        disabled={busy}
        onClick={onContinue}
        className="h-12 min-h-[48px] w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63] disabled:opacity-40"
      >
        <Lock className="h-4 w-4" />
        {busy ? "Opening secure checkout…" : `Get 12 lives + 2 clips for ${offer.priceDisplay}`}
      </Button>
      <p className="text-center text-xs text-[#f6efe4]/50">
        Secure one-time Stripe checkout. No subscription.
      </p>
    </div>
  );
}
