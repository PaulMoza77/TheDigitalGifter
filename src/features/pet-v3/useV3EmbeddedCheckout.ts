import { useCallback, useEffect, useRef, useState } from "react";
import { PetApiError, startPetCheckout, type PetFunnelApi } from "../pet/api";
import { petFunnelApi } from "../pet/supabaseApi";
import { PET_DEFAULT_PERSONALITY } from "../pet/types";
import { validatePetName } from "../pet/croGuards";
import { checkoutAnalyticsContext } from "../pet/funnelInternal";
import { isValidEmbeddedClientSecret, publishableKeyMatchesClientSecret } from "../pet/funnelGuards";
import { stripeKeyAccountFingerprint } from "../pet/stripeKeys";
import type { PetV3PhotoMeta } from "./types";
import { PET_V3_ROUTE, PET_V3_SPECIES } from "./types";
import { getPetV3SessionId } from "./session";
import {
  clearCachedV3EmbeddedCheckout,
  isValidCachedV3EmbeddedCheckout,
  readCachedV3EmbeddedCheckout,
  readOrResetV3CheckoutHold,
  v3BootstrapContact,
  writeCachedV3EmbeddedCheckout,
} from "./v3CheckoutHold";
import { v3PackOfferCopy } from "./config";

const CHECKOUT_INIT_ERROR = "We couldn't load secure payment. Please try again.";

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
  invalidateStripeSession: () => void;
};

function applyCheckoutResult(input: {
  result: {
    orderId: string;
    publicToken: string;
    sessionId: string;
    clientSecret?: string | null;
    publishableKey?: string | null;
    checkoutUrl?: string | null;
    expiresAt?: number | null;
    eventId?: string;
    purchaseEventId?: string;
    amountCents?: number;
    chargedAmountCents?: number;
    status?: "open" | "payment_processing" | "comped";
    checkoutDiag?: {
      keysPaired?: boolean;
      clientSecretValid?: boolean;
      publishableAccountFp?: string | null;
      secretAccountFp?: string | null;
      initFailureCode?: string | null;
    };
  };
  holdExpiresAt: number;
  setters: {
    setClientSecret: (value: string | null) => void;
    setPublishableKey: (value: string | null) => void;
    setOrderId: (value: string | null) => void;
    setPublicToken: (value: string | null) => void;
    setSessionId: (value: string | null) => void;
    setEventId: (value: string | null) => void;
    setInitError: (value: string | null) => void;
  };
}): boolean {
  const { result, holdExpiresAt, setters } = input;
  if (
    !isValidEmbeddedClientSecret(result.clientSecret, result.sessionId) ||
    !String(result.publishableKey || "").startsWith("pk_") ||
    !publishableKeyMatchesClientSecret(result.publishableKey, result.clientSecret) ||
    result.checkoutDiag?.keysPaired === false ||
    result.checkoutDiag?.clientSecretValid === false
  ) {
    console.info("[v3-checkout-diag]", {
      clientSecretValid: result.checkoutDiag?.clientSecretValid ?? isValidEmbeddedClientSecret(result.clientSecret, result.sessionId),
      keysPaired: result.checkoutDiag?.keysPaired ?? null,
      publishableAccountFp: result.checkoutDiag?.publishableAccountFp ?? stripeKeyAccountFingerprint(result.publishableKey || ""),
      secretAccountFp: result.checkoutDiag?.secretAccountFp ?? null,
      initFailureCode: result.checkoutDiag?.initFailureCode ?? "checkout_contract_invalid",
    });
    return false;
  }

  const stripeExpiresAt = result.expiresAt
    ? result.expiresAt > 10_000_000_000
      ? result.expiresAt
      : result.expiresAt * 1000
    : holdExpiresAt;

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

  setters.setClientSecret(result.clientSecret!);
  setters.setPublishableKey(result.publishableKey!);
  setters.setOrderId(result.orderId);
  setters.setPublicToken(result.publicToken);
  setters.setSessionId(result.sessionId);
  setters.setEventId(result.eventId ?? null);
  setters.setInitError(null);
  return true;
}

