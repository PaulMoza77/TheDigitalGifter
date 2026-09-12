import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "../../pet/components/FieldError";
import { petFunnelApi } from "../../pet/supabaseApi";
import { petSpeciesWord, usePetLocale, usePetT } from "../../pet/i18n";
import { V2ElementsCheckout } from "../components/V2ElementsCheckout";
import { V2PackOffer, v2PackOfferCopy } from "../V2PackOffer";
import { trackPetV2Event } from "../analytics";
import {
  type V2EmbeddedCheckoutState,
  validateAndUpdateV2OrderContact,
  v2CheckoutLoadingCopy,
} from "../useV2EmbeddedCheckout";
import { getPetV2SessionId } from "../session";
import {
  PET_V2_PRICE_DISPLAY,
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
  onPaymentAttempt,
  onPaymentFailed,
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
  onPaymentAttempt?: () => void;
  onPaymentFailed?: (detail?: { failureCode?: string | null }) => void;
}) {
  const locale = usePetLocale();
  const t = usePetT(locale);
  const [offer, setOffer] = useState(() => v2PackOfferCopy());
  const checkoutReadyFired = useRef(false);
  const pet = petSpeciesWord(species, locale, "lower");
  const h1Key =
    species === "cat" ? "v2.teaser.h1.cat" : species === "other" ? "v2.teaser.h1.other" : "v2.teaser.h1.dog";
  const payKey =
    species === "cat" ? "v2.teaser.payCat" : species === "other" ? "v2.teaser.payPet" : "v2.teaser.payDog";

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
  const canHosted =
    Boolean(checkout.orderId && checkout.publicToken) || checkout.showHostedFallback;
  const showHostedFallback =
    !showExpired && !providerBlocked && (checkout.showHostedFallback || (Boolean(checkout.initError) && canHosted));
  const showRetry =
    Boolean(checkout.initError) && !showExpired && !showHostedFallback && !providerBlocked;
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
          {t(h1Key)}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#f6efe4]/65">
          {t("v2.teaser.support", { price: PET_V2_PRICE_DISPLAY })}
        </p>
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
        <img src={teaserUrl} alt={t("v2.teaser.alt")} className="aspect-[4/5] w-full object-cover" />
      </figure>

      <V2PackOffer compact onExpire={() => setOffer(v2PackOfferCopy())} />

      <ul className="space-y-2 text-sm text-[#f6efe4]/72">
        <li>{t("v2.teaser.bullet.lives", { pet })}</li>
        <li>{t("v2.teaser.bullet.clips")}</li>
        <li>{t("v2.teaser.bullet.price", { price: PET_V2_PRICE_DISPLAY })}</li>
      </ul>

      {onPetName ? (
        <div>
          <Label htmlFor="v2-pet-name" className="text-sm font-medium text-[#f6efe4]">
            {t("v2.teaser.petName")}{" "}
            <span className="font-normal text-[#f6efe4]/45">{t("chrome.optional")}</span>
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
            {t("v2.teaser.email")}{" "}
            <span className="font-normal text-[#f6efe4]/45">{t("chrome.optional")}</span>
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
        aria-label={t("v2.teaser.payAria")}
      >
        {checkout.loading && !checkout.checkoutReady && !showExpired && !showHostedFallback && !providerBlocked ? (
          <p className="py-8 text-center text-sm text-[#f6efe4]/55" role="status">
            {v2CheckoutLoadingCopy(checkout.loadingPhase, locale)}
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
              {t("v2.teaser.reupload")}
            </Button>
          </div>
        ) : null}

        {showHostedFallback ? (
          <div className="space-y-3 py-4">
            <p className="text-sm text-[#f6efe4]/70">
              {checkout.hostedFallbackBusy ? t("v2.teaser.hostedOpening") : t("v2.teaser.hostedHint")}
            </p>
            {checkout.initError ? (
              <FieldError id="v2-checkout-hosted-error" message={checkout.initError} />
            ) : null}
            <Button
              type="button"
              className="h-12 min-h-[48px] w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] disabled:opacity-40"
              onClick={() => void checkout.startHostedFallback({ preferNewTab: true })}
              disabled={checkout.hostedFallbackBusy}
            >
              {checkout.hostedFallbackBusy
                ? t("v2.teaser.hostedBusy")
                : t("v2.teaser.hostedCta", { price: offer.priceDisplay })}
            </Button>
          </div>
        ) : null}

        {showRetry ? (
          <div className="space-y-3 py-4">
            <FieldError id="v2-checkout-init-error" message={checkout.initError || undefined} />
            <Button
              type="button"
              className="h-12 min-h-[48px] w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] disabled:opacity-40"
              onClick={checkout.retry}
              disabled={checkout.loading || checkout.hostedFallbackBusy}
            >
              {checkout.loading
                ? t("v2.teaser.retrying")
                : t("v2.teaser.retry", { price: offer.priceDisplay })}
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
            payButtonLabel={(payLabel) => t(payKey, { price: payLabel })}
            busyLabel={t("v2.teaser.busyPay")}
            loadingLabel={t("v2.teaser.loadingPay")}
            onReady={markCheckoutReady}
            onPaymentInteraction={onPaymentInteraction}
            onPaymentAttempt={onPaymentAttempt}
            onPaymentFailed={onPaymentFailed}
            onExpressCancel={handleExpressCancel}
            onInitError={() => {
              onCheckoutInitError?.();
              checkout.invalidateStripeSession();
            }}
            onBeforeConfirm={async () => {
              if (!checkout.orderId || !checkout.publicToken) {
                return { ok: false, error: t("v2.teaser.sessionExpiredContact") };
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
            {t("v2.teaser.paused")}
          </p>
        ) : null}

        {!checkout.loading &&
        !showExpired &&
        !showRetry &&
        !showCheckout &&
        !showHostedFallback &&
        !providerBlocked ? (
          <p className="py-8 text-center text-sm text-[#f6efe4]/55" role="status">
            {t("v2.teaser.preparing")}
          </p>
        ) : null}
      </div>

      <p className="flex items-center justify-center gap-2 text-center text-xs text-[#f6efe4]/50">
        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t("v2.teaser.secureLine", { price: offer.priceDisplay })}
      </p>
    </div>
  );
}
