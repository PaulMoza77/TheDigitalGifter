import { useCallback, useEffect, useRef, useState } from "react";
import { PetApiError, startPetCheckout, type PetFunnelApi } from "../pet/api";
import { petFunnelApi } from "../pet/supabaseApi";
import { PET_DEFAULT_PERSONALITY } from "../pet/types";
import { validatePetName } from "../pet/croGuards";
import type { PetV3PhotoMeta } from "./types";
import { PET_V3_ROUTE, PET_V3_SPECIES } from "./types";
import { getPetV3SessionId } from "./session";
import {
  readCachedV3EmbeddedCheckout,
  readOrResetV3CheckoutHold,
  v3BootstrapContact,
  writeCachedV3EmbeddedCheckout,
} from "./v3CheckoutHold";
import { v3PackOfferCopy } from "./config";

export type V3EmbeddedCheckoutState = {
  clientSecret: string | null;
  publishableKey: string | null;
  orderId: string | null;
  publicToken: string | null;
  sessionId: string | null;
  eventId: string | null;
  amountCents: number;
  loading: boolean;
  initError: string | null;
  checkoutReady: boolean;
  retry: () => void;
};

export function useV3EmbeddedCheckout(input: {
  active: boolean;
  photo: PetV3PhotoMeta | null;
  file: File | null;
  api?: PetFunnelApi;
}): V3EmbeddedCheckoutState {
  const api = input.api ?? petFunnelApi;
  const bootstrapped = useRef(false);
  const bootstrapInFlight = useRef(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const offer = v3PackOfferCopy();

  const bootstrap = useCallback(async () => {
    if (!input.active || !input.photo || !input.file) return;
    if (bootstrapInFlight.current) return;

    const cached = readCachedV3EmbeddedCheckout();
    if (cached?.clientSecret && cached.publishableKey) {
      setClientSecret(cached.clientSecret);
      setPublishableKey(cached.publishableKey);
      setOrderId(cached.orderId);
      setPublicToken(cached.publicToken);
      setSessionId(cached.sessionId);
      setEventId(cached.eventId ?? null);
      return;
    }

    bootstrapInFlight.current = true;
    setLoading(true);
    setInitError(null);
    const hold = readOrResetV3CheckoutHold();
    const funnelSessionId = getPetV3SessionId();
    const contact = v3BootstrapContact(funnelSessionId);

    try {
      const result = await startPetCheckout({
        api,
        email: contact.email,
        petName: contact.petName,
        species: PET_V3_SPECIES,
        personality: PET_DEFAULT_PERSONALITY,
        photo: input.photo,
        file: input.file,
        successUrl: `${window.location.origin}/pet/order`,
        cancelUrl: `${window.location.origin}${PET_V3_ROUTE}`,
        funnelVariant: "v3",
        funnelSessionId,
        uiMode: "custom",
      });

      if (result.status === "payment_processing" || result.status === "comped") {
        window.location.assign(`/pet/order?token=${encodeURIComponent(result.publicToken)}`);
        return;
      }

      if (result.clientSecret && result.publishableKey) {
        const stripeExpiresAt = result.expiresAt
          ? result.expiresAt > 10_000_000_000
            ? result.expiresAt
            : result.expiresAt * 1000
          : hold.expiresAt;
        writeCachedV3EmbeddedCheckout({
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
        setOrderId(result.orderId);
        setPublicToken(result.publicToken);
        setSessionId(result.sessionId);
        setEventId(result.eventId ?? null);
        return;
      }

      if (result.checkoutUrl?.startsWith("https://")) {
        setInitError("Embedded checkout is unavailable. Refresh and try again.");
        return;
      }

      setInitError("Secure payment could not load. Try again — nothing was charged.");
    } catch (caught) {
      const message =
        caught instanceof PetApiError
          ? caught.message
          : "Secure payment could not load. Try again — nothing was charged.";
      setInitError(message);
      console.error("[v3-checkout-init]", caught instanceof Error ? caught.name : "error");
    } finally {
      bootstrapInFlight.current = false;
      setLoading(false);
    }
  }, [api, input.active, input.file, input.photo]);

  useEffect(() => {
    if (!input.active || !input.photo || !input.file) return;
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void bootstrap();
  }, [input.active, input.file, input.photo, bootstrap]);

  function retry() {
    bootstrapped.current = false;
    bootstrapInFlight.current = false;
    setClientSecret(null);
    setPublishableKey(null);
    void bootstrap();
  }

  return {
    clientSecret,
    publishableKey,
    orderId,
    publicToken,
    sessionId,
    eventId,
    amountCents: offer.amountCents,
    loading,
    initError,
    checkoutReady: Boolean(clientSecret && publishableKey),
    retry,
  };
}

export async function validateAndUpdateV3OrderContact(input: {
  api: PetFunnelApi;
  orderId: string;
  publicToken: string;
  petName: string;
  email: string;
}): Promise<{ ok: true; petName: string; email: string } | { ok: false; error: string; focusId?: string }> {
  const named = validatePetName(input.petName);
  if (!named.ok) {
    return { ok: false, error: named.message, focusId: "v3-pet-name" };
  }
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address.", focusId: "v3-email" };
  }
  await input.api.updateOrderContact({
    orderId: input.orderId,
    publicToken: input.publicToken,
    email,
    petName: named.name,
  });
  return { ok: true, petName: named.name, email };
}