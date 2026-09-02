import { useCallback, useEffect, useRef, useState } from "react";
import { uploadPhotoToSignedUrl, type PetFunnelApi } from "../pet/api";
import { petFunnelApi } from "../pet/supabaseApi";
import { PET_DEFAULT_PERSONALITY } from "../pet/types";
import { checkoutAnalyticsContext } from "../pet/funnelInternal";
import { isValidEmbeddedClientSecret, publishableKeyMatchesClientSecret } from "../pet/funnelGuards";
import { buildPetOrderReturnUrl } from "../pet/orderReturnUrl";
import { stripeKeyAccountFingerprint } from "../pet/stripeKeys";
import { trackPetV2Event } from "./analytics";
import { prepareV2CheckoutUpload } from "./photo";
import { v2PackOfferCopy } from "./V2PackOffer";
import { fetchV2ProviderStatus } from "./providerStatus";
import {
  clearCachedV2EmbeddedCheckout,
  isValidCachedV2EmbeddedCheckout,
  readCachedV2EmbeddedCheckout,
  readOrResetV2CheckoutHold,
  readRecoverableV2CheckoutOrder,
  v2BootstrapContact,
  writeCachedV2EmbeddedCheckout,
} from "./v2CheckoutHold";
import { getPetV2SessionId } from "./session";
import {
  PET_V2_PRICE_CENTS,
  V2_CHECKOUT_FAILED_COPY,
  type PetV2PhotoMeta,
  type PetV2Species,
} from "./types";

export type V2CheckoutLoadingPhase =
  | "preparing_photo"
  | "creating_order"
  | "uploading"
  | "creating_session"
  | null;

export const V2_CHECKOUT_EXPIRED_MESSAGE =
  "Your secure checkout session expired. Please upload your pet photo again.";
const CHECKOUT_INIT_ERROR = V2_CHECKOUT_FAILED_COPY;
const V2_ELEMENTS_UI_MODE = "elements" as const;

export type V2EmbeddedCheckoutState = {
  clientSecret: string | null;
  publishableKey: string | null;
  orderId: string | null;
  publicToken: string | null;
  sessionId: string | null;
  eventId: string | null;
  amountCents: number;
  loading: boolean;
  /** Fine-grained bootstrap stage for the offer loading copy. */
  loadingPhase: V2CheckoutLoadingPhase;
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

export function v2CheckoutLoadingCopy(phase: V2CheckoutLoadingPhase): string {
  switch (phase) {
    case "preparing_photo":
      return "Preparing your photo…";
    case "creating_order":
      return "Starting secure checkout…";
    case "uploading":
      return "Uploading your photo…";
    case "creating_session":
      return "Loading secure payment…";
    default:
      return "Loading secure payment…";
  }
}

function v2CancelUrl(species: PetV2Species, origin = typeof window !== "undefined" ? window.location.origin : ""): string {
  return `${origin}/pet/${species}-v2?checkout=canceled`;
}

function resolveAmountCents(value?: number | null): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  return v2PackOfferCopy().amountCents ?? PET_V2_PRICE_CENTS;
}

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
  species: PetV2Species;
  funnelSessionId: string;
  setters: {
    setClientSecret: (value: string | null) => void;
    setPublishableKey: (value: string | null) => void;
    setOrderId: (value: string | null) => void;
    setPublicToken: (value: string | null) => void;
    setSessionId: (value: string | null) => void;
    setEventId: (value: string | null) => void;
    setAmountCents: (value: number) => void;
    setInitError: (value: string | null) => void;
    setSessionExpired: (value: boolean) => void;
    setShowHostedFallback: (value: boolean) => void;
  };
}): boolean {
  const { result, holdExpiresAt, species, funnelSessionId, setters } = input;
  if (
    !isValidEmbeddedClientSecret(result.clientSecret, result.sessionId) ||
    !String(result.publishableKey || "").startsWith("pk_") ||
    !publishableKeyMatchesClientSecret(result.publishableKey, result.clientSecret) ||
    result.checkoutDiag?.keysPaired === false ||
    result.checkoutDiag?.clientSecretValid === false
  ) {
    console.info("[v2-checkout-diag]", {
      clientSecretValid:
        result.checkoutDiag?.clientSecretValid ??
        isValidEmbeddedClientSecret(result.clientSecret, result.sessionId),
      keysPaired: result.checkoutDiag?.keysPaired ?? null,
      publishableAccountFp:
        result.checkoutDiag?.publishableAccountFp ?? stripeKeyAccountFingerprint(result.publishableKey || ""),
      secretAccountFp: result.checkoutDiag?.secretAccountFp ?? null,
      initFailureCode: result.checkoutDiag?.initFailureCode ?? "checkout_contract_invalid",
    });
    return false;
  }

  const amountCents = resolveAmountCents(result.chargedAmountCents ?? result.amountCents);
  const stripeExpiresAt = result.expiresAt
    ? result.expiresAt > 10_000_000_000
      ? result.expiresAt
      : result.expiresAt * 1000
    : holdExpiresAt;

  writeCachedV2EmbeddedCheckout({
    orderId: result.orderId,
    publicToken: result.publicToken,
    sessionId: result.sessionId,
    clientSecret: result.clientSecret,
    publishableKey: result.publishableKey,
    checkoutUrl: null,
    expiresAt: stripeExpiresAt,
    eventId: result.eventId,
    purchaseEventId: result.purchaseEventId,
    amountCents,
    chargedAmountCents: result.chargedAmountCents,
    status: result.status,
    checkoutMode: "elements",
    cacheVersion: 1,
    funnelSessionId,
    species,
  });

  setters.setClientSecret(result.clientSecret!);
  setters.setPublishableKey(result.publishableKey!);
  setters.setOrderId(result.orderId);
  setters.setPublicToken(result.publicToken);
  setters.setSessionId(result.sessionId);
  setters.setEventId(result.eventId ?? null);
  setters.setAmountCents(amountCents);
  setters.setInitError(null);
  setters.setSessionExpired(false);
  setters.setShowHostedFallback(false);

  trackPetV2Event({
    eventName: "v2_checkout_session_created",
    species,
    amountCents,
    attemptId: result.orderId,
  });
  return true;
}

