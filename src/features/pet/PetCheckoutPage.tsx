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
import { FunnelProgress, PetShell, SamePetGuarantee, SalePriceLabel } from "./components";
import { CustomStripeCheckout } from "./components/CustomStripeCheckout";
import { ApplePayButton } from "./components/ApplePayButton";
import { getPetPhotoFile, getPetPhotoObjectUrl } from "./storage";
import type { PetFunnelApi } from "./api";
import { type PetFunnelNavigation } from "./types";
import { usePetDraft } from "./usePetDraft";
import { usePublicPetOffer } from "./usePublicPetOffer";
import { validatePetDraft } from "./validation";
import { validatePetName } from "./croGuards";
import { trackMetaInitiateCheckout } from "@/lib/metaPixel";
import {
  shouldTrackPetBeginCheckout,
  trackFunnelBeginCheckout,
  trackFunnelEvent,
} from "./funnelAnalytics";
import { formatOfferPrice, resolveServerOwnedPromo } from "./videoGuards";
import {
  checkoutPreparingHeadline,
  formatHoldCountdown,
  readCachedEmbeddedCheckout,
  readOrResetCheckoutHold,
  remainingHoldMs,
  writeCachedEmbeddedCheckout,
} from "./checkoutHold";

export type PetCheckoutPageProps = {
  navigation?: PetFunnelNavigation;
  api?: PetFunnelApi;
};

