import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { CustomStripeCheckout } from "@/features/pet/components/CustomStripeCheckout";
import { captureFunnelAttribution, attributionParamsForInternal } from "@/features/pet/funnelAttribution";
import { trackChristmasEvent, getChristmasFunnelSessionId } from "./analytics";
import { CHRISTMAS_CATALOG_SEED, findProduct, ctaStateForProduct } from "./catalog";
import {
  createChristmasUpload,
  getChristmasOrderByToken,
  startChristmasCheckout,
  uploadChristmasBlob,
  validateChristmasSpecies,
} from "./photoApi";
import {
  createBlurredOriginalPreview,
  christmasPreviewUsesReplicate,
  validateChristmasPhotoFile,
} from "./photoPreview";
import {
  emptyPortraitDraft,
  type ChristmasPortraitDraft,
  type ChristmasPortraitStep,
} from "./portraitTypes";
import {
  verticalFromPathname,
  type ChristmasPortraitVertical,
} from "./portraitVerticals";
import { enabledChristmasStyles } from "./styles";

function readDraft(key: string): ChristmasPortraitDraft {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return emptyPortraitDraft();
    return { ...emptyPortraitDraft(), ...JSON.parse(raw) };
  } catch {
    return emptyPortraitDraft();
  }
}

function writeDraft(key: string, draft: ChristmasPortraitDraft) {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }),
    );
  } catch {
    /* ignore */
  }
}

function useVertical(): ChristmasPortraitVertical {
  const { pathname } = useLocation();
  const vertical = verticalFromPathname(pathname);
  if (!vertical) {
    // Fallback for safety — photo generator
    return verticalFromPathname("/christmas/photo-generator")!;
  }
  return vertical;
}

