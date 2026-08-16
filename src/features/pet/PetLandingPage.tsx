import { useEffect } from "react";
import { BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PET_OFFER, PET_SCENES } from "./catalog";
import { HowItWorks, PetFaq, PetShell, SceneGrid, SceneImage, StickyCta } from "./components";
import { PET_PRODUCT_PROMISE, type PetFunnelNavigation } from "./types";
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
      <div className="space-y-14 pb-24 md:pb-8">
        <section className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-[#f6efe4] sm:text-5xl lg:text-[3.4rem] lg:leading-[1.05]">
              One photo.
              <br />
              Twelve secret lives.
            </h1>
            <p className="mt-4 max-w-md text-lg leading-7 text-[#f6efe4]/72">
              {PET_PRODUCT_PROMISE} {PET_OFFER.priceDisplay} once.
            </p>
            <Button
              type="button"
              onClick={start}
              className="mt-6 h-12 rounded-full bg-[#d4a84b] px-7 text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63]"
            >
              Create theirs — {PET_OFFER.priceDisplay}
            </Button>
            <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[#f6efe4]/68">
              <li className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-[#d4a84b]" aria-hidden="true" />
                12 portraits
              </li>
              <li className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-[#d4a84b]" aria-hidden="true" />
                Same face
              </li>
              <li className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-[#d4a84b]" aria-hidden="true" />
                No subscription
              </li>
            </ul>
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {PET_SCENES.slice(0, 6).map((scene, index) => (
              <div key={scene.id} className="overflow-hidden rounded-xl sm:rounded-2xl">
                <SceneImage
                  sceneId={scene.id}
                  alt={`${scene.title} example`}
                  eager={index < 3}
                  className="aspect-[3/4] h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        </section>

        <SceneGrid />
        <HowItWorks />
        <PetFaq />

        <section className="rounded-[28px] bg-[#d4a84b] px-6 py-9 text-center text-[#1a140e]">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready in one photo.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#1a140e]/75">
            Pay once. We make twelve portraits of the same pet. A person checks the faces. You download.
          </p>
          <Button
            type="button"
            onClick={start}
            className="mt-5 h-12 rounded-full bg-[#1a140e] px-7 text-base font-semibold text-[#f6efe4] hover:bg-[#2a2018]"
          >
            Create theirs — {PET_OFFER.priceDisplay}
          </Button>
        </section>
      </div>
      <StickyCta onClick={start} label={`Create theirs — ${PET_OFFER.priceDisplay}`} />
    </PetShell>
  );
}
