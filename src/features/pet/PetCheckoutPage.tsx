import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHead } from "@/components/PageHead";
import {
  PET_PERSONALITY_OPTIONS,
  PET_SPECIES_OPTIONS,
  PET_SUBTYPE_OPTIONS,
} from "./catalog";
import { PetApiError, startPetCheckout } from "./api";
import { petFunnelApi } from "./supabaseApi";
import { FunnelProgress, PetShell, SamePetGuarantee } from "./components";
import { getPetPhotoFile, getPetPhotoObjectUrl } from "./storage";
import type { PetFunnelApi } from "./api";
import { PET_PRICE_DISPLAY, type PetFunnelNavigation } from "./types";
import { usePetDraft } from "./usePetDraft";
import { usePublicPetOffer } from "./usePublicPetOffer";
import { validatePetDraft } from "./validation";
import { trackMetaInitiateCheckout } from "@/lib/metaPixel";
import { trackFunnelEvent } from "./funnelAnalytics";
import { petPossessive } from "./croGuards";
import { formatOfferPrice, resolveServerOwnedPromo } from "./videoGuards";

export type PetCheckoutPageProps = {
  navigation?: PetFunnelNavigation;
  api?: PetFunnelApi;
};

export function PetCheckoutPage({
  navigation,
  api = petFunnelApi,
}: PetCheckoutPageProps) {
  const { draft } = usePetDraft();
  const { priceDisplay, amountCents, deliveryEstimate, offerVerified, offerError, loading, checkoutAllowed, refresh } =
    usePublicPetOffer();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const appliedPromo = resolveServerOwnedPromo(promoInput);
  const verifiedDisplay =
    offerVerified && amountCents
      ? formatOfferPrice(amountCents)
      : priceDisplay;
  const dueDisplay =
    appliedPromo.ok && appliedPromo.code
      ? formatOfferPrice(appliedPromo.chargedAmountCents)
      : verifiedDisplay;
  const previewUrl = getPetPhotoObjectUrl() ?? draft.photoPreviewDataUrl;
  const photoFile = getPetPhotoFile();

  const speciesLabel = PET_SPECIES_OPTIONS.find((item) => item.id === draft.species)?.label;
  const subtypeLabel =
    draft.species === "other"
      ? draft.subtype === "other"
        ? draft.subtypeDetail
        : PET_SUBTYPE_OPTIONS.find((item) => item.id === draft.subtype)?.label
      : null;
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
        subtype: draft.subtype,
        subtypeDetail: draft.subtypeDetail,
      }),
    [draft.petName, draft.species, draft.personality, draft.email, draft.photo, draft.subtype, draft.subtypeDetail]
  );

  useEffect(() => {
    headingRef.current?.focus();
    trackFunnelEvent(
      "PetOrderReviewViewed",
      { species: draft.species },
      { onceKey: "tdg.funnel.PetOrderReviewViewed" },
    );
  }, [draft.species]);

  async function pay() {
    setError(null);

    if (!checkoutAllowed || !offerVerified || !amountCents) {
      setError(offerError || "The current price could not be verified. Refresh and try again. No payment was taken.");
      return;
    }

    if (!formCheck.ok) {
      setError("Finish the photo, name, and email first.");
      navigation?.goToCreate(draft.species ?? undefined);
      return;
    }

    if (!photoFile || !draft.photo) {
      setError("Re-attach the original photo before paying.");
      navigation?.goToCreate(draft.species ?? undefined);
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
        promoCode: promoInput.trim() || undefined,
        subtype: formCheck.values.subtype,
        subtypeDetail: formCheck.values.subtypeDetail,
      });

      if (result.status === "payment_processing" || result.status === "comped" || !result.checkoutUrl) {
        navigation?.goToOrder(result.publicToken);
        return;
      }

      const goingToStripe =
        result.status === "open" &&
        Boolean(result.sessionId) &&
        result.checkoutUrl.startsWith("https://");
      const serverAmount = result.chargedAmountCents ?? result.amountCents;
      if (goingToStripe && serverAmount && serverAmount > 0) {
        trackMetaInitiateCheckout({
          eventId: result.eventId || `pet_ic_${result.orderId}`,
          valueCents: serverAmount,
          orderId: result.orderId,
        });
      } else if (goingToStripe && offerVerified && amountCents > 0) {
        trackMetaInitiateCheckout({
          eventId: result.eventId || `pet_ic_${result.orderId}`,
          valueCents: amountCents,
          orderId: result.orderId,
        });
      }

      if (result.checkoutUrl.startsWith("preview://")) {
        navigation?.goToOrder(result.publicToken);
        return;
      }

      window.location.assign(result.checkoutUrl);
    } catch (caught) {
      trackFunnelEvent("CheckoutError", { species: draft.species });
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
      species={draft.species ?? "dog"}
      showBack
      backLabel="Edit"
      onBack={() => navigation?.goToCreate(draft.species ?? undefined)}
    >
      <div className="mx-auto max-w-md space-y-6">
        <PageHead
          title="Review your pet order | My Pet’s Secret Life"
          description={`Review your pet photo, portraits, cinematic clips, and one-time ${PET_PRICE_DISPLAY} payment. No subscription.`}
          exactTitle
        />
        <FunnelProgress current={3} />
        <div>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-3xl font-semibold tracking-tight text-[#f6efe4] outline-none"
          >
            Ready to create {petPossessive(draft.petName)} secret lives?
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#f6efe4]/65">
            Review the order, then continue to Stripe. Nothing is generated until payment is confirmed.
          </p>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-[#f6efe4]/10 p-3">
          <div className="h-20 w-16 overflow-hidden rounded-xl bg-[#2a2018]">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={draft.petName ? `${draft.petName} photo` : "Uploaded pet photo"}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-[#f6efe4]">{draft.petName || "Unnamed"}</p>
            <p className="truncate text-sm text-[#f6efe4]/60">
              {speciesLabel}
              {subtypeLabel ? ` · ${subtypeLabel}` : ""}
              {personalityLabel ? ` · ${personalityLabel}` : ""}
            </p>
            <p className="truncate text-sm text-[#f6efe4]/60">{draft.email}</p>
          </div>
        </div>

        <ul className="space-y-2 text-sm text-[#f6efe4]/75">
          <li className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 shrink-0 text-[#d4a84b]" aria-hidden="true" />
            12 personalized portraits
          </li>
          <li className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 shrink-0 text-[#d4a84b]" aria-hidden="true" />
            2 cinematic 5-second clips
          </li>
          <li className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 shrink-0 text-[#d4a84b]" aria-hidden="true" />
            Human quality check
          </li>
          <li className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 shrink-0 text-[#d4a84b]" aria-hidden="true" />
            {deliveryEstimate}
          </li>
        </ul>

        <SamePetGuarantee />

        <div className="rounded-2xl border border-[#d4a84b]/25 p-5">
          <div className="flex items-center justify-between text-lg font-semibold text-[#f6efe4]">
            <span>{verifiedDisplay} USD today</span>
            <span>{dueDisplay}</span>
          </div>
          <p className="mt-1 text-sm text-[#f6efe4]/60">Subscription: None</p>
          {loading ? (
            <p className="mt-2 text-sm text-[#f6efe4]/50">Verifying the current price…</p>
          ) : null}
          {offerError ? (
            <p className="mt-2 text-sm text-[#f3d48a]" role="alert">
              {offerError}{" "}
              <button type="button" className="underline" onClick={() => void refresh()}>
                Try again
              </button>
            </p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <input
              value={promoInput}
              onChange={(event) => {
                setPromoInput(event.target.value);
                setPromoMessage(null);
              }}
              placeholder="Promo code"
              autoCapitalize="characters"
              className="h-11 min-h-[44px] flex-1 rounded-xl border border-[#f6efe4]/15 bg-transparent px-3 text-sm text-[#f6efe4] outline-none placeholder:text-[#f6efe4]/35"
            />
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-[44px] rounded-xl border-[#f6efe4]/20 bg-transparent text-[#f6efe4] hover:bg-[#f6efe4]/8"
              onClick={() => {
                const resolved = resolveServerOwnedPromo(promoInput);
                if (!resolved.ok) {
                  setPromoMessage(resolved.message);
                  return;
                }
                if (!resolved.code) {
                  setPromoMessage("Enter a promo code.");
                  return;
                }
                setPromoMessage(`${resolved.code} applied — 100% off. Due today $0.`);
              }}
            >
              Apply
            </Button>
          </div>
          {promoMessage ? (
            <p className="mt-2 text-sm text-[#d4a84b]" role="status">
              {promoMessage}
            </p>
          ) : null}
          <Button
            type="button"
            disabled={submitting || !checkoutAllowed}
            onClick={() => void pay()}
            className="mt-5 h-12 min-h-[44px] w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63]"
          >
            {submitting
              ? "Starting checkout…"
              : appliedPromo.ok && appliedPromo.code
                ? "Start free order"
                : `Continue to secure checkout — ${dueDisplay.replace(" USD", "")}`}
          </Button>
          <p className="mt-3 inline-flex items-center gap-2 text-xs text-[#f6efe4]/55">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Secure payment by Stripe · No subscription · No automatic renewal
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
