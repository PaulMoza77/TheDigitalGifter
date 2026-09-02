import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { CustomStripeCheckout } from "@/features/pet/components/CustomStripeCheckout";
import { captureFunnelAttribution, attributionParamsForInternal } from "@/features/pet/funnelAttribution";
import { trackChristmasEvent, getChristmasFunnelSessionId } from "./analytics";
import {
  CHRISTMAS_CATALOG_SEED,
  findProduct,
  ctaStateForProduct,
} from "./catalog";
import {
  createChristmasUpload,
  getChristmasOrderByToken,
  startChristmasCheckout,
  uploadChristmasBlob,
} from "./photoApi";
import {
  createBlurredOriginalPreview,
  christmasPreviewUsesReplicate,
  validateChristmasPhotoFile,
} from "./photoPreview";
import {
  CHRISTMAS_PHOTO_DRAFT_KEY,
  CHRISTMAS_PHOTO_PACKAGE_KEY,
  CHRISTMAS_PHOTO_PRODUCT_KEY,
  emptyChristmasPhotoDraft,
  type ChristmasPhotoDraft,
  type ChristmasPhotoStep,
} from "./photoTypes";
import { enabledChristmasStyles } from "./styles";

function readDraft(): ChristmasPhotoDraft {
  try {
    const raw = sessionStorage.getItem(CHRISTMAS_PHOTO_DRAFT_KEY);
    if (!raw) return emptyChristmasPhotoDraft();
    return { ...emptyChristmasPhotoDraft(), ...JSON.parse(raw) };
  } catch {
    return emptyChristmasPhotoDraft();
  }
}

function writeDraft(draft: ChristmasPhotoDraft) {
  try {
    sessionStorage.setItem(
      CHRISTMAS_PHOTO_DRAFT_KEY,
      JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }),
    );
  } catch {
    /* ignore */
  }
}

