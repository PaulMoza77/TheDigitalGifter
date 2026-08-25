import { useState } from "react";
import { BadgeCheck, Lock, ShieldCheck, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PET_V3_FUNNEL_CONFIG, v3PackOfferCopy } from "../config";
import { V3ClosingCta, V3SaleLine, V3StickyCta } from "../V3PackOffer";
import { V3ExampleStrip, V3HeroProof } from "../V3ExampleStrip";

export function V3LandingScreen({
  onUploadClick,
  fileInputId,
}: {
  onUploadClick: () => void;
  fileInputId: string;
}) {
  const copy = PET_V3_FUNNEL_CONFIG.copy;
  const [offer, setOffer] = useState(() => v3PackOfferCopy());
  const refreshOffer = () => setOffer(v3PackOfferCopy());
  return (
    <div className="space-y-8">
      <V3HeroProof />

      <section>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#d4a84b]">{copy.landingEyebrow}</p>
        <h1 className="mt-1.5 text-[1.7rem] font-semibold tracking-tight text-[#f6efe4] sm:text-4xl sm:leading-[1.1]">
          {copy.landingHeadline}
        </h1>
        <p className="mt-2 max-w-md text-sm leading-6 text-[#f6efe4]/72 sm:text-base sm:leading-7">
          {copy.landingSubhead}
        </p>
        <V3SaleLine onExpire={refreshOffer} />
        <Button
          type="button"
          onClick={onUploadClick}
          className="mt-4 h-12 min-h-[48px] w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63] sm:w-auto sm:px-8"
        >
          {copy.landingCta}
        </Button>
        <p className="mt-2 text-center text-xs text-[#f6efe4]/50 sm:text-left">
          <label htmlFor={fileInputId} className="cursor-pointer underline-offset-4 hover:underline">
            Choose a JPEG, PNG, or WebP
          </label>
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[#f6efe4]/68">
          {[
            { icon: BadgeCheck, label: "12 secret lives" },
            { icon: BadgeCheck, label: "2 mini clips" },
            { icon: BadgeCheck, label: `${offer.compareAtDisplay} → ${offer.priceDisplay} today` },
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
      </section>

      <V3ExampleStrip />
      <V3ClosingCta onClick={onUploadClick} />
      <V3StickyCta onClick={onUploadClick} label={copy.landingCta} onExpire={refreshOffer} />
    </div>
  );
}
