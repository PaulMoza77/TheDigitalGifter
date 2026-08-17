import { useEffect } from "react";
import { BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PET_OTHER_SUBJECTS, PET_SCENES } from "./catalog";
import { ClipGrid, HowItWorks, PetFaq, PetShell, SceneGrid, SceneImage, StickyCta } from "./components";
import { PET_PRODUCT_PROMISE, type PetFunnelNavigation, type PetSpecies } from "./types";
import { trackMetaViewContent } from "@/lib/metaPixel";
import { usePublicPetOffer } from "./usePublicPetOffer";

export type PetLandingPageProps = {
  navigation?: PetFunnelNavigation;
  species?: PetSpecies;
};

export function PetLandingPage({ navigation, species = "dog" }: PetLandingPageProps) {
  const { priceDisplay, amountCents, offerVerified } = usePublicPetOffer();
  useEffect(() => {
    if (!offerVerified || amountCents <= 0) return;
    trackMetaViewContent({
      valueCents: amountCents,
      onceKey: `tdg.meta.viewContent.${species}`,
    });
  }, [species, offerVerified, amountCents]);

  function start() {
    navigation?.goToCreate(species);
  }

  return (
    <PetShell navigation={navigation} species={species} showSpeciesSwitch>
      <div className="space-y-14 pb-24 md:pb-8">
        <section className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-[#f6efe4] sm:text-5xl lg:text-[3.4rem] lg:leading-[1.05]">
              One photo.
              <br />
              Twelve secret lives.
              <br />
              Two cinematic clips.
            </h1>
            <p className="mt-4 max-w-md text-lg leading-7 text-[#f6efe4]/72">
              {PET_PRODUCT_PROMISE} {priceDisplay} once.
            </p>
            <Button
              type="button"
              onClick={start}
              className="mt-6 h-12 rounded-full bg-[#d4a84b] px-7 text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63]"
            >
              Create theirs — {priceDisplay}
            </Button>
            <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[#f6efe4]/68">
              <li className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-[#d4a84b]" aria-hidden="true" />
                12 portraits
              </li>
              <li className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-[#d4a84b]" aria-hidden="true" />
                2 cinematic clips
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
                  species={species}
                  alt={
                    species === "other"
                      ? `${PET_OTHER_SUBJECTS[scene.id]} ${scene.title} example`
                      : `${scene.title} example`
                  }
                  eager={index < 3}
                  className="aspect-[3/4] h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        </section>

        <ClipGrid species={species} />
        <SceneGrid species={species} />
        <HowItWorks />
        <PetFaq />

        <section className="rounded-[28px] bg-[#d4a84b] px-6 py-9 text-center text-[#1a140e]">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready in one photo.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#1a140e]/75">
            Pay once. We make twelve portraits and two cinematic clips of the same pet. A person checks the faces. You download after QC.
          </p>
          <Button
            type="button"
            onClick={start}
            className="mt-5 h-12 rounded-full bg-[#1a140e] px-7 text-base font-semibold text-[#f6efe4] hover:bg-[#2a2018]"
          >
            Create theirs — {priceDisplay}
          </Button>
        </section>
      </div>
      <StickyCta onClick={start} label={`Create theirs — ${priceDisplay}`} />
    </PetShell>
  );
}
