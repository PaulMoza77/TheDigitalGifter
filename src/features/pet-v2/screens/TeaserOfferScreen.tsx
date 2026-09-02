import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "../../pet/components/FieldError";
import { petFunnelApi } from "../../pet/supabaseApi";
import { V2ElementsCheckout } from "../components/V2ElementsCheckout";
import { V2PackOffer, v2PackOfferCopy } from "../V2PackOffer";
import { trackPetV2Event } from "../analytics";
import {
  type V2EmbeddedCheckoutState,
  validateAndUpdateV2OrderContact,
  v2CheckoutLoadingCopy,
} from "../useV2EmbeddedCheckout";
import { v2PayButtonLabel } from "../v2CheckoutHold";
import { getPetV2SessionId } from "../session";
import {
  PET_V2_PRICE_DISPLAY,
  V2_TEASER_SUPPORT,
  type PetV2Species,
} from "../types";

const V2_APPEARANCE = {
  colorPrimary: "#d4a84b",
  colorBackground: "#1a1410",
  colorText: "#f6efe4",
  colorDanger: "#9a3412",
  borderRadius: "16px",
  fontFamily: "system-ui, sans-serif",
};

function teaserHeadline(species: PetV2Species): string {
  const label = species === "cat" ? "cat" : species === "other" ? "pet" : "dog";
  return `Your ${label}’s secret life is ready to be revealed.`;
}

function speciesPayButtonLabel(species: PetV2Species) {
  const possessive = species === "cat" ? "Cat’s" : species === "other" ? "Pet’s" : "Dog’s";
  return (payLabel: string) => v2PayButtonLabel(payLabel).replace("Dog’s", possessive);
}

