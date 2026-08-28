import { useState } from "react";
import { Button } from "@/components/ui/button";
import { V2PackOffer, v2PackOfferCopy } from "../V2PackOffer";
import type { PetV2Species } from "../types";

export function V2PreviewScreen({
  previewUrl,
  petName,
  species = "dog",
  mode,
  canRegenerate,
  onRegenerate,
  onUnlock,
}: {
  previewUrl: string;
  petName?: string;
  species?: PetV2Species;
  mode: "live" | "mock" | null;
  canRegenerate: boolean;
  onRegenerate: () => void;
  onUnlock: () => void;
}) {
  const [offer, setOffer] = useState(() => v2PackOfferCopy());
  const petLabel = species === "cat" ? "cat" : species === "other" ? "pet" : "dog";
  const headline = petName?.trim()
    ? `${petName.trim()} as an F1 driver`
    : `Your ${petLabel} as an F1 driver`;

  return (
    <div className="space-y-6 pb-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#d4a84b]">Free cinematic preview</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#f6efe4]">{headline}</h1>
        <p className="mt-2 text-sm leading-6 text-[#f6efe4]/68">
          Your {petLabel}’s secret life starts here. Unlock the full collection to see even more incredible
          transformations.
        </p>
      </div>
      <figure className="overflow-hidden rounded-3xl border border-[#d4a84b]/30 bg-[#1a1410]">
        <img src={previewUrl} alt={`Your ${petLabel} as a Formula 1 driver`} className="w-full object-cover" />
      </figure>
      {mode === "mock" ? (
        <p className="rounded-2xl border border-[#d4a84b]/30 bg-[#d4a84b]/10 px-4 py-3 text-sm text-[#f3d48a]">
          Prototype preview: live AI generation is off in this environment, so this is your photo with F1-styled framing.
        </p>
      ) : null}
      <V2PackOffer onExpire={() => setOffer(v2PackOfferCopy())} />
      <ul className="space-y-1.5 text-sm text-[#f6efe4]/68">
        <li>12 secret lives of the same {petLabel}</li>
        <li>2 mini cinematic clips</li>
        <li>One-time {offer.priceDisplay} · no subscription</li>
      </ul>
      <Button
        type="button"
        onClick={onUnlock}
        className="h-12 min-h-[48px] w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63]"
      >
        Get 12 lives + 2 clips for {offer.priceDisplay}
      </Button>
      {canRegenerate ? (
        <button
          type="button"
          onClick={onRegenerate}
          className="block w-full text-center text-sm text-[#f6efe4]/60 underline-offset-4 hover:underline"
        >
          Try one more preview
        </button>
      ) : null}
    </div>
  );
}
