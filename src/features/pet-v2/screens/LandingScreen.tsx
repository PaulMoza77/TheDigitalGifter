import { useState } from "react";
import { BadgeCheck, Lock, ShieldCheck, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePetLocale, usePetT } from "../../pet/i18n";
import { V2ExampleStrip, V2HeroProof } from "../V2ExampleStrip";
import { V2ClosingCta, V2SaleLine, V2StickyCta, v2PackOfferCopy } from "../V2PackOffer";
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
  const locale = usePetLocale();
  const t = usePetT(locale);
  const [offer, setOffer] = useState(() => v2PackOfferCopy());
  const ledeKey =
    species === "cat"
      ? "v2.landing.lede.cat"
      : species === "other"
        ? "v2.landing.lede.other"
        : "v2.landing.lede.dog";
  return (
    <div className="space-y-8">
      <V2HeroProof species={species} />

      <section>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#d4a84b]">
          {t("v2.landing.eyebrow")}
        </p>
        <h1 className="mt-1.5 text-[1.7rem] font-semibold tracking-tight text-[#f6efe4] sm:text-4xl sm:leading-[1.1]">
          {t("v2.landing.h1")}
        </h1>
        <p className="mt-2 max-w-md text-sm leading-6 text-[#f6efe4]/72 sm:text-base sm:leading-7">
          {t(ledeKey)}
        </p>
        <V2SaleLine onExpire={() => setOffer(v2PackOfferCopy())} />
        <Button
          type="button"
          onClick={onUploadClick}
          className="mt-4 h-12 min-h-[48px] w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63] sm:w-auto sm:px-8"
        >
          {t("v2.landing.cta")}
        </Button>
        <p className="mt-2 text-center text-xs text-[#f6efe4]/50 sm:text-left">
          <label htmlFor={fileInputId} className="cursor-pointer underline-offset-4 hover:underline">
            {t("v2.landing.chooseFile")}
          </label>
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[#f6efe4]/68">
          {[
            { icon: BadgeCheck, label: t("v2.landing.bullet.lives") },
            { icon: BadgeCheck, label: t("v2.landing.bullet.clips") },
            { icon: BadgeCheck, label: t("v2.landing.bullet.price", { price: offer.priceDisplay }) },
            { icon: Timer, label: t("v2.landing.bullet.teaser") },
            { icon: Lock, label: t("v2.landing.bullet.noSub") },
            { icon: ShieldCheck, label: t("v2.landing.bullet.private") },
          ].map((item) => (
            <li key={item.label} className="inline-flex items-center gap-1.5">
              <item.icon className="h-4 w-4 text-[#d4a84b]" aria-hidden="true" />
              {item.label}
            </li>
          ))}
        </ul>
      </section>

      <V2ExampleStrip species={species} />
      <V2ClosingCta onClick={onUploadClick} onExpire={() => setOffer(v2PackOfferCopy())} />
      <V2StickyCta
        onClick={onUploadClick}
        label={t("v2.landing.cta")}
        onExpire={() => setOffer(v2PackOfferCopy())}
      />
    </div>
  );
}