function hydrateFromCache(
  cached: NonNullable<ReturnType<typeof readCachedV2EmbeddedCheckout>>,
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
  setters.setAmountCents(resolveAmountCents(cached.chargedAmountCents ?? cached.amountCents));
  setters.setInitError(null);
  setters.setSessionExpired(false);
  setters.setShowHostedFallback(false);
}

export async function ensureV2CheckoutAllowed(
  species: PetV2Species,
): Promise<{ allowed: true } | { allowed: false; message: string }> {
  const status = await fetchV2ProviderStatus();
  if (!status.available) {
    trackPetV2Event({
      eventName: "v2_provider_unavailable",
      species,
      failureCategory: "provider_unavailable",
    });
    return { allowed: false, message: status.message };
  }
  return { allowed: true };
}

export function useV2EmbeddedCheckout(input: {
  active: boolean;
  species: PetV2Species;
  photo: PetV2PhotoMeta | null;
  file: File | null;
  onRestartExpired?: () => void;
  api?: PetFunnelApi;
}): V2EmbeddedCheckoutState {
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
  const [amountCents, setAmountCents] = useState(PET_V2_PRICE_CENTS);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<V2CheckoutLoadingPhase>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [showHostedFallback, setShowHostedFallback] = useState(false);
  const [hostedFallbackBusy, setHostedFallbackBusy] = useState(false);

  const setters = {
    setClientSecret,
    setPublishableKey,
    setOrderId,
    setPublicToken,
    setSessionId,
    setEventId,
    setAmountCents,
    setInitError,
    setSessionExpired,
    setShowHostedFallback,
  };

  const recoverExistingOrderCheckout = useCallback(async () => {
    const existing = orderRef.current;
    if (!existing) return false;
    const hold = readOrResetV2CheckoutHold();
    const analytics = checkoutAnalyticsContext();
    const funnelSessionId = getPetV2SessionId();
    const contact = v2BootstrapContact(funnelSessionId, input.species);

    trackPetV2Event({
      eventName: "v2_checkout_session_requested",
      species: input.species,
      attemptId: existing.orderId,
    });

    const checkout = await api.createStripeCheckout({
      orderId: existing.orderId,
      publicToken: existing.publicToken,
      successUrl: buildPetOrderReturnUrl(existing.publicToken),
      cancelUrl: v2CancelUrl(input.species),
      customerEmail: contact.email,
      uiMode: V2_ELEMENTS_UI_MODE,
      ...analytics,
      funnelSessionId,
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
      species: input.species,
      funnelSessionId,
      setters,
    });
  }, [api, input.species]);

  const markExpired = useCallback(() => {
    clearCachedV2EmbeddedCheckout();
    orderRef.current = null;
    setClientSecret(null);
    setPublishableKey(null);
    setOrderId(null);
    setPublicToken(null);
    setSessionId(null);
    setEventId(null);
    setSessionExpired(true);
    setShowHostedFallback(false);
    setInitError(V2_CHECKOUT_EXPIRED_MESSAGE);
  }, []);

  const bootstrap = useCallback(async () => {
    if (!input.active) return;
    if (bootstrapInFlight.current) return;

    const cached = readCachedV2EmbeddedCheckout();
    if (cached && isValidCachedV2EmbeddedCheckout(cached)) {
      hydrateFromCache(cached, orderRef, setters);
      return;
    }

    const recoverable = readRecoverableV2CheckoutOrder();
    if (recoverable) {
      orderRef.current = { orderId: recoverable.orderId, publicToken: recoverable.publicToken };
      bootstrapInFlight.current = true;
      setLoading(true);
      setLoadingPhase("creating_session");
      setInitError(null);
      setSessionExpired(false);
      setShowHostedFallback(false);
      try {
        const recovered = await recoverExistingOrderCheckout();
        if (recovered) return;
        markExpired();
      } catch {
        trackPetV2Event({
          eventName: "v2_checkout_failed",
          species: input.species,
          failureCategory: "checkout_error",
          attemptId: recoverable.orderId,
        });
        markExpired();
      } finally {
        bootstrapInFlight.current = false;
        setLoading(false);
        setLoadingPhase(null);
      }
      return;
    }

    if (!input.photo || !input.file) {
      markExpired();
      return;
    }

    bootstrapInFlight.current = true;
    setLoading(true);
    setLoadingPhase("preparing_photo");
    setInitError(null);
    setSessionExpired(false);
    setShowHostedFallback(false);
    const hold = readOrResetV2CheckoutHold();
    const funnelSessionId = getPetV2SessionId();
    const contact = v2BootstrapContact(funnelSessionId, input.species);
    const analytics = checkoutAnalyticsContext();

    try {
      // Resize + provider probe in parallel — biggest win on phone camera uploads.
      const [provider, upload] = await Promise.all([
        ensureV2CheckoutAllowed(input.species),
        prepareV2CheckoutUpload(input.file),
      ]);
      if (!provider.allowed) {
        setInitError(provider.message);
        return;
      }

      setLoadingPhase("creating_order");
      const order = await api.createOrder({
        email: contact.email,
        petName: contact.petName,
        species: input.species,
        personality: PET_DEFAULT_PERSONALITY,
        photo: {
          fileName: upload.photo.fileName,
          contentType: upload.photo.contentType,
          byteSize: upload.photo.byteSize,
        },
        sku: "pet-secret-life-12",
        funnelVariant: "v2",
      });
      orderRef.current = { orderId: order.orderId, publicToken: order.publicToken };
      setOrderId(order.orderId);
      setPublicToken(order.publicToken);

      setLoadingPhase("uploading");
      const signed = await api.getSignedUploadUrl({
        orderId: order.orderId,
        publicToken: order.publicToken,
        contentType: upload.photo.contentType,
        fileName: upload.photo.fileName,
        byteSize: upload.photo.byteSize,
      });
      await uploadPhotoToSignedUrl(signed, upload.file);
      await api.confirmUpload({
        orderId: order.orderId,
        publicToken: order.publicToken,
        objectPath: signed.objectPath,
      });

      trackPetV2Event({
        eventName: "v2_checkout_session_requested",
        species: input.species,
        attemptId: order.orderId,
      });

      setLoadingPhase("creating_session");
      const checkout = await api.createStripeCheckout({
        orderId: order.orderId,
        publicToken: order.publicToken,
        successUrl: buildPetOrderReturnUrl(order.publicToken),
        cancelUrl: v2CancelUrl(input.species),
        customerEmail: contact.email,
        uiMode: V2_ELEMENTS_UI_MODE,
        ...analytics,
        funnelSessionId,
      });

      const result = {
        orderId: order.orderId,
        publicToken: order.publicToken,
        sessionId: checkout.sessionId,
        clientSecret: checkout.clientSecret,
        publishableKey: checkout.publishableKey,
        checkoutUrl: null as string | null,
        expiresAt: checkout.expiresAt,
        eventId: checkout.eventId,
        purchaseEventId: checkout.purchaseEventId,
        amountCents: checkout.amountCents,
        chargedAmountCents: checkout.chargedAmountCents,
        status: checkout.status,
        checkoutDiag: checkout.checkoutDiag,
      };

      if (result.status === "payment_processing" || result.status === "comped") {
        window.location.assign(`/pet/order?token=${encodeURIComponent(result.publicToken)}`);
        return;
      }

      const applied = applyCheckoutResult({
        result,
        holdExpiresAt: hold.expiresAt,
        species: input.species,
        funnelSessionId,
        setters,
      });
      if (applied) return;

      trackPetV2Event({
        eventName: "v2_checkout_failed",
        species: input.species,
        failureCategory: "checkout_error",
        attemptId: order.orderId,
      });
      setInitError(CHECKOUT_INIT_ERROR);
      setShowHostedFallback(true);
    } catch (caught) {
      trackPetV2Event({
        eventName: "v2_checkout_failed",
        species: input.species,
        failureCategory: "checkout_error",
        attemptId: orderRef.current?.orderId,
      });
      setInitError(CHECKOUT_INIT_ERROR);
      setShowHostedFallback(Boolean(orderRef.current));
      console.error("[v2-checkout-init]", caught instanceof Error ? caught.name : "error");
    } finally {
      bootstrapInFlight.current = false;
      setLoading(false);
      setLoadingPhase(null);
    }
  }, [api, input.active, input.file, input.photo, input.species, markExpired, recoverExistingOrderCheckout]);

  useEffect(() => {
    if (!input.active) return;
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void bootstrap();
  }, [input.active, bootstrap]);

  function invalidateStripeSession() {
    if (!elementsRetryUsed.current && orderRef.current) {
      elementsRetryUsed.current = true;
      clearCachedV2EmbeddedCheckout();
      setClientSecret(null);
      setPublishableKey(null);
      setSessionId(null);
      setInitError(null);
      setSessionExpired(false);
      setShowHostedFallback(false);
      void (async () => {
        setLoading(true);
        setLoadingPhase("creating_session");
        try {
          const recovered = await recoverExistingOrderCheckout();
          if (!recovered) {
            trackPetV2Event({
              eventName: "v2_checkout_failed",
              species: input.species,
              failureCategory: "checkout_error",
              attemptId: orderRef.current?.orderId,
            });
            setInitError(CHECKOUT_INIT_ERROR);
            setShowHostedFallback(true);
          }
        } catch {
          trackPetV2Event({
            eventName: "v2_checkout_failed",
            species: input.species,
            failureCategory: "checkout_error",
            attemptId: orderRef.current?.orderId,
          });
          setInitError(CHECKOUT_INIT_ERROR);
          setShowHostedFallback(true);
        } finally {
          setLoading(false);
          setLoadingPhase(null);
        }
      })();
      return;
    }
    clearCachedV2EmbeddedCheckout();
    setClientSecret(null);
    setPublishableKey(null);
    setSessionId(null);
    setInitError(CHECKOUT_INIT_ERROR);
    setSessionExpired(false);
    setShowHostedFallback(true);
  }

  function restartExpiredCheckout() {
    clearCachedV2EmbeddedCheckout();
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
    if (showHostedFallback || elementsRetryUsed.current) {
      setShowHostedFallback(true);
      return;
    }
    clearCachedV2EmbeddedCheckout();
    bootstrapped.current = false;
    bootstrapInFlight.current = false;
    setClientSecret(null);
    setPublishableKey(null);
    setSessionId(null);
    setInitError(null);
    setSessionExpired(false);

    bootstrapInFlight.current = true;
    setLoading(true);
    setLoadingPhase("creating_session");

    void (async () => {
      try {
        if (orderRef.current) {
          const recovered = await recoverExistingOrderCheckout();
          if (recovered) return;
          trackPetV2Event({
            eventName: "v2_checkout_failed",
            species: input.species,
            failureCategory: "checkout_error",
            attemptId: orderRef.current?.orderId,
          });
          setInitError(CHECKOUT_INIT_ERROR);
          setShowHostedFallback(true);
          return;
        }
        const recoverable = readRecoverableV2CheckoutOrder();
        if (recoverable) {
          orderRef.current = { orderId: recoverable.orderId, publicToken: recoverable.publicToken };
          const recovered = await recoverExistingOrderCheckout();
          if (recovered) return;
          trackPetV2Event({
            eventName: "v2_checkout_failed",
            species: input.species,
            failureCategory: "checkout_error",
            attemptId: recoverable.orderId,
          });
          setInitError(CHECKOUT_INIT_ERROR);
          setShowHostedFallback(true);
          return;
        }
        bootstrapped.current = true;
        await bootstrap();
      } catch {
        trackPetV2Event({
          eventName: "v2_checkout_failed",
          species: input.species,
          failureCategory: "checkout_error",
          attemptId: orderRef.current?.orderId,
        });
        setInitError(CHECKOUT_INIT_ERROR);
        setShowHostedFallback(true);
      } finally {
        bootstrapInFlight.current = false;
        setLoading(false);
        setLoadingPhase(null);
      }
    })();
  }

  async function startHostedFallback(opts?: {
    onSessionReady?: (session: { sessionId: string; checkoutUrl: string }) => void;
  }) {
    if (hostedFallbackBusy || hostedFallbackUsed.current) return;
    const existing =
      orderRef.current ||
      (orderId && publicToken ? { orderId, publicToken } : null) ||
      (() => {
        const recoverable = readRecoverableV2CheckoutOrder();
        return recoverable
          ? { orderId: recoverable.orderId, publicToken: recoverable.publicToken }
          : null;
      })();
    if (!existing) {
      setInitError(CHECKOUT_INIT_ERROR);
      return;
    }
    orderRef.current = existing;
    setHostedFallbackBusy(true);
    try {
      const analytics = checkoutAnalyticsContext();
      const funnelSessionId = getPetV2SessionId();
      const contact = v2BootstrapContact(funnelSessionId, input.species);

      trackPetV2Event({
        eventName: "v2_checkout_session_requested",
        species: input.species,
        attemptId: existing.orderId,
      });

      const checkout = await api.createStripeCheckout({
        orderId: existing.orderId,
        publicToken: existing.publicToken,
        successUrl: buildPetOrderReturnUrl(existing.publicToken),
        cancelUrl: v2CancelUrl(input.species),
        customerEmail: contact.email,
        uiMode: "hosted",
        ...analytics,
        funnelSessionId,
      });
      const url = String(checkout.checkoutUrl || "").trim();
      if (!url.startsWith("https://checkout.stripe.com/") || !checkout.sessionId) {
        trackPetV2Event({
          eventName: "v2_checkout_failed",
          species: input.species,
          failureCategory: "checkout_error",
          attemptId: existing.orderId,
        });
        setInitError(CHECKOUT_INIT_ERROR);
        return;
      }
      opts?.onSessionReady?.({ sessionId: checkout.sessionId, checkoutUrl: url });
      hostedFallbackUsed.current = true;
      window.location.assign(url);
    } catch {
      trackPetV2Event({
        eventName: "v2_checkout_failed",
        species: input.species,
        failureCategory: "checkout_error",
        attemptId: existing.orderId,
      });
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
    amountCents,
    loading,
    loadingPhase,
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

export { validateAndUpdateV2OrderContact, V2_CONTACT_UPDATE_ERROR } from "./v2ContactUpdate";