export function TeaserOfferScreen({
  teaserUrl,
  species,
  checkout,
  email,
  onEmail,
  petName,
  onPetName,
  providerBlocked,
  onPaymentInteraction,
  onCheckoutReady,
  onCheckoutInitError,
  onExpressCancel,
}: {
  teaserUrl: string;
  species: PetV2Species;
  checkout: V2EmbeddedCheckoutState;
  email?: string;
  onEmail?: (value: string) => void;
  petName?: string;
  onPetName?: (value: string) => void;
  providerBlocked?: string | null;
  onPaymentInteraction?: () => void;
  onCheckoutReady?: () => void;
  onCheckoutInitError?: () => void;
  onExpressCancel?: () => void;
}) {
  const [offer, setOffer] = useState(() => v2PackOfferCopy());
  const checkoutReadyFired = useRef(false);

  useEffect(() => {
    if (!checkout.checkoutReady || !checkout.orderId || !checkout.publicToken) return;
    if (!petName?.trim() && !email?.trim()) return;
    const timer = window.setTimeout(() => {
      void validateAndUpdateV2OrderContact({
        api: petFunnelApi,
        orderId: checkout.orderId!,
        publicToken: checkout.publicToken!,
        petName,
        email,
        species,
        funnelSessionId: getPetV2SessionId(),
      }).catch(() => undefined);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [
    checkout.checkoutReady,
    checkout.orderId,
    checkout.publicToken,
    petName,
    email,
    species,
  ]);

  function markCheckoutReady() {
    if (checkoutReadyFired.current) return;
    checkoutReadyFired.current = true;
    onCheckoutReady?.();
  }

  function handleExpressCancel() {
    trackPetV2Event({ eventName: "v2_checkout_canceled", species });
    onExpressCancel?.();
  }

  const showExpired = checkout.sessionExpired;
  const showHostedFallback = checkout.showHostedFallback && !showExpired;
  const showRetry = Boolean(checkout.initError) && !showExpired && !showHostedFallback && !providerBlocked;
  const showCheckout =
    checkout.checkoutReady &&
    checkout.clientSecret &&
    checkout.publishableKey &&
    checkout.sessionId &&
    checkout.publicToken &&
    !showExpired &&
    !showHostedFallback &&
    !providerBlocked;

  return (
    <div className="space-y-6 overflow-x-hidden pb-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#f6efe4] sm:text-3xl">
          {teaserHeadline(species)}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#f6efe4]/65">{V2_TEASER_SUPPORT}</p>
      </div>

      {providerBlocked ? (
        <div
          className="rounded-2xl border border-[#9a3412]/40 bg-[#9a3412]/10 px-4 py-3 text-sm text-[#f6efe4]/85"
          role="alert"
        >
          {providerBlocked}
        </div>
      ) : null}

      <figure className="overflow-hidden rounded-[28px] border border-[#d4a84b]/30 bg-[#1a1410]">
        <img
          src={teaserUrl}
          alt="Blurred preview of your pet’s secret life"
          className="aspect-[4/5] w-full object-cover"
        />
      </figure>

      <V2PackOffer compact onExpire={() => setOffer(v2PackOfferCopy())} />

      <ul className="space-y-2 text-sm text-[#f6efe4]/72">
        <li>12 secret lives of the same {species === "cat" ? "cat" : species === "other" ? "pet" : "dog"}</li>
        <li>2 mini cinematic clips</li>
        <li>One-time {PET_V2_PRICE_DISPLAY} payment — no subscription</li>
      </ul>

      {onPetName ? (
        <div>
          <Label htmlFor="v2-pet-name" className="text-sm font-medium text-[#f6efe4]">
            Pet’s name <span className="font-normal text-[#f6efe4]/45">(optional)</span>
          </Label>
          <Input
            id="v2-pet-name"
            value={petName ?? ""}
            maxLength={40}
            autoComplete="off"
            onChange={(event) => onPetName(event.target.value)}
            placeholder={species === "cat" ? "Luna" : species === "other" ? "Charlie" : "Buddy"}
            className="mt-2 h-12 rounded-2xl border-[#f6efe4]/12 bg-[#1a1410] text-[#f6efe4]"
          />
        </div>
      ) : null}

      {onEmail ? (
        <div>
          <Label htmlFor="v2-email" className="text-sm font-medium text-[#f6efe4]">
            Email for the gallery <span className="font-normal text-[#f6efe4]/45">(optional)</span>
          </Label>
          <Input
            id="v2-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email ?? ""}
            onChange={(event) => onEmail(event.target.value)}
            placeholder="you@email.com"
            className="mt-2 h-12 rounded-2xl border-[#f6efe4]/12 bg-[#1a1410] text-[#f6efe4]"
          />
        </div>
      ) : null}

      <div
        className="min-h-[180px] overflow-hidden rounded-2xl border border-[#f6efe4]/10 bg-[#1a1410]/60 p-4"
        aria-label="Secure payment"
      >
        {checkout.loading && !checkout.checkoutReady && !showExpired && !showHostedFallback && !providerBlocked ? (
          <p className="py-8 text-center text-sm text-[#f6efe4]/55" role="status">
            {v2CheckoutLoadingCopy(checkout.loadingPhase)}
          </p>
        ) : null}

        {showExpired ? (
          <div className="space-y-3 py-4">
            <p className="text-sm text-[#9a3412]" role="alert">
              {checkout.initError}
            </p>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-full border-[#f6efe4]/20 bg-transparent text-[#f6efe4]"
              onClick={checkout.restartExpiredCheckout}
            >
              Upload your pet photo again
            </Button>
          </div>
        ) : null}

        {showHostedFallback ? (
          <div className="space-y-3 py-4">
            <p className="text-sm text-[#f6efe4]/70">
              Secure card fields could not load in this browser. Continue on Stripe’s hosted checkout.
            </p>
            <Button
              type="button"
              className="h-12 min-h-[48px] w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] disabled:opacity-40"
              onClick={() => void checkout.startHostedFallback()}
              disabled={checkout.hostedFallbackBusy}
            >
              {checkout.hostedFallbackBusy
                ? "Opening secure Stripe checkout…"
                : `Continue to secure Stripe checkout — ${offer.priceDisplay}`}
            </Button>
          </div>
        ) : null}

        {showRetry ? (
          <div className="space-y-3 py-4">
            <FieldError id="v2-checkout-init-error" message={checkout.initError || undefined} />
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-full border-[#f6efe4]/20 bg-transparent text-[#f6efe4]"
              onClick={checkout.retry}
              disabled={checkout.loading}
            >
              Retry secure payment
            </Button>
          </div>
        ) : null}

        {showCheckout ? (
          <V2ElementsCheckout
            clientSecret={checkout.clientSecret!}
            publishableKey={checkout.publishableKey!}
            publicToken={checkout.publicToken!}
            sessionId={checkout.sessionId!}
            email={email?.trim() || undefined}
            dueDisplay={offer.priceDisplay}
            appearanceVariables={V2_APPEARANCE}
            payButtonClassName="h-12 min-h-[48px] w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] disabled:opacity-40"
            payButtonLabel={speciesPayButtonLabel(species)}
            busyLabel="Processing secure payment…"
            loadingLabel="Loading secure payment…"
            onReady={markCheckoutReady}
            onPaymentInteraction={onPaymentInteraction}
            onExpressCancel={handleExpressCancel}
            onInitError={() => {
              onCheckoutInitError?.();
              checkout.invalidateStripeSession();
            }}
            onBeforeConfirm={async () => {
              if (!checkout.orderId || !checkout.publicToken) {
                return { ok: false, error: "Payment session expired. Retry secure payment." };
              }
              const updated = await validateAndUpdateV2OrderContact({
                api: petFunnelApi,
                orderId: checkout.orderId,
                publicToken: checkout.publicToken,
                petName,
                email,
                species,
                funnelSessionId: getPetV2SessionId(),
              });
              if (!updated.ok) return updated;
              return { ok: true };
            }}
          />
        ) : null}

        {providerBlocked ? (
          <p className="py-8 text-center text-sm text-[#f6efe4]/70" role="status">
            Secure payment is paused until generation capacity is restored. You haven’t been charged.
          </p>
        ) : null}

        {!checkout.loading &&
        !showExpired &&
        !showRetry &&
        !showCheckout &&
        !showHostedFallback &&
        !providerBlocked ? (
          <p className="py-8 text-center text-sm text-[#f6efe4]/55" role="status">
            Preparing secure payment…
          </p>
        ) : null}
      </div>

      <p className="flex items-center justify-center gap-2 text-center text-xs text-[#f6efe4]/50">
        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Secure one-time {offer.priceDisplay} Stripe payment. No subscription.
      </p>
    </div>
  );
}
