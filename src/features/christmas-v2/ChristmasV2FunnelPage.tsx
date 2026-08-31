import { useEffect, useId, useRef, useState } from "react";
import { PageHead } from "@/components/PageHead";
import { trackMetaInitiateCheckout } from "@/lib/metaPixel";
import { trackChristmasV2Event } from "./analytics";
import {
  christmasFunnelApi,
  type ChristmasSceneResult,
  type ChristmasVideoResult,
} from "./api";
import { ChristmasV2Shell } from "./ChristmasV2Shell";
import {
  CHRISTMAS_PACKS,
  CHRISTMAS_V2_ORDER_ROUTE,
  CHRISTMAS_V2_ROUTE,
  type ChristmasSceneKey,
} from "./config";
import { createChristmasLocalPreview, validateChristmasPhotoFile } from "./photo";
import { ChristmasCheckoutScreen } from "./screens/CheckoutScreen";
import { ChristmasGeneratingScreen } from "./screens/GeneratingScreen";
import { ChristmasLandingScreen } from "./screens/LandingScreen";
import { ChristmasOfferScreen } from "./screens/OfferScreen";
import { ChristmasResultsScreen } from "./screens/ResultsScreen";
import { ChristmasUpsellScreen } from "./screens/UpsellScreen";
import {
  getChristmasPhotoFile,
  getChristmasPhotoObjectUrl,
  loadChristmasDraft,
  saveChristmasDraft,
  setChristmasPhotoFile,
} from "./storage";
import type { ChristmasV2Draft, ChristmasV2Step } from "./types";
import { useChristmasEmbeddedCheckout } from "./useChristmasEmbeddedCheckout";

