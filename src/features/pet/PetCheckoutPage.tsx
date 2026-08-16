import { useMemo, useState } from "react";
import { BadgeCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PET_OFFER, PET_PERSONALITY_OPTIONS, PET_SPECIES_OPTIONS } from "./catalog";
import { PetApiError, startPetCheckout } from "./api";
import { petFunnelApi } from "./supabaseApi";
import { PetShell } from "./components";
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
      setError("Finish the photo, name, and email first.");
      navigation?.goToCreate();
      return;
    }

    if (!photoFile || !draft.photo) {
      setError("Re-attach the original photo before paying.");
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
        setError("Checkout is not connected yet. No payment was taken.");
      } else if (caught instanceof PetApiError && caught.code === "CHECKOUT_CONFLICT") {
        setError("Checkout changed. Refresh and try again. No extra charge was created.");
      } else if (caught instanceof Error) {
        setError(caught.message);
      } else {
        setError("Could not start checkout. No payment was taken.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PetShell
      navigation={navigation}
      showBack
      backLabel="Edit"
      onBack={() => navigation?.goToCreate()}
    >
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#f6efe4]">Pay once</h1>
          <p className="mt-2 text-sm leading-6 text-[#f6efe4]/65">
            {PET_OFFER.priceDisplay} for 12 portraits. No subscription.
          </p>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-[#f6efe4]/10 p-3">
          <div className="h-20 w-16 overflow-hidden rounded-xl bg-[#2a2018]">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={draft.petName ? `${draft.petName} photo` : "Pet photo"}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-[#f6efe4]">{draft.petName || "Unnamed"}</p>
            <p className="truncate text-sm text-[#f6efe4]/60">
              {speciesLabel} · {personalityLabel}
            </p>
            <p className="truncate text-sm text-[#f6efe4]/60">{draft.email}</p>
          </div>
        </div>

        <ul className="space-y-2 text-sm text-[#f6efe4]/75">
          {PET_OFFER.includes.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 shrink-0 text-[#d4a84b]" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>

        <div className="rounded-2xl border border-[#d4a84b]/25 p-5">
          <div className="flex items-center justify-between text-lg font-semibold text-[#f6efe4]">
            <span>Due today</span>
            <span>{PET_OFFER.priceDisplay}</span>
          </div>
          <Button
            type="button"
            disabled={submitting}
            onClick={() => void pay()}
            className="mt-5 h-12 w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63]"
          >
            {submitting ? "Starting checkout…" : `Pay ${PET_OFFER.priceDisplay}`}
          </Button>
          <p className="mt-3 inline-flex items-center gap-2 text-xs text-[#f6efe4]/55">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Secure one-time payment. Nothing renews.
          </p>
          {error ? (
            <p className="mt-3 text-sm text-[#f0b4a0]" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </PetShell>
  );
}