export function useV3EmbeddedCheckout(input: {
  active: boolean;
  photo: PetV3PhotoMeta | null;
  file: File | null;
  api?: PetFunnelApi;
}): V3EmbeddedCheckoutState {
  const api = input.api ?? petFunnelApi;
  const bootstrapped = useRef(false);
  const bootstrapInFlight = useRef(false);
  const orderRef = useRef<{ orderId: string; publicToken: string } | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const offer = v3PackOfferCopy();

  const setters = {
    setClientSecret,
    setPublishableKey,
    setOrderId,
    setPublicToken,
    setSessionId,
    setEventId,
    setInitError,
  };

  const recoverExistingOrderCheckout = useCallback(async () => {
    const existing = orderRef.current;
    if (!existing) return false;
    const hold = readOrResetV3CheckoutHold();
    const analytics = checkoutAnalyticsContext();
    const checkout = await api.createStripeCheckout({
      orderId: existing.orderId,
      publicToken: existing.publicToken,
      successUrl: `${window.location.origin}/pet/order`,
      cancelUrl: `${window.location.origin}${PET_V3_ROUTE}`,
      customerEmail: v3BootstrapContact(getPetV3SessionId()).email,
      uiMode: "custom",
      ...analytics,
      funnelSessionId: getPetV3SessionId(),
    });

    if (checkout.status === "payment_processing" || checkout.status === "comped") {
      window.location.assign(`/pet/order?token=${encodeURIComponent(existing.publicToken)}`);
      return true;
    }

    return applyCheckoutResult({
      result: {
        orderId: existing.orderId,
        publicToken: existing.publicToken,
        sessionId: checkout.sessionId,
        clientSecret: checkout.clientSecret,
        publishableKey: checkout.publishableKey,
        checkoutUrl: checkout.checkoutUrl,
        expiresAt: checkout.expiresAt,
        eventId: checkout.eventId,
        purchaseEventId: checkout.purchaseEventId,
        amountCents: checkout.amountCents,
        chargedAmountCents: checkout.chargedAmountCents,
        status: checkout.status,
        checkoutDiag: checkout.checkoutDiag,
      },
      holdExpiresAt: hold.expiresAt,
      setters,
    });
  }, [api]);

  const bootstrap = useCallback(async () => {
    if (!input.active || !input.photo || !input.file) return;
    if (bootstrapInFlight.current) return;

    const cached = readCachedV3EmbeddedCheckout();
    if (cached && isValidCachedV3EmbeddedCheckout(cached)) {
      orderRef.current = { orderId: cached.orderId, publicToken: cached.publicToken };
      setClientSecret(cached.clientSecret ?? null);
      setPublishableKey(cached.publishableKey ?? null);
      setOrderId(cached.orderId);
      setPublicToken(cached.publicToken);
      setSessionId(cached.sessionId);
      setEventId(cached.eventId ?? null);
      setInitError(null);
      return;
    }
    if (cached) {
      clearCachedV3EmbeddedCheckout();
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

      orderRef.current = { orderId: result.orderId, publicToken: result.publicToken };

      if (result.status === "payment_processing" || result.status === "comped") {
        window.location.assign(`/pet/order?token=${encodeURIComponent(result.publicToken)}`);
        return;
      }

      const applied = applyCheckoutResult({ result, holdExpiresAt: hold.expiresAt, setters });
      if (applied) return;

      if (result.checkoutUrl?.startsWith("https://")) {
        setInitError(CHECKOUT_INIT_ERROR);
        return;
      }

      setInitError(CHECKOUT_INIT_ERROR);
    } catch (caught) {
      setInitError(CHECKOUT_INIT_ERROR);
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

  function invalidateStripeSession() {
    clearCachedV3EmbeddedCheckout();
    setClientSecret(null);
    setPublishableKey(null);
    setSessionId(null);
    setInitError(CHECKOUT_INIT_ERROR);
  }

  function retry() {
    clearCachedV3EmbeddedCheckout();
    bootstrapped.current = false;
    bootstrapInFlight.current = false;
    setClientSecret(null);
    setPublishableKey(null);
    setSessionId(null);
    setInitError(null);

    bootstrapInFlight.current = true;
    setLoading(true);

    void (async () => {
      try {
        if (orderRef.current) {
          const recovered = await recoverExistingOrderCheckout();
          if (recovered) return;
          setInitError(CHECKOUT_INIT_ERROR);
          return;
        }
        bootstrapped.current = true;
        await bootstrap();
      } catch {
        setInitError(CHECKOUT_INIT_ERROR);
      } finally {
        bootstrapInFlight.current = false;
        setLoading(false);
      }
    })();
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
    checkoutReady:
      isValidEmbeddedClientSecret(clientSecret, sessionId) &&
      publishableKeyMatchesClientSecret(publishableKey, clientSecret),
    retry,
    invalidateStripeSession,
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