function cryptoRandomId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function ChristmasV2FunnelPage() {
  const fileInputId = useId();
  const [draft, setDraft] = useState<ChristmasV2Draft>(() => loadChristmasDraft());
  const [photoError, setPhotoError] = useState<string | undefined>();
  const previewUrl = getChristmasPhotoObjectUrl() ?? draft.photoPreviewDataUrl;

  const checkoutActive = draft.step === "checkout";
  const checkout = useChristmasEmbeddedCheckout({
    active: checkoutActive && Boolean(draft.photo) && Boolean(getChristmasPhotoFile()),
    photo: draft.photo,
    file: getChristmasPhotoFile(),
    email: draft.email,
    customerName: draft.customerName,
    packKey: "starter",
  });

  useEffect(() => {
    const id = "christmas-v2-fonts";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap";
      document.head.appendChild(link);
    }
    trackChristmasV2Event({ eventName: "christmas_v2_view" });
  }, []);

  useEffect(() => {
    saveChristmasDraft(draft);
  }, [draft]);

  useEffect(() => {
    if (!checkout.orderId || !checkout.publicToken) return;
    if (draft.orderId === checkout.orderId && draft.publicToken === checkout.publicToken) return;
    setDraft((current) => ({
      ...current,
      orderId: checkout.orderId,
      publicToken: checkout.publicToken,
    }));
  }, [checkout.orderId, checkout.publicToken, draft.orderId, draft.publicToken]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "canceled") return;
    trackChristmasV2Event({ eventName: "christmas_v2_checkout_canceled" });
    go("offer");
    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    window.history.replaceState({}, "", url.pathname + url.search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function go(step: ChristmasV2Step, patch: Partial<ChristmasV2Draft> = {}) {
    setDraft((current) => ({ ...current, ...patch, step }));
  }

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    trackChristmasV2Event({ eventName: "christmas_v2_upload_started" });
    const check = validateChristmasPhotoFile(file);
    if (!check.ok) {
      setPhotoError(check.message);
      trackChristmasV2Event({
        eventName: "christmas_v2_upload_failed",
        failureCategory: "invalid_image",
      });
      return;
    }
    try {
      const preview = await createChristmasLocalPreview(file);
      setChristmasPhotoFile(file);
      setPhotoError(undefined);
      trackChristmasV2Event({ eventName: "christmas_v2_upload_completed" });
      go("offer", {
        photo: {
          fileName: file.name,
          contentType: check.contentType,
          byteSize: file.size,
        },
        uploadId: cryptoRandomId(),
        photoPreviewDataUrl: preview,
        lastError: null,
      });
      trackChristmasV2Event({
        eventName: "christmas_v2_offer_viewed",
        amountCents: CHRISTMAS_PACKS.starter.priceCents,
        product: CHRISTMAS_PACKS.starter.sku,
      });
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Could not read that photo.");
      trackChristmasV2Event({
        eventName: "christmas_v2_upload_failed",
        failureCategory: "invalid_image",
      });
    }
  }

  const showBack = draft.step !== "landing" && draft.step !== "generating";

  return (
    <>
      <PageHead
        title="AI Christmas Photos – Turn Your Photo Into Christmas Magic | Digital Gifter"
        description="Upload one portrait and get 3 premium AI Christmas photos for $3. Perfect for cards, gifts, and social posts. Secure checkout, no subscription."
        url={`https://www.thedigitalgifter.com${CHRISTMAS_V2_ROUTE}`}
        image="https://www.thedigitalgifter.com/assets/funnel/christmas-after.png"
        exactTitle
      />
      <ChristmasV2Shell
        showBack={showBack}
        onBack={() => {
          if (draft.step === "checkout") go("offer");
          else if (draft.step === "offer") go("landing");
        }}
        padForSticky={draft.step === "landing"}
      >
        <input
          id={fileInputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          className="sr-only"
          onChange={(e) => void handleFiles(e.target.files)}
        />

        {draft.step === "landing" ? (
          <ChristmasLandingScreen
            onFile={(files) => void handleFiles(files)}
            photoError={photoError}
            previewUrl={previewUrl}
          />
        ) : null}

        {draft.step === "offer" ? (
          <ChristmasOfferScreen
            previewUrl={previewUrl}
            onContinue={() => go("checkout")}
            onChangePhoto={() => {
              setChristmasPhotoFile(null);
              go("landing", { photo: null, photoPreviewDataUrl: null, uploadId: null });
            }}
          />
        ) : null}

        {draft.step === "checkout" ? (
          <ChristmasCheckoutScreen
            clientSecret={checkout.clientSecret}
            publishableKey={checkout.publishableKey}
            publicToken={checkout.publicToken}
            sessionId={checkout.sessionId}
            email={draft.email}
            onEmail={(email) => setDraft((c) => ({ ...c, email }))}
            customerName={draft.customerName}
            onCustomerName={(customerName) => setDraft((c) => ({ ...c, customerName }))}
            loading={checkout.loading}
            initError={checkout.initError}
            onRetry={checkout.retry}
            hostedFallbackUrl={checkout.checkoutUrl}
            onReady={() =>
              trackChristmasV2Event({
                eventName: "christmas_v2_checkout_rendered",
                amountCents: checkout.amountCents,
                product: CHRISTMAS_PACKS.starter.sku,
              })
            }
            onPaymentInteraction={() => {
              trackMetaInitiateCheckout({
                eventId: checkout.sessionId || checkout.orderId || `cv2_${Date.now()}`,
                valueCents: checkout.amountCents,
                orderId: checkout.orderId || undefined,
              });
            }}
            onSubmit={() =>
              trackChristmasV2Event({
                eventName: "christmas_v2_payment_submitted",
                amountCents: checkout.amountCents,
                product: CHRISTMAS_PACKS.starter.sku,
              })
            }
            onExpressCancel={() =>
              trackChristmasV2Event({ eventName: "christmas_v2_checkout_canceled" })
            }
          />
        ) : null}

        {draft.step === "generating" ? <ChristmasGeneratingScreen /> : null}
      </ChristmasV2Shell>
    </>
  );
}

