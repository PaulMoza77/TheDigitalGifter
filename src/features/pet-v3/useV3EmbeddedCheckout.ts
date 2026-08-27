import { useCallback, useEffect, useRef, useState } from "react";
import { PetApiError, startPetCheckout, type PetFunnelApi } from "../pet/api";
import { petFunnelApi } from "../pet/supabaseApi";
import { PET_DEFAULT_PERSONALITY } from "../pet/types";
import { validatePetName } from "../pet/croGuards";
import { checkoutAnalyticsContext } from "../pet/funnelInternal";
import { isValidEmbeddedClientSecret, publishableKeyMatchesClientSecret } from "../pet/funnelGuards";
import { buildPetOrderReturnUrl } from "../pet/orderReturnUrl";
import { stripeKeyAccountFingerprint } from "../pet/stripeKeys";
import type { PetV3PhotoMeta } from "./types";
import { PET_V3_ROUTE, PET_V3_SPECIES } from "./types";
import { getPetV3SessionId } from "./session";
import {
  clearCachedV3EmbeddedCheckout,
  isValidCachedV3EmbeddedCheckout,
  readCachedV3EmbeddedCheckout,
  readOrResetV3CheckoutHold,
  readRecoverableV3CheckoutOrder,
  v3BootstrapContact,
  writeCachedV3EmbeddedCheckout,
} from "./v3CheckoutHold";
import { v3PackOfferCopy } from "./config";

export const V3_CHECKOUT_EXPIRED_MESSAGE =
  "Your secure checkout session expired. Please upload your cat photo again.";
const CHECKOUT_INIT_ERROR = "We couldn't load secure payment. Please try again.";
const CONTACT_UPDATE_ERROR = "Could not save your details. Try again.";
const V3_ELEMENTS_UI_MODE = "elements" as const;

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
  sessionExpired: boolean;
  checkoutReady: boolean;
  /** After Elements fails (and one safe retry), show hosted Stripe fallback CTA. */
  showHostedFallback: boolean;
  hostedFallbackBusy: boolean;
  retry: () => void;
  restartExpiredCheckout: () => void;
  invalidateStripeSession: () => void;
  startHostedFallback: (opts?: {
    onSessionReady?: (session: { sessionId: string; checkoutUrl: string }) => void;
  }) => Promise<void>;
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
    setSessionExpired: (value: boolean) => void;
    setShowHostedFallback: (value: boolean) => void;
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
    checkoutUrl: null,
    expiresAt: stripeExpiresAt,
    eventId: result.eventId,
    purchaseEventId: result.purchaseEventId,
    amountCents: result.amountCents,
    chargedAmountCents: result.chargedAmountCents,
    status: result.status,
    checkoutMode: "elements",
    cacheVersion: 2,
  });

  setters.setClientSecret(result.clientSecret!);
  setters.setPublishableKey(result.publishableKey!);
  setters.setOrderId(result.orderId);
  setters.setPublicToken(result.publicToken);
  setters.setSessionId(result.sessionId);
  setters.setEventId(result.eventId ?? null);
  setters.setInitError(null);
  setters.setSessionExpired(false);
  setters.setShowHostedFallback(false);
  return true;
}

function hydrateFromCache(
  cached: NonNullable<ReturnType<typeof readCachedV3EmbeddedCheckout>>,
  orderRef: { current: { orderId: string; publicToken: string } | null },
  setters: Parameters<typeof applyCheckoutResult>[0]["setters"],
) {
  orderRef.current = { orderId: cached.orderId, publicToken: cached.publicToken };
  setters.setClientSecret(cached.clientSecret ?? null);
  setters.setPublishableKey(cached.publishableKey ?? null);
  setters.setOrderId(cached.orderId);
  setters.setPublicToken(cached.publicToken);
  setters.setSessionId(cached.sessionId);
  setters.setEventId(cached.eventId ?? null);
  setters.setInitError(null);
  setters.setSessionExpired(false);
  setters.setShowHostedFallback(false);
}

