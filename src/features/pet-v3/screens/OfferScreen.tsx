import { useRef, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomStripeCheckout } from "../../pet/components/CustomStripeCheckout";
import { trackMetaInitiateCheckout } from "@/lib/metaPixel";
import { shouldTrackPetBeginCheckout } from "../../pet/funnelAnalytics";
import { PET_V3_FUNNEL_CONFIG, v3PackOfferCopy } from "../config";
import { V3PackOffer } from "../V3PackOffer";
import { trackV3BeginCheckoutOnInteraction, trackV3CheckoutViewed } from "../checkoutAnalytics";
import { fireV3InitiateCheckoutOnce } from "../v3MetaInitiateCheckout";
import {
  type V3EmbeddedCheckoutState,
  validateAndUpdateV3OrderContact,
} from "../useV3EmbeddedCheckout";
import { v3PayButtonLabel } from "../v3CheckoutHold";
import { petFunnelApi } from "../../pet/supabaseApi";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FieldError } from "../../pet/components/FieldError";

const V3_APPEARANCE = {
  colorPrimary: "#d4a84b",
  colorBackground: "#1a1410",
  colorText: "#f6efe4",
  colorDanger: "#9a3412",
  borderRadius: "16px",
  fontFamily: "system-ui, sans-serif",
};

export function V3OfferScreen({
  email,
  petName,
  error,
  checkout,
  onEmail,
  onPetName,
}: {
  email: string;
  petName: string;
  error?: string | null;
  checkout: V3EmbeddedCheckoutState;
  onEmail: (value: string) => void;
  onPetName: (value: string) => void;
}) {
  const copy = PET_V3_FUNNEL_CONFIG.copy;
  const [offer, setOffer] = useState(() => v3PackOfferCopy());
  const checkoutViewedRef = useRef(false);
  const beginCheckoutRef = useRef(false);

  function markCheckoutViewed() {
    if (checkoutViewedRef.current) return;
    checkoutViewedRef.current = true;
    trackV3CheckoutViewed();
  }

  function markBeginCheckout() {
    if (beginCheckoutRef.current) return;
    if (!checkout.orderId || !checkout.sessionId) return;
    beginCheckoutRef.current = true;
    const result = {
      status: "open" as const,
      sessionId: checkout.sessionId,
      clientSecret: checkout.clientSecret,
      orderId: checkout.orderId,
      chargedAmountCents: checkout.amountCents,
      eventId: checkout.eventId ?? undefined,
    };
    const tracked = trackV3BeginCheckoutOnInteraction({ result, fallbackAmountCents: checkout.amountCents });
    if (tracked && shouldTrackPetBeginCheckout(result)) {
      const eventId = result.eventId || `pet_ic_${result.orderId}`;
      trackMetaInitiateCheckout({
        eventId,
        valueCents: checkout.amountCents,
        orderId: checkout.orderId,
      });
      if (checkout.publicToken) {
        fireV3InitiateCheckoutOnce({
          orderId: checkout.orderId,
          publicToken: checkout.publicToken,
          eventId,
          amountCents: checkout.amountCents,
        });
      }
    }
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#f6efe4] sm:text-3xl">{copy.offerHeadline}</h1>
        <p className="mt-2 text-sm leading-6 text-[#f6efe4]/65">{copy.offerSubhead(offer.headline)}</p>
      </div>
      <V3PackOffer onExpire={() => setOffer(v3PackOfferCopy())} />
      <ul className="space-y-2 text-sm text-[#f6efe4]/72">
        <li>12 secret lives of the same cat</li>
        <li>2 mini cinematic clips</li>
        <li>One-time {offer.priceDisplay} payment — no subscription</li>
        <li>Usually ready a few minutes after payment</li>
      </ul>
      <div>
        <Label htmlFor="v3-pet-name" className="text-sm font-medium text-[#f6efe4]">
          Cat’s name
        </Label>
        <Input
          id="v3-pet-name"
          value={petName}
          maxLength={40}
          autoComplete="off"
          onChange={(event) => onPetName(event.target.value)}
          placeholder="Luna"
          className="mt-2 h-12 rounded-2xl border-[#f6efe4]/12 bg-[#1a1410] text-[#f6efe4]"
        />
      </div>
      <div>
        <Label htmlFor="v3-email" className="text-sm font-medium text-[#f6efe4]">
          Email for the gallery
        </Label>
        <Input
          id="v3-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => onEmail(event.target.value)}
          placeholder="you@email.com"
          className="mt-2 h-12 rounded-2xl border-[#f6efe4]/12 bg-[#1a1410] text-[#f6efe4]"
        />
      </div>

      <div
        className="min-h-[180px] overflow-hidden rounded-2xl border border-[#f6efe4]/10 bg-[#1a1410]/60 p-4"
        aria-label="Secure payment"
      >
        {checkout.loading && !checkout.checkoutReady ? (
          <p className="py-8 text-center text-sm text-[#f6efe4]/55" role="status">
            Loading secure payment…
          </p>
        ) : null}
        {checkout.initError ? (
          <div className="space-y-3 py-4">
            <p className="text-sm text-[#9a3412]" role="alert">
              {checkout.initError}
            </p>
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
        {checkout.checkoutReady && checkout.clientSecret && checkout.publishableKey ? (
          <CustomStripeCheckout
            clientSecret={checkout.clientSecret}
            publishableKey={checkout.publishableKey}
            email={email.trim() || undefined}
            dueDisplay={offer.priceDisplay}
            returnUrl={`${window.location.origin}/pet/order`}
            appearanceTheme="night"
            appearanceVariables={V3_APPEARANCE}
            payButtonClassName="h-12 min-h-[48px] w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] disabled:opacity-40"
            payButtonLabel={v3PayButtonLabel(petName)}
            busyLabel="Processing secure payment…"
            loadingLabel="Loading secure payment…"
            onReady={markCheckoutViewed}
            onPaymentInteraction={markBeginCheckout}
            onInitError={checkout.invalidateStripeSession}
            onBeforeConfirm={async () => {
              if (!checkout.orderId || !checkout.publicToken) {
                return { ok: false, error: "Payment session expired. Retry secure payment.", focusId: undefined };
              }
              const updated = await validateAndUpdateV3OrderContact({
                api: petFunnelApi,
                orderId: checkout.orderId,
                publicToken: checkout.publicToken,
                petName,
                email,
              });
              if (!updated.ok) return updated;
              markBeginCheckout();
              return { ok: true };
            }}
          />
        ) : null}
      </div>

      <FieldError id="v3-checkout-error" message={error || undefined} />
      <p className="flex items-center justify-center gap-2 text-center text-xs text-[#f6efe4]/50">
        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Secure one-time {offer.priceDisplay} Stripe payment. No subscription.
      </p>
    </div>
  );
}
