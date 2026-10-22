import { useCallback, useEffect, useRef, useState } from "react";
import {
  attributionParamsForInternal,
  captureFunnelAttribution,
} from "../pet/funnelAttribution";
import { isValidEmbeddedClientSecret, publishableKeyMatchesClientSecret } from "../pet/funnelGuards";
import { getMetaCapiClickIds } from "../pet/metaCookies";
import { trackChristmasV2Event } from "./analytics";
import {
  christmasFunnelApi,
  uploadChristmasPhotoToSignedUrl,
  ChristmasApiError,
} from "./api";
import {
  CHRISTMAS_PACKS,
  CHRISTMAS_V2_ORDER_ROUTE,
  CHRISTMAS_V2_ROUTE,
  type ChristmasPackKey,
} from "./config";
import { prepareChristmasCheckoutUpload } from "./photo";
import { getChristmasV2SessionId } from "./session";
import { CHRISTMAS_CHECKOUT_FAILED_COPY, type ChristmasPhotoMeta } from "./types";

export type ChristmasCheckoutState = {
  clientSecret: string | null;
  publishableKey: string | null;
  orderId: string | null;
  publicToken: string | null;
  sessionId: string | null;
  checkoutUrl: string | null;
  amountCents: number;
  loading: boolean;
  initError: string | null;
  checkoutReady: boolean;
  retry: () => void;
};

function placeholderEmail(sessionId: string) {
  return `pending+${sessionId.slice(0, 8)}@checkout.thedigitalgifter.com`;
}

export function useChristmasEmbeddedCheckout(input: {
  active: boolean;
  photo: ChristmasPhotoMeta | null;
  file: File | null;
  email: string;
  customerName: string;
  packKey?: ChristmasPackKey;
}): ChristmasCheckoutState {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const packKey = input.packKey || "starter";
  const [amountCents, setAmountCents] = useState(CHRISTMAS_PACKS[packKey].priceCents);
  const [loading, setLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const bootRef = useRef(0);

  const bootstrap = useCallback(async () => {
    if (!input.active || !input.photo || !input.file) return;
    const bootId = ++bootRef.current;
    const selectedPack = CHRISTMAS_PACKS[input.packKey || "starter"];
    setLoading(true);
    setInitError(null);
    setAmountCents(selectedPack.priceCents);
    try {
      captureFunnelAttribution();
      const funnelSessionId = getChristmasV2SessionId();
      trackChristmasV2Event({
        eventName: "christmas_v2_checkout_started",
        amountCents: selectedPack.priceCents,
        product: selectedPack.sku,
        attemptId: String(bootId),
      });

      const prepared = await prepareChristmasCheckoutUpload(input.file);
      const contactEmail = input.email.trim() || placeholderEmail(funnelSessionId);
      // Omit sceneKeys so the server applies defaultSceneKeysForPack(packKey).
      const order = await christmasFunnelApi.createOrder({
        email: contactEmail,
        customerName: input.customerName.trim() || undefined,
        photo: prepared.meta,
        packKey: selectedPack.key,
        funnelSessionId,
      });
      if (bootId !== bootRef.current) return;

      const signed = await christmasFunnelApi.getSignedUploadUrl({
        orderId: order.orderId,
        publicToken: order.publicToken,
        contentType: prepared.meta.contentType,
        byteSize: prepared.blob.size,
        fileName: prepared.meta.fileName,
      });
      await uploadChristmasPhotoToSignedUrl(signed.uploadUrl, prepared.blob, prepared.meta.contentType);
      await christmasFunnelApi.confirmUpload({
        orderId: order.orderId,
        publicToken: order.publicToken,
        objectPath: signed.objectPath,
      });

      if (input.email.trim() && input.email.includes("@")) {
        await christmasFunnelApi.updateOrderContact({
          orderId: order.orderId,
          publicToken: order.publicToken,
          email: input.email.trim().toLowerCase(),
          customerName: input.customerName.trim() || undefined,
        });
      }

      const origin = window.location.origin;
      const metaClick = getMetaCapiClickIds();
      const checkout = await christmasFunnelApi.createStripeCheckout({
        orderId: order.orderId,
        publicToken: order.publicToken,
        uiMode: "elements",
        successUrl: `${origin}${CHRISTMAS_V2_ORDER_ROUTE}?token=${encodeURIComponent(order.publicToken)}&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}${CHRISTMAS_V2_ROUTE}?checkout=canceled`,
        funnelSessionId,
        attribution: attributionParamsForInternal(),
        fbc: metaClick.fbc,
        fbp: metaClick.fbp,
        metaClick: { fbc: metaClick.fbc, fbp: metaClick.fbp },
      });
      if (bootId !== bootRef.current) return;

      if (
        !isValidEmbeddedClientSecret(checkout.clientSecret, checkout.sessionId) ||
        !String(checkout.publishableKey || "").startsWith("pk_") ||
        !publishableKeyMatchesClientSecret(checkout.publishableKey, checkout.clientSecret)
      ) {
        throw new ChristmasApiError("CHECKOUT_INVALID", CHRISTMAS_CHECKOUT_FAILED_COPY, 502);
      }

      setOrderId(checkout.orderId);
      setPublicToken(checkout.publicToken);
      setSessionId(checkout.sessionId);
      setClientSecret(checkout.clientSecret || null);
      setPublishableKey(checkout.publishableKey || null);
      setCheckoutUrl(checkout.checkoutUrl || null);
      setAmountCents(checkout.amountCents || selectedPack.priceCents);
    } catch (err) {
      if (bootId !== bootRef.current) return;
      const message =
        err instanceof ChristmasApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : CHRISTMAS_CHECKOUT_FAILED_COPY;
      setInitError(message);
      trackChristmasV2Event({
        eventName: "christmas_v2_checkout_failed",
        failureCategory: "checkout_error",
        attemptId: String(bootId),
      });
    } finally {
      if (bootId === bootRef.current) setLoading(false);
    }
  }, [input.active, input.photo, input.file, input.email, input.customerName, input.packKey]);

  useEffect(() => {
    if (!input.active) return;
    void bootstrap();
  }, [input.active, bootstrap]);

  return {
    clientSecret,
    publishableKey,
    orderId,
    publicToken,
    sessionId,
    checkoutUrl,
    amountCents,
    loading,
    initError,
    checkoutReady: Boolean(clientSecret && publishableKey && sessionId),
    retry: () => void bootstrap(),
  };
}