export function useV3EmbeddedCheckout(input: {
  active: boolean;
  photo: PetV3PhotoMeta | null;
  file: File | null;
  onRestartExpired?: () => void;
  api?: PetFunnelApi;
}): V3EmbeddedCheckoutState {
  const api = input.api ?? petFunnelApi;
  const bootstrapped = useRef(false);
  const bootstrapInFlight = useRef(false);
  const elementsRetryUsed = useRef(false);
  const hostedFallbackUsed = useRef(false);
  const orderRef = useRef<{ orderId: string; publicToken: string } | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [showHostedFallback, setShowHostedFallback] = useState(false);
  const [hostedFallbackBusy, setHostedFallbackBusy] = useState(false);
  const offer = v3PackOfferCopy();

  const setters = {
    setClientSecret,
    setPublishableKey,
    setOrderId,
    setPublicToken,
    setSessionId,
    setEventId,
    setInitError,
    setSessionExpired,
    setShowHostedFallback,
  };

  const recoverExistingOrderCheckout = useCallback(async () => {
    const existing = orderRef.current;
    if (!existing) return false;
    const hold = readOrResetV3CheckoutHold();
    const analytics = checkoutAnalyticsContext();
    const checkout = await api.createStripeCheckout({
      orderId: existing.orderId,
      publicToken: existing.publicToken,
      successUrl: buildPetOrderReturnUrl(existing.publicToken),
      cancelUrl: `${window.location.origin}${PET_V3_ROUTE}`,
      customerEmail: v3BootstrapContact(getPetV3SessionId()).email,
      uiMode: V3_ELEMENTS_UI_MODE,
      ...analytics,
      funnelSessionId: getPetV3SessionId(),
    });

    if (checkout.status === "payment_processing" || checkout.status === "comped") {
      const sessionQs = checkout.sessionId
        ? `&session_id=${encodeURIComponent(checkout.sessionId)}`
        : "";
      window.location.assign(`/pet/order?token=${encodeURIComponent(existing.publicToken)}${sessionQs}`);
      return true;
    }

    return applyCheckoutResult({
      result: {
        orderId: existing.orderId,
        publicToken: existing.publicToken,
        sessionId: checkout.sessionId,
        clientSecret: checkout.clientSecret,
        publishableKey: checkout.publishableKey,
        checkoutUrl: null,
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

  const markExpired = useCallback(() => {
    clearCachedV3EmbeddedCheckout();
    orderRef.current = null;
    setClientSecret(null);
    setPublishableKey(null);
    setOrderId(null);
    setPublicToken(null);
    setSessionId(null);
    setEventId(null);
    setSessionExpired(true);
    setShowHostedFallback(false);
    setInitError(V3_CHECKOUT_EXPIRED_MESSAGE);
  }, []);

  const bootstrap = useCallback(async () => {
    if (!input.active) return;
    if (bootstrapInFlight.current) return;

    const cached = readCachedV3EmbeddedCheckout();
    if (cached && isValidCachedV3EmbeddedCheckout(cached)) {
      // A: valid Elements checkout — restore without photo File / new order / upload / preview.
      hydrateFromCache(cached, orderRef, setters);
      return;
    }

    const recoverable = readRecoverableV3CheckoutOrder();
    if (recoverable) {
      // B: cached secret invalid / Custom legacy — recover same unpaid order with one Elements Session.
      orderRef.current = { orderId: recoverable.orderId, publicToken: recoverable.publicToken };
      bootstrapInFlight.current = true;
      setLoading(true);
      setInitError(null);
      setSessionExpired(false);
      setShowHostedFallback(false);
      try {
        const recovered = await recoverExistingOrderCheckout();
        if (recovered) return;
        markExpired();
      } catch {
        markExpired();
      } finally {
        bootstrapInFlight.current = false;
        setLoading(false);
      }
      return;
    }

    if (!input.photo || !input.file) {
      markExpired();
      return;
    }

    bootstrapInFlight.current = true;
    setLoading(true);
    setInitError(null);
    setSessionExpired(false);
    setShowHostedFallback(false);
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
        uiMode: V3_ELEMENTS_UI_MODE,
      });

      orderRef.current = { orderId: result.orderId, publicToken: result.publicToken };

      if (result.status === "payment_processing" || result.status === "comped") {
        window.location.assign(`/pet/order?token=${encodeURIComponent(result.publicToken)}`);
        return;
      }

      const applied = applyCheckoutResult({ result, holdExpiresAt: hold.expiresAt, setters });
      if (applied) return;

      setInitError(CHECKOUT_INIT_ERROR);
      setShowHostedFallback(true);
    } catch (caught) {
      setInitError(CHECKOUT_INIT_ERROR);
      setShowHostedFallback(true);
      console.error("[v3-checkout-init]", caught instanceof Error ? caught.name : "error");
    } finally {
      bootstrapInFlight.current = false;
      setLoading(false);
    }
  }, [api, input.active, input.file, input.photo, markExpired, recoverExistingOrderCheckout]);

  useEffect(() => {
    if (!input.active) return;
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void bootstrap();
  }, [input.active, bootstrap]);

  function invalidateStripeSession() {
    // One safe Elements retry, then hosted fallback CTA (no endless Retry loops).
    if (!elementsRetryUsed.current && orderRef.current) {
      elementsRetryUsed.current = true;
      clearCachedV3EmbeddedCheckout();
      setClientSecret(null);
      setPublishableKey(null);
      setSessionId(null);
      setInitError(null);
      setSessionExpired(false);
      setShowHostedFallback(false);
      void (async () => {
        setLoading(true);
        try {
          const recovered = await recoverExistingOrderCheckout();
          if (!recovered) {
            setInitError(CHECKOUT_INIT_ERROR);
            setShowHostedFallback(true);
          }
        } catch {
          setInitError(CHECKOUT_INIT_ERROR);
          setShowHostedFallback(true);
        } finally {
          setLoading(false);
        }
      })();
      return;
    }
    clearCachedV3EmbeddedCheckout();
    setClientSecret(null);
    setPublishableKey(null);
    setSessionId(null);
    setInitError(CHECKOUT_INIT_ERROR);
    setSessionExpired(false);
    setShowHostedFallback(true);
  }

  function restartExpiredCheckout() {
    clearCachedV3EmbeddedCheckout();
    orderRef.current = null;
    bootstrapped.current = false;
    bootstrapInFlight.current = false;
    elementsRetryUsed.current = false;
    hostedFallbackUsed.current = false;
    setClientSecret(null);
    setPublishableKey(null);
    setOrderId(null);
    setPublicToken(null);
    setSessionId(null);
    setEventId(null);
    setInitError(null);
    setSessionExpired(false);
    setShowHostedFallback(false);
    input.onRestartExpired?.();
  }

  function retry() {
    if (bootstrapInFlight.current || loading) return;
    // Prefer hosted fallback over endless Elements retry once Elements already failed.
    if (showHostedFallback || elementsRetryUsed.current) {
      setShowHostedFallback(true);
      return;
    }
    clearCachedV3EmbeddedCheckout();
    bootstrapped.current = false;
    bootstrapInFlight.current = false;
    setClientSecret(null);
    setPublishableKey(null);
    setSessionId(null);
    setInitError(null);
    setSessionExpired(false);

    bootstrapInFlight.current = true;
    setLoading(true);

    void (async () => {
      try {
        if (orderRef.current) {
          const recovered = await recoverExistingOrderCheckout();
          if (recovered) return;
          setInitError(CHECKOUT_INIT_ERROR);
          setShowHostedFallback(true);
          return;
        }
        const recoverable = readRecoverableV3CheckoutOrder();
        if (recoverable) {
          orderRef.current = { orderId: recoverable.orderId, publicToken: recoverable.publicToken };
          const recovered = await recoverExistingOrderCheckout();
          if (recovered) return;
          setInitError(CHECKOUT_INIT_ERROR);
          setShowHostedFallback(true);
          return;
        }
        bootstrapped.current = true;
        await bootstrap();
      } catch {
        setInitError(CHECKOUT_INIT_ERROR);
        setShowHostedFallback(true);
      } finally {
        bootstrapInFlight.current = false;
        setLoading(false);
      }
    })();
  }

  async function startHostedFallback(opts?: {
    onSessionReady?: (session: { sessionId: string; checkoutUrl: string }) => void;
  }) {
    if (hostedFallbackBusy || hostedFallbackUsed.current) return;
    const existing = orderRef.current;
    if (!existing) {
      setInitError(CHECKOUT_INIT_ERROR);
      return;
    }
    setHostedFallbackBusy(true);
    try {
      const analytics = checkoutAnalyticsContext();
      const checkout = await api.createStripeCheckout({
        orderId: existing.orderId,
        publicToken: existing.publicToken,
        successUrl: buildPetOrderReturnUrl(existing.publicToken),
        cancelUrl: `${window.location.origin}${PET_V3_ROUTE}`,
        customerEmail: v3BootstrapContact(getPetV3SessionId()).email,
        uiMode: "hosted",
        ...analytics,
        funnelSessionId: getPetV3SessionId(),
      });
      const url = String(checkout.checkoutUrl || "").trim();
      if (!url.startsWith("https://checkout.stripe.com/") || !checkout.sessionId) {
        setInitError(CHECKOUT_INIT_ERROR);
        return;
      }
      opts?.onSessionReady?.({ sessionId: checkout.sessionId, checkoutUrl: url });
      hostedFallbackUsed.current = true;
      window.location.assign(url);
    } catch {
      setInitError(CHECKOUT_INIT_ERROR);
    } finally {
      setHostedFallbackBusy(false);
    }
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
    sessionExpired,
    checkoutReady:
      isValidEmbeddedClientSecret(clientSecret, sessionId) &&
      publishableKeyMatchesClientSecret(publishableKey, clientSecret),
    showHostedFallback,
    hostedFallbackBusy,
    retry,
    restartExpiredCheckout,
    invalidateStripeSession,
    startHostedFallback,
  };
}

export async function validateAndUpdateV3OrderContact(input: {
  api: PetFunnelApi;
  orderId: string;
  publicToken: string;
  petName: string;
  email: string;
}): Promise<{ ok: true; petName: string; email: string; stripeSessionSynced?: boolean } | { ok: false; error: string; focusId?: string }> {
  const named = validatePetName(input.petName);
  if (!named.ok) {
    return { ok: false, error: named.message, focusId: "v3-pet-name" };
  }
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address.", focusId: "v3-email" };
  }
  try {
    const updated = await input.api.updateOrderContact({
      orderId: input.orderId,
      publicToken: input.publicToken,
      email,
      petName: named.name,
    });
    if (!updated?.updated) {
      return { ok: false, error: CONTACT_UPDATE_ERROR, focusId: "v3-email" };
    }
    if (updated.stripeSessionSynced === false) {
      console.info("[v3-contact-update]", {
        ok: true,
        stripeSessionSynced: false,
        fulfillmentUsesInternalEmail: true,
      });
    }
    return {
      ok: true,
      petName: named.name,
      email,
      stripeSessionSynced: updated.stripeSessionSynced,
    };
  } catch (caught) {
    if (caught instanceof PetApiError) {
      return { ok: false, error: CONTACT_UPDATE_ERROR, focusId: "v3-email" };
    }
    return { ok: false, error: CONTACT_UPDATE_ERROR, focusId: "v3-email" };
  }
}
