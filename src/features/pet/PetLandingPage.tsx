import { useEffect } from "react";
import { BadgeCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PET_OFFER, PET_SCENES } from "./catalog";
import {
  GiftFormats,
  HowItWorks,
  OfferStack,
  PetFaq,
  PetShell,
  PriceBadge,
  SceneGrid,
  StickyCta,
} from "./components";
import { PET_PRODUCT_NAME, PET_PRODUCT_PROMISE, type PetFunnelNavigation } from "./types";
import { trackMetaViewContent } from "@/lib/metaPixel";

export type PetLandingPageProps = {
  navigation?: PetFunnelNavigation;
};

export function PetLandingPage({ navigation }: PetLandingPageProps) {
  useEffect(() => {
    trackMetaViewContent();
  }, []);

  function start() {
    navigation?.goToCreate();
  }

  return (
    <PetShell navigation={navigation}>
      <div className="space-y-16 pb-24 md:pb-10">
        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#d4a84b]/30 bg-[#d4a84b]/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-[#f3d48a]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              A gift with a private joke
            </p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-[#f6efe4] sm:text-5xl lg:text-6xl">
              {PET_PRODUCT_NAME}
            </h1>
            <p className="mt-4 max-w-xl text-xl leading-8 text-[#f3d48a] sm:text-2xl">
              {PET_PRODUCT_PROMISE}
            </p>
            <p className="mt-4 max-w-xl text-base leading-7 text-[#f6efe4]/72">
              Upload one photo. We return a gallery of twelve original portraits — royal, astronaut,
              chef, holiday card, and more — with the same face in every scene. Funny enough to send.
              Beautiful enough to frame.
            </p>
            <div className="mt-6">
              <PriceBadge size="lg" />
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                type="button"
                onClick={start}
                className="h-12 rounded-full bg-[#d4a84b] px-6 text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63]"
              >
                Create their secret lives — {PET_OFFER.priceDisplay}
              </Button>
              <p className="text-sm text-[#f6efe4]/65">
                One-time payment. {PET_OFFER.subscriptionCopy}.
              </p>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#f6efe4]/70">
              <li className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-[#d4a84b]" aria-hidden="true" />
                12 portraits
              </li>
              <li className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-[#d4a84b]" aria-hidden="true" />
                Human quality control
              </li>
              <li className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-[#d4a84b]" aria-hidden="true" />
                12 QC-approved portraits
              </li>
            </ul>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {PET_SCENES.slice(0, 6).map((scene) => (
              <div
                key={scene.id}
                className="aspect-[3/4] overflow-hidden rounded-2xl border border-[#f6efe4]/10"
                style={{
                  background: `linear-gradient(160deg, ${scene.art.from}, ${scene.art.to})`,
                }}
              >
                <div className="flex h-full flex-col justify-end p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/70">
                    {String(scene.number).padStart(2, "0")}
                  </p>
                  <p className="text-sm font-medium text-white">{scene.title}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <SceneGrid />
        <section className="space-y-5">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.22em] text-[#d4a84b]">The offer</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#f6efe4]">
              {PET_OFFER.priceDisplay} once. The whole secret life.
            </h2>
            <p className="mt-3 text-base leading-7 text-[#f6efe4]/72">
              No membership. No surprise renewal. You pay once, we make twelve portraits, a person
              checks that it is still your pet, and you download the 12 QC-approved files.
            </p>
          </div>
          <OfferStack />
        </section>
        <HowItWorks />
        <GiftFormats />
        <PetFaq />
        <section className="rounded-[32px] border border-[#d4a84b]/25 bg-[#d4a84b]/10 px-6 py-10 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-[#f6efe4]">
            Give them a life they did not apply for.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-[#f6efe4]/72">
            One photo is enough. The rest is theatre, oil paint, race day, and a Christmas card that
            finally deserves the fridge.
          </p>
          <Button
            type="button"
            onClick={start}
            className="mt-6 h-12 rounded-full bg-[#d4a84b] px-6 text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63]"
          >
            Start with one photo — {PET_OFFER.priceDisplay}
          </Button>
        </section>
      </div>
      <StickyCta onClick={start} />
    </PetShell>
  );
}