export default function ChristmasPhotoGeneratorPage() {
  const [params] = useSearchParams();
  const [draft, setDraft] = useState<ChristmasPhotoDraft>(() => readDraft());
  const [busy, setBusy] = useState(false);
  const [checkout, setCheckout] = useState<{
    clientSecret: string;
    publishableKey: string;
    amountCents: number;
    currency: string;
  } | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [purchasable, setPurchasable] = useState(false);
  const [catalogAmount, setCatalogAmount] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileBlobRef = useRef<Blob | null>(null);
  const pageViewed = useRef(false);
  const styles = useMemo(() => enabledChristmasStyles(), []);
  const product = findProduct(CHRISTMAS_CATALOG_SEED, CHRISTMAS_PHOTO_PRODUCT_KEY);

  const setStep = useCallback((step: ChristmasPhotoStep, patch?: Partial<ChristmasPhotoDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch, step, lastError: patch?.lastError ?? null };
      writeDraft(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (pageViewed.current) return;
    pageViewed.current = true;
    captureFunnelAttribution(window.location.search);
    void trackChristmasEvent("christmas_page_view", {
      productKey: CHRISTMAS_PHOTO_PRODUCT_KEY,
      pathname: "/christmas/photo-generator",
    });
  }, []);

  useEffect(() => {
    const pkg = product?.packages.find((p) => p.packageKey === CHRISTMAS_PHOTO_PACKAGE_KEY);
    setPurchasable(Boolean(pkg?.purchasable && pkg.priceCents > 0));
    setCatalogAmount(pkg?.purchasable && pkg.priceCents > 0 ? pkg.priceCents : null);
  }, [product]);

  // Recovery via token
  useEffect(() => {
    const token = params.get("token");
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        setBusy(true);
        const { order } = await getChristmasOrderByToken(token);
        if (cancelled) return;
        setDraft((prev) => {
          const next = {
            ...prev,
            orderId: order.id,
            publicToken: token,
            styleKey: order.style_key,
            step:
              order.fulfillment_status === "completed"
                ? ("result" as const)
                : order.payment_status === "paid"
                  ? ("generating" as const)
                  : prev.step,
          };
          writeDraft(next);
          return next;
        });
        if (order.resultUrl) setResultUrl(order.resultUrl);
        if (order.payment_status === "paid" && order.fulfillment_status !== "completed") {
          setStep("generating", { orderId: order.id, publicToken: token });
        }
      } catch (err) {
        if (!cancelled) {
          setStep("error", {
            lastError: err instanceof Error ? err.message : "Could not recover order",
          });
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params, setStep]);

  // Poll while generating
  useEffect(() => {
    if (draft.step !== "generating" || !draft.publicToken) return;
    let stop = false;
    const tick = async () => {
      try {
        const { order } = await getChristmasOrderByToken(draft.publicToken!);
        if (stop) return;
        if (order.fulfillment_status === "completed" && order.resultUrl) {
          setResultUrl(order.resultUrl);
          setStep("result");
          void trackChristmasEvent("generation_success", {
            productKey: CHRISTMAS_PHOTO_PRODUCT_KEY,
            orderId: order.id,
            styleKey: order.style_key,
          });
          return;
        }
        if (order.fulfillment_status === "failed") {
          setStep("error", { lastError: order.last_error || "Generation failed" });
          void trackChristmasEvent("generation_failed", {
            productKey: CHRISTMAS_PHOTO_PRODUCT_KEY,
            orderId: order.id,
          });
        }
      } catch {
        /* keep polling */
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 4000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [draft.step, draft.publicToken, setStep]);

  async function onFileChosen(file: File | null) {
    if (!file) return;
    void trackChristmasEvent("upload_started", { productKey: CHRISTMAS_PHOTO_PRODUCT_KEY });
    setBusy(true);
    try {
      const validation = await validateChristmasPhotoFile(file);
      if (!validation.ok) {
        setStep("upload", { lastError: validation.message });
        return;
      }
      const localUrl = URL.createObjectURL(file);
      fileBlobRef.current = file;
      const upload = await createChristmasUpload({
        contentType: validation.contentType,
        byteSize: file.size,
        width: validation.width,
        height: validation.height,
      });
      if (upload.replicate_preview !== false) {
        throw new Error("Preview contract violated");
      }
      await uploadChristmasBlob(upload.signedUrl, upload.token, file, validation.contentType);
      setStep("style", {
        localPreviewUrl: localUrl,
        uploadId: upload.uploadId,
        sourcePath: upload.path,
        sourceContentType: validation.contentType,
        sourceWidth: validation.width,
        sourceHeight: validation.height,
        blurredPreviewUrl: null,
      });
      void trackChristmasEvent("upload_completed", { productKey: CHRISTMAS_PHOTO_PRODUCT_KEY });
    } catch (err) {
      setStep("upload", {
        lastError: err instanceof Error ? err.message : "Upload failed",
      });
    } finally {
      setBusy(false);
    }
  }

  async function onStyleSelected(styleKey: string) {
    if (!draft.sourcePath || !fileBlobRef.current && !draft.localPreviewUrl) {
      setStep("upload", { lastError: "Please upload a photo first." });
      return;
    }
    setBusy(true);
    void trackChristmasEvent("style_selected", {
      productKey: CHRISTMAS_PHOTO_PRODUCT_KEY,
      styleKey,
    });
    try {
      const source =
        fileBlobRef.current ||
        (draft.localPreviewUrl ? await fetch(draft.localPreviewUrl).then((r) => r.blob()) : null);
      if (!source) throw new Error("Missing photo");
      // CRITICAL: local blur only — zero Replicate.
      const preview = await createBlurredOriginalPreview(source, { blurPx: 32 });
      if (preview.replicateCalls !== 0 || christmasPreviewUsesReplicate()) {
        throw new Error("Preview must not call Replicate");
      }
      setStep("preview", {
        styleKey,
        blurredPreviewUrl: preview.dataUrl,
      });
      void trackChristmasEvent("preview_seen", {
        productKey: CHRISTMAS_PHOTO_PRODUCT_KEY,
        styleKey,
      });
    } catch (err) {
      setStep("style", {
        lastError: err instanceof Error ? err.message : "Could not create preview",
      });
    } finally {
      setBusy(false);
    }
  }

  function goOffer() {
    setStep("offer");
    void trackChristmasEvent("offer_seen", {
      productKey: CHRISTMAS_PHOTO_PRODUCT_KEY,
      styleKey: draft.styleKey,
      packageKey: CHRISTMAS_PHOTO_PACKAGE_KEY,
      amountCents: catalogAmount,
    });
  }

  async function startCheckout() {
    if (!purchasable) {
      setStep("offer", {
        lastError: "Checkout is not enabled yet — production price is not configured.",
      });
      return;
    }
    if (!draft.styleKey || !draft.sourcePath) {
      setStep("upload", { lastError: "Upload and style are required." });
      return;
    }
    setBusy(true);
    void trackChristmasEvent("checkout_started", {
      productKey: CHRISTMAS_PHOTO_PRODUCT_KEY,
      styleKey: draft.styleKey,
      packageKey: CHRISTMAS_PHOTO_PACKAGE_KEY,
    });
    try {
      captureFunnelAttribution(window.location.search);
      const attr = attributionParamsForInternal();
      const result = await startChristmasCheckout({
        product_key: CHRISTMAS_PHOTO_PRODUCT_KEY,
        package_key: CHRISTMAS_PHOTO_PACKAGE_KEY,
        // Tamper attempt — server must ignore:
        amount_cents: 1,
        currency: "eur",
        email: draft.email || undefined,
        style_key: draft.styleKey,
        source_path: draft.sourcePath,
        source_bucket: "christmas-source",
        source_content_type: draft.sourceContentType,
        source_width: draft.sourceWidth,
        source_height: draft.sourceHeight,
        existing_order_id: draft.orderId,
        funnel_session_id: getChristmasFunnelSessionId(),
        landing_path: `${window.location.pathname}${window.location.search}`.slice(0, 120),
        utm_source: attr.utm_source,
        utm_medium: attr.utm_medium,
        utm_campaign: attr.utm_campaign,
        utm_content: attr.utm_content,
        utm_term: attr.utm_term,
        campaign_id: attr.campaign_id,
        adset_id: attr.adset_id,
        ad_id: attr.ad_id,
        success_url: `${window.location.origin}/christmas/photo-generator?checkout=success`,
      });
      setCheckout({
        clientSecret: result.clientSecret,
        publishableKey: result.publishableKey,
        amountCents: result.amountCents,
        currency: result.currency,
      });
      setStep("checkout", {
        orderId: result.orderId,
        publicToken: result.publicToken,
      });
      void trackChristmasEvent("payment_sheet_opened", {
        productKey: CHRISTMAS_PHOTO_PRODUCT_KEY,
        orderId: result.orderId,
        amountCents: result.amountCents,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Checkout failed";
      setStep("offer", { lastError: message });
    } finally {
      setBusy(false);
    }
  }

  async function onDownload() {
    if (!resultUrl || !draft.orderId) return;
    void trackChristmasEvent("download", {
      productKey: CHRISTMAS_PHOTO_PRODUCT_KEY,
      orderId: draft.orderId,
    });
    const res = await fetch(resultUrl);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `tdg-christmas-portrait-${draft.orderId.slice(0, 8)}.jpg`;
    a.click();
    URL.revokeObjectURL(objectUrl);
  }

  async function onShare() {
    if (!resultUrl) return;
    void trackChristmasEvent("share", {
      productKey: CHRISTMAS_PHOTO_PRODUCT_KEY,
      orderId: draft.orderId,
    });
    try {
      const res = await fetch(resultUrl);
      const blob = await res.blob();
      const file = new File([blob], `tdg-christmas-portrait.jpg`, { type: blob.type || "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "My Christmas portrait",
          text: "Made with The Digital Gifter",
        });
        return;
      }
    } catch {
      /* fall through */
    }
    if (navigator.share) {
      await navigator.share({ title: "My Christmas portrait", url: window.location.href });
    }
  }

  const styleName = styles.find((s) => s.styleKey === draft.styleKey)?.displayName;

  return (
    <>
      <PageHead
        title="Christmas AI Photo Generator"
        description="Turn your photo into a personalized Christmas portrait. Private by default."
      />
      <main className="mx-auto min-h-[70vh] max-w-lg px-4 py-8 text-slate-900">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          The Digital Gifter · Christmas
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Turn your photo into a Christmas portrait
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Upload a photo, pick a style, preview a blurred look of your own image, then unlock the
          finished portrait after payment. Your result stays private unless you share it.
        </p>

        {draft.lastError ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {draft.lastError}
          </p>
        ) : null}

        {(draft.step === "intro" || draft.step === "upload") && (
          <section className="mt-8 space-y-4">
            <button
              type="button"
              className="w-full rounded-md bg-slate-900 px-4 py-3 text-sm font-medium text-white"
              onClick={() => {
                setStep("upload");
                fileRef.current?.click();
              }}
              disabled={busy}
            >
              {busy ? "Working…" : "Upload your photo"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => void onFileChosen(e.target.files?.[0] || null)}
            />
            <p className="text-xs text-slate-500">JPEG, PNG, or WebP · under 15 MB · HEIC not supported yet</p>
          </section>
        )}

        {draft.step === "style" && (
          <section className="mt-8">
            {draft.localPreviewUrl ? (
              <img
                src={draft.localPreviewUrl}
                alt="Your upload"
                className="mb-4 max-h-48 w-full rounded-lg object-cover"
              />
            ) : null}
            <h2 className="text-lg font-medium">Choose a Christmas style</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {styles.map((style) => (
                <button
                  key={style.styleKey}
                  type="button"
                  className="rounded-lg border border-slate-200 p-3 text-left hover:border-slate-400"
                  style={{ borderTopColor: style.accent, borderTopWidth: 3 }}
                  disabled={busy}
                  onClick={() => void onStyleSelected(style.styleKey)}
                >
                  <div className="text-sm font-medium">{style.displayName}</div>
                  <div className="mt-1 text-xs text-slate-500">{style.description}</div>
                </button>
              ))}
            </div>
          </section>
        )}

        {draft.step === "preview" && draft.blurredPreviewUrl && (
          <section className="mt-8 space-y-4">
            <img
              src={draft.blurredPreviewUrl}
              alt="Blurred preview of your photo"
              className="w-full rounded-lg"
            />
            <p className="text-sm text-slate-600">
              Your Christmas transformation is ready to create. This preview is your original photo,
              heavily blurred — the finished AI portrait unlocks after payment.
            </p>
            <button
              type="button"
              className="w-full rounded-md bg-slate-900 px-4 py-3 text-sm font-medium text-white"
              onClick={goOffer}
            >
              Continue to offer
            </button>
          </section>
        )}

        {draft.step === "offer" && (
          <section className="mt-8 space-y-4">
            <h2 className="text-lg font-medium">Unlock your Christmas portrait</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
              <li>Style: {styleName || draft.styleKey}</li>
              <li>One personalized Christmas portrait</li>
              <li>Usually ready a few minutes after payment</li>
              <li>Private by default · download anytime via your order link</li>
            </ul>
            <label className="block text-sm">
              Email for receipt / recovery (optional)
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                type="email"
                value={draft.email}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
              />
            </label>
            {purchasable && catalogAmount != null ? (
              <button
                type="button"
                className="w-full rounded-md bg-slate-900 px-4 py-3 text-sm font-medium text-white"
                disabled={busy}
                onClick={() => void startCheckout()}
              >
                {busy
                  ? "Preparing checkout…"
                  : `Pay ${(catalogAmount / 100).toFixed(2)} ${product?.packages[0]?.currency?.toUpperCase() || "USD"}`}
              </button>
            ) : (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Production checkout is not enabled yet (price not configured / not purchasable). The
                upload → blur preview flow works; payment stays disabled until launch configuration.
              </p>
            )}
            <p className="text-xs text-slate-500">
              Product status: {ctaStateForProduct(product!)} · Apple Pay / Google Pay / card when checkout
              is enabled
            </p>
          </section>
        )}

        {draft.step === "checkout" && checkout && (
          <section className="mt-8 space-y-4">
            <h2 className="text-lg font-medium">Secure payment</h2>
            <CustomStripeCheckout
              clientSecret={checkout.clientSecret}
              publishableKey={checkout.publishableKey}
              dueDisplay={`$${(checkout.amountCents / 100).toFixed(2)}`}
              returnUrl={`${window.location.origin}/christmas/photo-generator?checkout=success&token=${encodeURIComponent(draft.publicToken || "")}`}
              email={draft.email}
              onReady={() => {
                void trackChristmasEvent("payment_sheet_opened", {
                  productKey: CHRISTMAS_PHOTO_PRODUCT_KEY,
                  orderId: draft.orderId,
                  amountCents: checkout.amountCents,
                });
              }}
            />
          </section>
        )}

        {draft.step === "generating" && (
          <section className="mt-8 space-y-3 text-sm text-slate-600">
            <h2 className="text-lg font-medium text-slate-900">Creating your portrait</h2>
            <p>Payment confirmed</p>
            <p>Preparing photo</p>
            <p>Creating Christmas portrait…</p>
            <p className="text-xs">You can close this page — reopen your order link anytime.</p>
          </section>
        )}

        {draft.step === "result" && resultUrl && (
          <section className="mt-8 space-y-4">
            <img src={resultUrl} alt="Your Christmas portrait" className="w-full rounded-lg" />
            <p className="text-sm text-slate-600">Style: {styleName || draft.styleKey}</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="rounded-md bg-slate-900 px-4 py-3 text-sm font-medium text-white"
                onClick={() => void onDownload()}
              >
                Download
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-300 px-4 py-3 text-sm font-medium"
                onClick={() => void onShare()}
              >
                Share
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-300 px-4 py-3 text-sm font-medium"
                onClick={() => {
                  fileBlobRef.current = null;
                  setCheckout(null);
                  setResultUrl(null);
                  const next = emptyChristmasPhotoDraft();
                  writeDraft(next);
                  setDraft(next);
                }}
              >
                Create another
              </button>
            </div>
          </section>
        )}

        {draft.step === "error" && (
          <section className="mt-8 space-y-3">
            <p className="text-sm text-slate-600">
              Payment is recorded even if generation failed. Support can retry from admin when available.
            </p>
            <Link to="/christmas" className="text-sm font-medium underline">
              Back to Christmas
            </Link>
          </section>
        )}

        <p className="mt-10 text-center text-xs text-slate-400">
          <Link to="/christmas" className="underline">
            Christmas hub
          </Link>
        </p>
      </main>
    </>
  );
}