export function ChristmasV2OrderPage() {
  const [status, setStatus] = useState<"loading" | "generating" | "results" | "upsell" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [scenes, setScenes] = useState<ChristmasSceneResult[]>([]);
  const [videos, setVideos] = useState<ChristmasVideoResult[]>([]);
  const [progress, setProgress] = useState(10);
  const [publicToken, setPublicToken] = useState("");
  const [busyPack, setBusyPack] = useState<"magic" | "ultimate" | null>(null);
  const purchaseTracked = useRef(false);
  const resultsTracked = useRef(false);

  useEffect(() => {
    const id = "christmas-v2-fonts";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") || "";
    if (!token) {
      setError("Missing order token.");
      setStatus("error");
      return;
    }
    setPublicToken(token);
    let cancelled = false;

    async function poll() {
      try {
        const data = await christmasFunnelApi.pollGenerationProgress({ publicToken: token });
        if (cancelled) return;
        setScenes(data.scenes);
        setVideos(data.videos);
        setProgress(data.progressPercent || 10);

        if (
          !purchaseTracked.current &&
          ["paid", "generating", "complete", "awaiting_qc"].includes(data.order.status)
        ) {
          purchaseTracked.current = true;
          trackChristmasV2Event({
            eventName: "christmas_v2_purchase",
            amountCents: data.order.amountCents,
            product: CHRISTMAS_PACKS[data.order.packKey]?.sku || data.order.packKey,
          });
          trackChristmasV2Event({
            eventName: "christmas_v2_generation_started",
            product: CHRISTMAS_PACKS[data.order.packKey]?.sku || data.order.packKey,
          });
        }

        const done =
          data.order.status === "complete" ||
          (data.progressPercent >= 100 && data.scenes.some((s) => s.imageUrl));
        if (done) {
          setStatus((current) => (current === "upsell" ? "upsell" : "results"));
          if (!resultsTracked.current) {
            resultsTracked.current = true;
            trackChristmasV2Event({
              eventName: "christmas_v2_generation_completed",
              product: CHRISTMAS_PACKS[data.order.packKey]?.sku || data.order.packKey,
            });
            trackChristmasV2Event({ eventName: "christmas_v2_results_viewed" });
          }
          return;
        }
        setStatus("generating");
        window.setTimeout(() => void poll(), 2500);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load your Christmas order.");
        setStatus("error");
      }
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleUpsellCheckout(input: {
    packKey: "magic" | "ultimate";
    sceneKeys: ChristmasSceneKey[];
    videoSourceSceneKeys: ChristmasSceneKey[];
    surpriseMe: boolean;
  }) {
    if (!publicToken) return;
    setBusyPack(input.packKey);
    try {
      trackChristmasV2Event({
        eventName:
          input.packKey === "magic"
            ? "christmas_v2_magic_pack_checkout"
            : "christmas_v2_ultimate_pack_checkout",
        amountCents: CHRISTMAS_PACKS[input.packKey].priceCents,
        product: CHRISTMAS_PACKS[input.packKey].sku,
      });
      const parent = await christmasFunnelApi.getOrderByPublicToken({ publicToken });
      const checkout = await christmasFunnelApi.createUpsellCheckout({
        parentOrderId: parent.order.orderId,
        publicToken,
        packKey: input.packKey,
        sceneKeys: input.sceneKeys,
        videoSourceSceneKeys: input.videoSourceSceneKeys,
        surpriseMe: input.surpriseMe,
        uiMode: "hosted",
        successUrl: `${window.location.origin}${CHRISTMAS_V2_ORDER_ROUTE}?token={PUBLIC_TOKEN}&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}${CHRISTMAS_V2_ORDER_ROUTE}?token=${encodeURIComponent(publicToken)}&upsell=canceled`,
      });
      if (checkout.checkoutUrl) {
        window.location.href = checkout.checkoutUrl;
        return;
      }
      setError("Could not start upsell checkout.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upsell checkout failed.");
    } finally {
      setBusyPack(null);
    }
  }

  return (
    <>
      <PageHead
        title="Your Christmas AI Photos | Digital Gifter"
        description="View your AI Christmas portraits and unlock more holiday scenarios."
        exactTitle
      />
      <ChristmasV2Shell>
        {status === "loading" || status === "generating" ? (
          <ChristmasGeneratingScreen progressPercent={progress} />
        ) : null}
        {status === "results" ? (
          <ChristmasResultsScreen
            scenes={scenes}
            videos={videos}
            onContinueUpsell={() => {
              trackChristmasV2Event({ eventName: "christmas_v2_upsell_viewed" });
              setStatus("upsell");
            }}
          />
        ) : null}
        {status === "upsell" ? (
          <div className="space-y-8">
            <ChristmasResultsScreen scenes={scenes} videos={videos} />
            <ChristmasUpsellScreen
              starterScenes={scenes}
              busyPack={busyPack}
              onCheckout={(input) => void handleUpsellCheckout(input)}
            />
          </div>
        ) : null}
        {status === "error" ? (
          <div className="space-y-3 text-center">
            <h1 className="cv2-display text-3xl font-semibold text-[#F7F0E4]">Something went wrong</h1>
            <p className="text-sm text-[#F7F0E4]/70">{error}</p>
            <a className="text-[#C9A227] underline" href={CHRISTMAS_V2_ROUTE}>
              Back to Christmas offer
            </a>
          </div>
        ) : null}
      </ChristmasV2Shell>
    </>
  );
}
