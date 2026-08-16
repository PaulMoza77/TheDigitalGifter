import { useMemo, useState } from "react";
import { BadgeCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PET_OFFER, PET_PERSONALITY_OPTIONS, PET_SPECIES_OPTIONS } from "./catalog";
import { PetApiError, startPetCheckout } from "./api";
import { petFunnelApi } from "./supabaseApi";
import {
  OfferStack,
  PetShell,
  PriceBadge,
} from "./components";
import { getPetPhotoFile, getPetPhotoObjectUrl } from "./storage";
import type { PetFunnelApi } from "./api";
import type { PetFunnelNavigation } from "./types";
import { usePetDraft } from "./usePetDraft";
import { validatePetDraft } from "./validation";
import { trackMetaInitiateCheckout } from "@/lib/metaPixel";

export type PetCheckoutPageProps = {
  navigation?: PetFunnelNavigation;
  api?: PetFunnelApi;
};

export function PetCheckoutPage({
  navigation,
  api = petFunnelApi,
}: PetCheckoutPageProps) {
  const { draft } = usePetDraft();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewUrl = getPetPhotoObjectUrl() ?? draft.photoPreviewDataUrl;
  const photoFile = getPetPhotoFile();

  const speciesLabel = PET_SPECIES_OPTIONS.find((item) => item.id === draft.species)?.label;
  const personalityLabel = PET_PERSONALITY_OPTIONS.find(
    (item) => item.id === draft.personality
  )?.label;

  const formCheck = useMemo(
    () =>
      validatePetDraft({
        petName: draft.petName,
        species: draft.species,
        personality: draft.personality,
        email: draft.email,
        photo: draft.photo,
      }),
    [draft.petName, draft.species, draft.personality, draft.email, draft.photo]
  );

  async function pay() {
    setError(null);

    if (!formCheck.ok) {
      setError("Finish the create step before paying. We still need the photo, name, and email.");
      navigation?.goToCreate();
      return;
    }

    if (!photoFile || !draft.photo) {
      setError("Re-attach the original photo before paying. Drafts never store the full file.");
      navigation?.goToCreate();
      return;
    }

    setSubmitting(true);
    try {
      const result = await startPetCheckout({
        api,
        email: formCheck.values.email,
        petName: formCheck.values.petName,
        species: formCheck.values.species,
        personality: formCheck.values.personality,
        photo: formCheck.values.photo,
        file: photoFile,
        successUrl: `${window.location.origin}/pet/order`,
        cancelUrl: `${window.location.origin}/pet/checkout`,
      });

      if (result.status === "payment_processing" || !result.checkoutUrl) {
        navigation?.goToOrder(result.publicToken);
        return;
      }

      if (result.sessionId) {
        trackMetaInitiateCheckout(`pet_ic_${result.orderId}`);
      }

      if (result.checkoutUrl.startsWith("preview://")) {
        navigation?.goToOrder(result.publicToken);
        return;
      }

      window.location.assign(result.checkoutUrl);
    } catch (caught) {
      if (caught instanceof PetApiError && caught.code === "PET_API_NOT_CONNECTED") {
        setError(
          "Checkout is designed and typed, but the backend is not connected yet. No payment was taken."
        );
      } else if (caught instanceof PetApiError && caught.code === "CHECKOUT_CONFLICT") {
        setError(
          "Checkout changed while starting payment. Refresh and try again. No extra charge was created.",
        );
      } else if (caught instanceof Error) {
        setError(caught.message);
      } else {
        setError("Something went wrong starting checkout. No payment was taken.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PetShell
      navigation={navigation}
      showBack
      backLabel="Edit details"
      onBack={() => navigation?.goToCreate()}
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <p className="text-xs uppercase tracking-[0.22em] text-[#d4a84b]">Checkout</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#f6efe4] sm:text-4xl">
            One payment. Twelve lives.
          </h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-[#f6efe4]/72">
            Review the star of the gallery, then pay once for 12 QC-approved portraits. There is no
            trial, no renewal, and no subscription checkbox hiding under the button.
          </p>

          <div className="mt-8 overflow-hidden rounded-3xl border border-[#f6efe4]/10 bg-[#1a1410]">
            <div className="grid gap-0 sm:grid-cols-[180px_minmax(0,1fr)]">
              <div className="aspect-square bg-[#2a2018] sm:aspect-auto">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={draft.petName ? `${draft.petName} photo` : "Pet photo"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full min-h-[180px] place-items-center text-sm text-[#f6efe4]/50">
                    No photo yet
                  </div>
                )}
              </div>
              <div className="space-y-3 p-5">
                <h2 className="text-xl font-semibold text-[#f6efe4]">
                  {draft.petName || "Unnamed legend"}
                </h2>
                <p className="text-sm text-[#f6efe4]/70">
                  {speciesLabel ?? "Species not selected"} · {personalityLabel ?? "Personality not selected"}
                </p>
                <p className="text-sm text-[#f6efe4]/70">{draft.email || "Email still needed"}</p>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 px-0 text-[#d4a84b] hover:bg-transparent"
                  onClick={() => navigation?.goToCreate()}
                >
                  Edit photo and details
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-semibold text-[#f6efe4]">Included in this one-time order</h2>
            <div className="mt-4">
              <OfferStack />
            </div>
          </div>
        </section>

        <aside className="h-fit rounded-3xl border border-[#d4a84b]/25 bg-[#1f1712] p-5 lg:sticky lg:top-6">
          <PriceBadge size="lg" />
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between text-[#f6efe4]">
              <span>My Pet’s Secret Life</span>
              <span>{PET_OFFER.priceDisplay}</span>
            </div>
            <div className="flex items-center justify-between text-[#f6efe4]/65">
              <span>Subscription</span>
              <span>None</span>
            </div>
            <div className="flex items-center justify-between border-t border-[#f6efe4]/10 pt-3 text-base font-semibold text-[#f6efe4]">
              <span>Due today</span>
              <span>{PET_OFFER.priceDisplay}</span>
            </div>
          </div>

          <Button
            type="button"
            disabled={submitting}
            onClick={() => void pay()}
            className="mt-6 h-12 w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63]"
          >
            {submitting ? "Starting secure checkout…" : `Pay ${PET_OFFER.priceDisplay} once`}
          </Button>
          <p className="mt-3 inline-flex items-center gap-2 text-xs text-[#f6efe4]/60">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Stripe checkout opens in a secure one-time $59 payment. No subscription.
          </p>
          <p className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-[#d4a84b]">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
            No subscription. No automatic renewals.
          </p>
          {error ? (
            <p className="mt-4 text-sm text-[#f0b4a0]" role="alert">
              {error}
            </p>
          ) : null}
        </aside>
      </div>
    </PetShell>
  );
}