export function PetCheckoutPage({
  navigation,
  api = petFunnelApi,
}: PetCheckoutPageProps) {
  const { draft } = usePetDraft();
  const { priceDisplay, amountCents, compareAtDisplay, deliveryEstimate, offerVerified, offerError, loading, checkoutAllowed, refresh } =
    usePublicPetOffer();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState(() => readOrResetCheckoutHold().expiresAt);
  const [holdLabel, setHoldLabel] = useState(() => formatHoldCountdown(remainingHoldMs(holdExpiresAt)));
  const headingRef = useRef<HTMLHeadingElement>(null);
  const bootstrapped = useRef(false);
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
  const checkoutReady = Boolean(clientSecret && publishableKey);

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
    const nameOk = validatePetName(draft.petName).ok;
    const photoOk = Boolean(draft.photo);
    if (!nameOk || !photoOk) {
      navigation?.goToCreate(draft.species ?? undefined);
      return;
    }
    headingRef.current?.focus();
    trackFunnelEvent(
      "PetOrderReviewViewed",
      { species: draft.species },
      { onceKey: "tdg.funnel.PetOrderReviewViewed" },
    );
  }, [draft.species, draft.petName, draft.photo, navigation]);

  useEffect(() => {
    const tick = () => {
      const remaining = remainingHoldMs(holdExpiresAt);
      if (remaining <= 0) {
        const next = readOrResetCheckoutHold();
        setHoldExpiresAt(next.expiresAt);
        setHoldLabel(formatHoldCountdown(remainingHoldMs(next.expiresAt)));
        setClientSecret(null);
        setPublishableKey(null);
        bootstrapped.current = false;
        return;
      }
      setHoldLabel(formatHoldCountdown(remaining));
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [holdExpiresAt]);

  function trackBeginCheckout(result: {
    status?: string | null;
    sessionId?: string | null;
    checkoutUrl?: string | null;
    clientSecret?: string | null;
    eventId?: string;
    orderId: string;
    chargedAmountCents?: number;
    amountCents?: number;
  }) {
    const goingToStripe = shouldTrackPetBeginCheckout(result);
    const serverAmount = result.chargedAmountCents ?? result.amountCents;
    if (goingToStripe && serverAmount && serverAmount > 0) {
      const eventId = result.eventId || `pet_ic_${result.orderId}`;
      trackMetaInitiateCheckout({
        eventId,
        valueCents: serverAmount,
        orderId: result.orderId,
      });
      trackFunnelBeginCheckout({
        eventId,
        valueCents: serverAmount,
        orderId: result.orderId,
        species: draft.species,
      });
    } else if (goingToStripe && offerVerified && amountCents && amountCents > 0) {
      const eventId = result.eventId || `pet_ic_${result.orderId}`;
      trackMetaInitiateCheckout({
        eventId,
        valueCents: amountCents,
        orderId: result.orderId,
      });
      trackFunnelBeginCheckout({
        eventId,
        valueCents: amountCents,
        orderId: result.orderId,
        species: draft.species,
      });
    }
  }

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

    const cached = readCachedEmbeddedCheckout();
    if (cached?.clientSecret && cached.publishableKey && !appliedPromo.code) {
      setClientSecret(cached.clientSecret);
      setPublishableKey(cached.publishableKey);
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
        uiMode: "custom",
      });

      if (result.status === "payment_processing" || result.status === "comped" || (!result.checkoutUrl && !result.clientSecret)) {
        navigation?.goToOrder(result.publicToken);
        return;
      }

      trackBeginCheckout({
        ...result,
        orderId: result.orderId,
      });

      if (result.checkoutUrl?.startsWith("preview://")) {
        navigation?.goToOrder(result.publicToken);
        return;
      }

      if (result.clientSecret && result.publishableKey) {
        const stripeExpiresAt = result.expiresAt
          ? (result.expiresAt > 10_000_000_000 ? result.expiresAt : result.expiresAt * 1000)
          : holdExpiresAt;
        writeCachedEmbeddedCheckout({
          orderId: result.orderId,
          publicToken: result.publicToken,
          sessionId: result.sessionId,
          clientSecret: result.clientSecret,
          publishableKey: result.publishableKey,
          checkoutUrl: result.checkoutUrl,
          expiresAt: stripeExpiresAt,
          eventId: result.eventId,
          purchaseEventId: result.purchaseEventId,
          amountCents: result.amountCents,
          chargedAmountCents: result.chargedAmountCents,
          status: result.status,
        });
        setClientSecret(result.clientSecret);
        setPublishableKey(result.publishableKey);
        return;
      }

      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
      }
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

  useEffect(() => {
    if (bootstrapped.current) return;
    if (!checkoutAllowed || !formCheck.ok || !photoFile || appliedPromo.code) return;
    bootstrapped.current = true;
    void pay();
    // Bootstrap once when the review page is ready for payment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutAllowed, formCheck.ok, photoFile]);

  return (
    <PetShell
      navigation={navigation}
      species={draft.species ?? "dog"}
      showBack
      backLabel="Edit"
      onBack={() => navigation?.goToCreate(draft.species ?? undefined)}
    >
      <div className="mx-auto w-full max-w-xl space-y-5 sm:max-w-2xl">
        <PageHead
          title="Review your pet order | My Pet’s Secret Life"
          description={`Review your pet photo, portraits, cinematic clips, and one-time ${dueDisplay} payment. No subscription.`}
          exactTitle
        />
        <FunnelProgress current={3} />
        <div>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-[1.45rem] font-semibold leading-tight tracking-tight text-[#f6efe4] outline-none sm:text-3xl"
          >
            {checkoutPreparingHeadline(draft.petName)}
          </h1>
          <p className="mt-1 text-sm leading-6 text-[#f6efe4]/65">
            Pay once on this page. Portraits start after Stripe confirms — no subscription.
          </p>
        </div>

        <article className="overflow-hidden rounded-[28px] bg-[#f7f3ee] text-[#1a140e] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
          <header className="flex items-end justify-between gap-4 bg-[#1a140e] px-5 py-4 sm:px-7">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/70">Today’s total</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-white">
                <SalePriceLabel
                  priceDisplay={dueDisplay}
                  compareAtDisplay={
                    appliedPromo.ok && appliedPromo.code
                      ? null
                      : compareAtDisplay && compareAtDisplay !== dueDisplay
                        ? compareAtDisplay
                        : null
                  }
                />
              </p>
              <p className="mt-1 text-xs text-white/55">One-time · Subscription: None</p>
            </div>
            <p className="hidden pb-1 text-right text-xs text-white/50 sm:block">Payment form ready below</p>
          </header>

          <div className="space-y-4 px-5 py-4 sm:px-7 sm:py-6">
            <div className="rounded-2xl border border-[#1a140e]/10 bg-white px-4 py-3 text-center">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#b45309]">Checkout window</p>
              <p className="mt-0.5 font-semibold tabular-nums text-[2rem] leading-none text-[#1a140e] sm:text-4xl" role="timer">
                {holdLabel}
              </p>
              <p className="mt-1 text-xs text-[#1a140e]/50">30-minute hold · resets when it runs out</p>
            </div>
            <p className="text-center text-xs text-[#1a140e]/45">
              Encrypted Stripe checkout · Instant portraits · No automatic renewal
            </p>

            {loading ? (
              <p className="text-sm text-[#1a140e]/50">Verifying the current price…</p>
            ) : null}
            {offerError ? (
              <p className="text-sm text-[#9a3412]" role="alert">
                {offerError}{" "}
                <button type="button" className="underline" onClick={() => void refresh()}>
                  Try again
                </button>
              </p>
            ) : null}

            {checkoutReady && clientSecret && publishableKey ? (
              <CustomStripeCheckout
                clientSecret={clientSecret}
                publishableKey={publishableKey}
                email={draft.email}
                dueDisplay={dueDisplay}
                returnUrl={`${window.location.origin}/pet/order`}
              />
            ) : (
              <div className="space-y-4">
                <ApplePayButton disabled={submitting || !checkoutAllowed} onClick={() => void pay()} />
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-[#1a140e]/12" />
                  <span className="text-[12px] text-[#1a140e]/45">Or pay with card</span>
                  <span className="h-px flex-1 bg-[#1a140e]/12" />
                </div>
                <Button
                  type="button"
                  disabled={submitting || !checkoutAllowed}
                  onClick={() => void pay()}
                  className="h-14 min-h-[56px] w-full rounded-xl bg-[#1a140e] text-base font-semibold text-white hover:bg-[#2a2018]"
                >
                  {submitting
                    ? "Starting checkout…"
                    : appliedPromo.ok && appliedPromo.code
                      ? "Start free order"
                      : `Pay ${dueDisplay.replace(" USD", "")} — Apple Pay or card`}
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <input
                value={promoInput}
                onChange={(event) => {
                  setPromoInput(event.target.value);
                  setPromoMessage(null);
                }}
                placeholder="Promo code"
                autoCapitalize="characters"
                className="h-11 min-h-[44px] flex-1 rounded-xl border border-[#1a140e]/15 bg-white px-3 text-sm text-[#1a140e] outline-none placeholder:text-[#1a140e]/35"
              />
              <Button
                type="button"
                variant="outline"
                className="h-11 min-h-[44px] rounded-xl border-[#1a140e]/20 bg-white text-[#1a140e] hover:bg-[#1a140e]/5"
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
              <p className="text-sm text-[#7c5a12]" role="status">
                {promoMessage}
              </p>
            ) : null}
            <p className="inline-flex items-center gap-2 text-xs text-[#1a140e]/50">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              Encrypted checkout · Apple Pay & card · Powered by Stripe
            </p>
            {error ? (
              <p className="text-sm text-[#9a3412]" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </article>

        <div className="flex items-center gap-4 rounded-2xl border border-[#f6efe4]/10 p-3">
          <div className="h-16 w-14 overflow-hidden rounded-xl bg-[#2a2018]">
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

        <ul className="grid grid-cols-1 gap-2 text-sm text-[#f6efe4]/75 sm:grid-cols-2">
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
      </div>
    </PetShell>
  );
}
