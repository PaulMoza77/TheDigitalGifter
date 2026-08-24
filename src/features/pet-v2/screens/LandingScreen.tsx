import { useState } from "react";
import { BadgeCheck, Lock, ShieldCheck, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { V2ExampleStrip } from "../V2ExampleStrip";
import { V2ClosingCta, V2PackOffer, V2SaleBanner, V2StickyCta, v2PackOfferCopy } from "../V2PackOffer";
import type { PetV2Species } from "../types";

export function V2LandingScreen({
  species,
  onUploadClick,
  fileInputId,
}: {
  species: PetV2Species;
  onUploadClick: () => void;
  fileInputId: string;
}) {
  const [offer, setOffer] = useState(() => v2PackOfferCopy());
  const pet = species === "cat" ? "your cat" : species === "other" ? "your pet" : "your dog";
  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#d4a84b]">Try it free</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[#f6efe4] sm:text-[2.7rem] sm:leading-[1.1]">
          See your pet in another life.
        </h1>
        <p className="mt-3 max-w-md text-base leading-7 text-[#f6efe4]/72">
          Upload one photo. We’ll create a free personalized preview of {pet} — no card required.
        </p>
        <p className="mt-3 max-w-md text-base font-semibold leading-7 text-[#f3d48a]">
          Then {offer.headline.toLowerCase()}.
        </p>
        <V2SaleBanner onExpire={() => setOffer(v2PackOfferCopy())} />
        <Button
          type="button"
          onClick={onUploadClick}
          className="mt-6 h-12 min-h-[48px] w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63] sm:w-auto sm:px-8"
        >
          Upload your pet photo
        </Button>
        <p className="mt-2 text-center text-xs text-[#f6efe4]/50 sm:text-left">
          <label htmlFor={fileInputId} className="cursor-pointer underline-offset-4 hover:underline">
            Choose a JPEG, PNG, or WebP
          </label>
        </p>
        <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[#f6efe4]/68">
          {[
            { icon: BadgeCheck, label: "12 secret lives" },
            { icon: BadgeCheck, label: "2 mini clips" },
            { icon: BadgeCheck, label: `${offer.priceDisplay} one-time` },
            { icon: Timer, label: "Usually under 30 seconds" },
            { icon: Lock, label: "No subscription" },
            { icon: ShieldCheck, label: "Photo stays private" },
          ].map((item) => (
            <li key={item.label} className="inline-flex items-center gap-1.5">
              <item.icon className="h-4 w-4 text-[#d4a84b]" aria-hidden="true" />
              {item.label}
            </li>
          ))}
        </ul>
        <V2PackOffer className="mt-5" onExpire={() => setOffer(v2PackOfferCopy())} />
      </section>
      <V2ExampleStrip species={species} />
      <V2ClosingCta onClick={onUploadClick} onExpire={() => setOffer(v2PackOfferCopy())} />
      <V2StickyCta
        onClick={onUploadClick}
        label="Upload your pet photo"
        onExpire={() => setOffer(v2PackOfferCopy())}
      />
    </div>
  );
}