export default function ChristmasPortraitFunnelPage() {
  const vertical = useVertical();
  const [params] = useSearchParams();
  const [draft, setDraft] = useState<ChristmasPortraitDraft>(() =>
    readDraft(vertical.draftStorageKey),
  );
  const [busy, setBusy] = useState(false);
  const [speciesHint, setSpeciesHint] = useState<{
    message: string;
    switchTo: string;
    label: string;
  } | null>(null);
  const [checkout, setCheckout] = useState<{
    clientSecret: string;
    publishableKey: string;
    amountCents: number;
    listAmountCents?: number;
    giftApplied?: string | null;
    currency: string;
  } | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [purchasable, setPurchasable] = useState(false);
  const [catalogAmount, setCatalogAmount] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileBlobRef = useRef<Blob | null>(null);
  const pageViewed = useRef(false);
  const styles = useMemo(
    () => enabledChristmasStyles(vertical.styles),
    [vertical.styles],
  );
  const product = findProduct(CHRISTMAS_CATALOG_SEED, vertical.productKey);

  // Reset draft storage when switching vertical routes
  useEffect(() => {
    setDraft(readDraft(vertical.draftStorageKey));
    setSpeciesHint(null);
    setCheckout(null);
    setResultUrl(null);
    pageViewed.current = false;
  }, [vertical.draftStorageKey, vertical.routePath]);

  const setStep = useCallback(
    (step: ChristmasPortraitStep, patch?: Partial<ChristmasPortraitDraft>) => {
      setDraft((prev) => {
        const next = { ...prev, ...patch, step, lastError: patch?.lastError ?? null };
        writeDraft(vertical.draftStorageKey, next);
        return next;
      });
    },
    [vertical.draftStorageKey],
  );

  useEffect(() => {
    if (pageViewed.current) return;
    pageViewed.current = true;
    captureFunnelAttribution(window.location.search);
    void trackChristmasEvent("christmas_page_view", {
      productKey: vertical.productKey,
      pathname: vertical.routePath,
      portraitType: vertical.portraitType,
      species: vertical.expectedSpecies,
    });
  }, [vertical]);

  useEffect(() => {
    const pkg = product?.packages.find((p) => p.packageKey === vertical.packageKey);
    setPurchasable(Boolean(pkg?.purchasable && pkg.priceCents > 0));
    setCatalogAmount(pkg?.purchasable && pkg.priceCents > 0 ? pkg.priceCents : null);
  }, [product, vertical.packageKey]);

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
          writeDraft(vertical.draftStorageKey, next);
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
  }, [params, setStep, vertical.draftStorageKey]);

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
            productKey: vertical.productKey,
            orderId: order.id,
            styleKey: order.style_key,
            portraitType: vertical.portraitType,
            species: vertical.expectedSpecies,
          });
          return;
        }
        if (order.fulfillment_status === "failed") {
          setStep("error", { lastError: order.last_error || "Generation failed" });
          void trackChristmasEvent("generation_failed", {
            productKey: vertical.productKey,
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
  }, [draft.step, draft.publicToken, setStep, vertical]);

  async function blobToDataUrl(blob: Blob): Promise<string> {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read photo"));
      reader.readAsDataURL(blob);
    });
  }

  async function onFileChosen(file: File | null) {
    if (!file) return;
    setSpeciesHint(null);
    void trackChristmasEvent("upload_started", {
      productKey: vertical.productKey,
      pathname: vertical.routePath,
      portraitType: vertical.portraitType,
      species: vertical.expectedSpecies,
    });
    setBusy(true);
    try {
      const validation = await validateChristmasPhotoFile(file);
      if (!validation.ok) {
        setStep("upload", { lastError: validation.message });
        return;
      }

      if (vertical.expectedSpecies === "dog" || vertical.expectedSpecies === "cat") {
        const dataUrl = await blobToDataUrl(file);
        const species = await validateChristmasSpecies({
          imageDataUrl: dataUrl,
          expected: vertical.expectedSpecies,
        });
        if (!species.ok && species.errorCode === "wrong_species") {
          const switchTo =
            vertical.expectedSpecies === "dog" ? "/christmas/cats" : "/christmas/dogs";
          const label =
            vertical.expectedSpecies === "dog" ? "Christmas Cats" : "Christmas Dogs";
          setSpeciesHint({
            message: species.error || "This photo looks like a different species.",
            switchTo,
            label,
          });
          setStep("upload", { lastError: species.error });
          return;
        }
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
        portraitType: vertical.portraitType,
        species:
          vertical.expectedSpecies === "dog" || vertical.expectedSpecies === "cat"
            ? vertical.expectedSpecies
            : null,
      });
      void trackChristmasEvent("upload_completed", {
        productKey: vertical.productKey,
        portraitType: vertical.portraitType,
        species: vertical.expectedSpecies,
      });
    } catch (err) {
      setStep("upload", {
        lastError: err instanceof Error ? err.message : "Upload failed",
      });
    } finally {
      setBusy(false);
    }
  }

  async function onStyleSelected(styleKey: string) {
    if (!draft.sourcePath || (!fileBlobRef.current && !draft.localPreviewUrl)) {
      setStep("upload", { lastError: "Please upload a photo first." });
      return;
    }
    setBusy(true);
    void trackChristmasEvent("style_selected", {
      productKey: vertical.productKey,
      styleKey,
      portraitType: vertical.portraitType,
      species: vertical.expectedSpecies,
    });
    try {
      const source =
        fileBlobRef.current ||
        (draft.localPreviewUrl ? await fetch(draft.localPreviewUrl).then((r) => r.blob()) : null);
      if (!source) throw new Error("Missing photo");
      const preview = await createBlurredOriginalPreview(source, { blurPx: 32 });
      if (preview.replicateCalls !== 0 || christmasPreviewUsesReplicate()) {
        throw new Error("Preview must not call Replicate");
      }
      setStep("preview", { styleKey, blurredPreviewUrl: preview.dataUrl });
      void trackChristmasEvent("preview_seen", {
        productKey: vertical.productKey,
        styleKey,
        portraitType: vertical.portraitType,
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
      productKey: vertical.productKey,
      styleKey: draft.styleKey,
      packageKey: vertical.packageKey,
      amountCents: catalogAmount,
      portraitType: vertical.portraitType,
      species: vertical.expectedSpecies,
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
      productKey: vertical.productKey,
      styleKey: draft.styleKey,
      packageKey: vertical.packageKey,
      portraitType: vertical.portraitType,
      species: vertical.expectedSpecies,
    });
    try {
      captureFunnelAttribution(window.location.search);
      const attr = attributionParamsForInternal();
      const result = await startChristmasCheckout({
        product_key: vertical.productKey,
        package_key: vertical.packageKey,
        amount_cents: 1,
        currency: "eur",
        email: draft.email || undefined,
        style_key: draft.styleKey,
        source_path: draft.sourcePath,
        source_bucket: "christmas-source",
        source_content_type: draft.sourceContentType,
        source_width: draft.sourceWidth,
        source_height: draft.sourceHeight,
        portrait_type: vertical.portraitType,
        species:
          draft.species ||
          (vertical.expectedSpecies === "dog" || vertical.expectedSpecies === "cat"
            ? vertical.expectedSpecies
            : null),
        source_route: vertical.routePath,
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
        success_url: `${window.location.origin}${vertical.routePath}?checkout=success`,
      });
      setCheckout({
        clientSecret: result.clientSecret,
        publishableKey: result.publishableKey,
        amountCents: result.amountCents,
        listAmountCents: (result as any).listAmountCents,
        giftApplied: (result as any).giftApplied,
        currency: result.currency,
      });
      setStep("checkout", {
        orderId: result.orderId,
        publicToken: result.publicToken,
      });
      void trackChristmasEvent("payment_sheet_opened", {
        productKey: vertical.productKey,
        orderId: result.orderId,
        amountCents: result.amountCents,
      });
    } catch (err) {
      setStep("offer", {
        lastError: err instanceof Error ? err.message : "Checkout failed",
      });
    } finally {
      setBusy(false);
    }
  }

  async function onDownload() {
    if (!resultUrl || !draft.orderId) return;
    void trackChristmasEvent("download", {
      productKey: vertical.productKey,
      orderId: draft.orderId,
      portraitType: vertical.portraitType,
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
      productKey: vertical.productKey,
      orderId: draft.orderId,
      portraitType: vertical.portraitType,
    });
    try {
      const res = await fetch(resultUrl);
      const blob = await res.blob();
      const file = new File([blob], `tdg-christmas-portrait.jpg`, {
        type: blob.type || "image/jpeg",
      });
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
        title={vertical.pageTitle}
        description={vertical.metaDescription}
        exactTitle
        url={`https://www.thedigitalgifter.com${vertical.routePath}`}
      />
      <main className="mx-auto min-h-[70vh] max-w-lg px-4 py-8 text-slate-900">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          The Digital Gifter · Christmas
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{vertical.heroHeadline}</h1>
        <p className="mt-2 text-sm text-slate-600">{vertical.heroSupport}</p>
        <p className="mt-2 text-xs text-slate-500">{vertical.privacyLine}</p>

        {draft.lastError ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {draft.lastError}
          </p>
        ) : null}

        {speciesHint ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {speciesHint.message}{" "}
            <Link className="font-medium underline" to={speciesHint.switchTo}>
              Switch to {speciesHint.label}
            </Link>
          </p>
        ) : null}

        {(draft.step === "intro" || draft.step === "upload") && (
          <section className="mt-8 space-y-4">
            {vertical.id === "pets" ? (
              <div className="flex gap-2">
                <Link
                  to="/christmas/dogs"
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-center text-sm font-medium"
                >
                  Dogs
                </Link>
                <Link
                  to="/christmas/cats"
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-center text-sm font-medium"
                >
                  Cats
                </Link>
              </div>
            ) : null}
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
              capture="environment"
              className="hidden"
              onChange={(e) => void onFileChosen(e.target.files?.[0] || null)}
            />
            <p className="text-xs text-slate-500">{vertical.uploadHint}</p>
            <p className="text-xs text-slate-500">JPEG, PNG, or WebP · under 15 MB</p>
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
              <li>{vertical.deliverableLine}</li>
              <li>Usually ready a few minutes after payment</li>
              <li>Private by default · download via your order link</li>
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
            {product ? (
              <p className="text-xs text-slate-500">
                Product status: {ctaStateForProduct(product)} · Apple Pay / Google Pay / card when
                checkout is enabled
              </p>
            ) : null}
          </section>
        )}

        {draft.step === "checkout" && checkout && (
          <section className="mt-8 space-y-4">
            <h2 className="text-lg font-medium">Secure payment</h2>
            {checkout.giftApplied ? (
              <p className="mb-2 text-center text-sm font-medium text-amber-200/95">{checkout.giftApplied}</p>
            ) : null}
            {typeof checkout.listAmountCents === "number" && checkout.listAmountCents > checkout.amountCents ? (
              <p className="mb-1 text-center text-xs text-white/60"><span className="line-through">${(checkout.listAmountCents/100).toFixed(2)}</span> → ${(checkout.amountCents/100).toFixed(2)}</p>
            ) : null}
            <CustomStripeCheckout
              clientSecret={checkout.clientSecret}
              publishableKey={checkout.publishableKey}
              dueDisplay={`$${(checkout.amountCents / 100).toFixed(2)}`}
              returnUrl={`${window.location.origin}${vertical.routePath}?checkout=success&token=${encodeURIComponent(draft.publicToken || "")}`}
              email={draft.email}
              onReady={() => {
                void trackChristmasEvent("payment_sheet_opened", {
                  productKey: vertical.productKey,
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
                  const next = emptyPortraitDraft();
                  writeDraft(vertical.draftStorageKey, next);
                  setDraft(next);
                  setResultUrl(null);
                  setCheckout(null);
                  fileBlobRef.current = null;
                }}
              >
                Create another
              </button>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="text-slate-500">Try another:</span>
              {vertical.crossLinks.map((link) => (
                <Link key={link.to} to={link.to} className="underline underline-offset-4">
                  {link.label}
                </Link>
              ))}
            </div>
          </section>
        )}

        {draft.step === "error" && (
          <section className="mt-8 space-y-3">
            <h2 className="text-lg font-medium">Something went wrong</h2>
            <p className="text-sm text-slate-600">
              If you already paid, keep your order link — support can retry fulfillment without charging
              again.
            </p>
            <Link to="/christmas" className="text-sm underline">
              Christmas hub
            </Link>
          </section>
        )}

        <nav className="mt-10 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-200 pt-4 text-xs text-slate-500">
          {vertical.crossLinks.map((link) => (
            <Link key={link.to} to={link.to} className="underline-offset-2 hover:underline">
              {link.label}
            </Link>
          ))}
          <Link to="/christmas" className="underline-offset-2 hover:underline">
            Christmas hub
          </Link>
        </nav>
      </main>
    </>
  );
}
