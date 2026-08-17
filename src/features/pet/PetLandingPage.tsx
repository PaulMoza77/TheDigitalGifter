import { useEffect, useMemo, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHead } from "@/components/PageHead";
import { trackMetaViewContent } from "@/lib/metaPixel";
import {
  PET_HERO_PROMISE,
  PET_HERO_SUBTITLE,
  PET_LANDING_COPY,
  PET_SEO,
} from "./catalog";
import {
  ClipGrid,
  HowItWorks,
  NameCapture,
  PetFaq,
  PetShell,
  SamePetGuarantee,
  SceneGrid,
  SocialProof,
  StickyCta,
  SubtypePicker,
  HeroProof,
} from "./components";
import { createSecretLivesCta, landingNameStepCreatesOrder, validateOtherSubtype, validatePetName } from "./croGuards";
import { trackFunnelEvent } from "./funnelAnalytics";
import type { PetFunnelNavigation, PetSpecies } from "./types";
import { usePetDraft } from "./usePetDraft";
import { usePublicPetOffer } from "./usePublicPetOffer";

export type PetLandingPageProps = {
  navigation?: PetFunnelNavigation;
  species?: PetSpecies;
};

export function PetLandingPage({ navigation, species = "dog" }: PetLandingPageProps) {
  const { priceDisplay, amountCents, deliveryEstimate, loading, offerError, offerVerified, refresh } =
    usePublicPetOffer();
  const { draft } = usePetDraft();
  const [subtypeError, setSubtypeError] = useState<string | undefined>();
  const copy = PET_LANDING_COPY[species];
  const seo = PET_SEO[species];
  const nameCheck = validatePetName(draft.petName);
  const stickyVisible = nameCheck.ok && (species !== "other" || validateOtherSubtype({
    species,
    subtype: draft.subtype,
    subtypeDetail: draft.subtypeDetail,
  }).ok);

  useEffect(() => {
    draft.setSpecies(species);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [species]);

  useEffect(() => {
    if (!offerVerified || !amountCents || amountCents <= 0) return;
    trackMetaViewContent({
      valueCents: amountCents,
      onceKey: `tdg.meta.viewContent.${species}`,
    });
  }, [species, offerVerified, amountCents]);

  const priceLabel = loading ? null : priceDisplay;

  function submitName(name: string) {
    if (landingNameStepCreatesOrder()) return;
    const subtypeCheck = validateOtherSubtype({
      species,
      subtype: draft.subtype,
      subtypeDetail: draft.subtypeDetail,
    });
    if (!subtypeCheck.ok) {
      setSubtypeError(subtypeCheck.message);
      return;
    }
    draft.setPetName(name);
    draft.setSpecies(species);
    if (species === "other" && subtypeCheck.subtype) {
      draft.setSubtype(subtypeCheck.subtype, subtypeCheck.subtypeDetail);
      trackFunnelEvent(
        "PetSubtypeSelected",
        { species, subtype: subtypeCheck.subtype },
        { onceKey: `tdg.funnel.PetSubtypeSelected.${species}.${subtypeCheck.subtype}` },
      );
    }
    trackFunnelEvent("PetNameSubmitted", { species }, { onceKey: "tdg.funnel.PetNameSubmitted" });
    navigation?.goToCreate(species);
  }

  const trustItems = useMemo(
    () => [
      "12 portraits",
      "2 cinematic clips",
      "Human checked",
      loading ? null : `${priceDisplay} once`,
      "No subscription",
    ],
    [loading, priceDisplay],
  );

  return (
    <PetShell navigation={navigation} species={species} showSpeciesSwitch>
      <PageHead
        title={seo.title}
        description={seo.description}
        image={seo.ogImage}
        url={`https://www.thedigitalgifter.com${seo.path}`}
        exactTitle
      />
      <div className="space-y-14 pb-28 md:pb-8">
        <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-[#f6efe4] sm:text-5xl lg:text-[3.2rem] lg:leading-[1.08]">
              {PET_HERO_PROMISE}
            </h1>
            <p className="mt-4 max-w-md text-lg leading-7 text-[#f6efe4]/72">{PET_HERO_SUBTITLE}</p>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#f6efe4]/60">{copy.support}</p>
            {species === "other" ? (
              <div className="mt-6">
                <SubtypePicker
                  value={draft.subtype}
                  detail={draft.subtypeDetail}
                  error={subtypeError}
                  onChange={(subtype, detail) => {
                    draft.setSubtype(subtype, detail ?? null);
                    setSubtypeError(undefined);
                  }}
                />
              </div>
            ) : null}
            <NameCapture
              value={draft.petName}
              autoFocus={species !== "other"}
              onNameChange={(name) => draft.setPetName(name)}
              onValidSubmit={submitName}
            />
            <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[#f6efe4]/68">
              {trustItems.map((item) =>
                item ? (
                  <li key={item} className="inline-flex items-center gap-1.5">
                    <BadgeCheck className="h-4 w-4 text-[#d4a84b]" aria-hidden="true" />
                    {item}
                  </li>
                ) : (
                  <li key="price-skeleton" className="inline-flex items-center gap-1.5">
                    <BadgeCheck className="h-4 w-4 text-[#d4a84b]" aria-hidden="true" />
                    <span className="inline-block h-4 w-16 animate-pulse rounded bg-[#f6efe4]/15" aria-label="Loading price" />
                  </li>
                ),
              )}
            </ul>
            <p className="mt-3 text-sm text-[#f6efe4]/55">{deliveryEstimate}</p>
            {offerError ? (
              <p className="mt-2 text-sm text-[#f3d48a]" role="status">
                {offerError}{" "}
                <button type="button" className="underline" onClick={() => void refresh()}>
                  Try again
                </button>
              </p>
            ) : null}
            <div className="mt-6 max-w-md">
              <SamePetGuarantee />
            </div>
          </div>
          <HeroProof species={species} />
        </section>

        <ClipGrid species={species} />
        <SceneGrid species={species} />
        <HowItWorks />
        <SocialProof />
        <PetFaq deliveryEstimate={deliveryEstimate} />

        <section className="rounded-[28px] bg-[#d4a84b] px-6 py-9 text-center text-[#1a140e]">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ready in one photo.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#1a140e]/75">
            Pay once. We make twelve portraits and two cinematic clips of the same pet. A person
            checks the faces. You download after QC. {deliveryEstimate}
          </p>
          <Button
            type="button"
            onClick={() => submitName(draft.petName)}
            className="mt-5 h-12 min-h-[44px] rounded-full bg-[#1a140e] px-7 text-base font-semibold text-[#f6efe4] hover:bg-[#2a2018]"
          >
            {createSecretLivesCta(draft.petName)}
          </Button>
        </section>
      </div>
      <StickyCta
        visible={stickyVisible}
        onClick={() => submitName(nameCheck.ok ? nameCheck.name : draft.petName)}
        label={createSecretLivesCta(draft.petName)}
        supporting={`${priceLabel ?? "$59"} · No subscription`}
      />
    </PetShell>
  );
}
