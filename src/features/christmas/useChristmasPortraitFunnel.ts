import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { captureFunnelAttribution, attributionParamsForInternal } from "@/features/pet/funnelAttribution";
import { trackChristmasEvent, getChristmasFunnelSessionId } from "./analytics";
import { CHRISTMAS_CATALOG_SEED, findProduct } from "./catalog";
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
  type ChristmasPortraitSubjectChoice,
} from "./portraitTypes";
import type { ChristmasPortraitVertical } from "./portraitVerticals";
import { enabledChristmasStyles, type ChristmasStyleDef } from "./styles";
import { commerceForSubjectChoice } from "./subjectCommerce";

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

export type PortraitFunnelMode = "hub" | "vertical";

export type UseChristmasPortraitFunnelOptions = {
  vertical: ChristmasPortraitVertical;
  /** Hub asks “who’s in the photo?”; verticals skip straight to styles. */
  mode?: PortraitFunnelMode;
  onPageView?: () => void;
  onUploadStarted?: () => void;
  onUploadCompleted?: () => void;
  onSubjectSelected?: (subject: ChristmasPortraitSubjectChoice) => void;
  onStyleSelected?: (styleKey: string) => void;
  onGenerationStarted?: () => void;
  onGenerationCompleted?: (orderId: string) => void;
  onDownload?: () => void;
  onShare?: () => void;
  onStyleRetry?: () => void;
};

export function useChristmasPortraitFunnel({
  vertical,
  mode = "vertical",
  onPageView,
  onUploadStarted,
  onUploadCompleted,
  onSubjectSelected,
  onStyleSelected,
  onGenerationStarted,
  onGenerationCompleted,
  onDownload,
  onShare,
  onStyleRetry,
}: UseChristmasPortraitFunnelOptions) {
  const [params] = useSearchParams();
  const [draft, setDraft] = useState<ChristmasPortraitDraft>(() =>
    readDraft(vertical.draftStorageKey),
  );
  const [busy, setBusy] = useState(false);
  const [speciesHint, setSpeciesHint] = useState<{
    messageKey: string;
    switchTo: string;
    labelKey: string;
  } | null>(null);
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

  const subjectCommerce = useMemo(() => {
    if (mode === "hub" && draft.subjectChoice) {
      return commerceForSubjectChoice(draft.subjectChoice);
    }
    return null;
  }, [mode, draft.subjectChoice]);

  const activeProductKey = subjectCommerce?.productKey ?? vertical.productKey;
  const activePortraitType = subjectCommerce?.portraitType ?? vertical.portraitType;
  const activeStyles: ChristmasStyleDef[] =
    subjectCommerce?.styles ?? vertical.styles;
  const styles = useMemo(() => enabledChristmasStyles(activeStyles), [activeStyles]);
  const product = findProduct(CHRISTMAS_CATALOG_SEED, activeProductKey);

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
        const next = {
          ...prev,
          ...patch,
          step,
          lastError: patch?.lastError !== undefined ? patch.lastError : null,
        };
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
    if (onPageView) {
      onPageView();
    } else {
      void trackChristmasEvent("christmas_page_view", {
        productKey: vertical.productKey,
        pathname: vertical.routePath,
        metadata: {
          portrait_type: vertical.portraitType,
          species: vertical.expectedSpecies,
        },
      });
    }
  }, [vertical, onPageView]);

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
          onGenerationStarted?.();
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
  }, [params, setStep, vertical.draftStorageKey, onGenerationStarted]);

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
            productKey: activeProductKey,
            orderId: order.id,
            styleKey: order.style_key,
            metadata: { portrait_type: activePortraitType },
          });
          onGenerationCompleted?.(order.id);
          return;
        }
        if (order.fulfillment_status === "failed") {
          setStep("error", { lastError: order.last_error || "Generation failed" });
          void trackChristmasEvent("generation_failed", {
            productKey: activeProductKey,
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
  }, [
    draft.step,
    draft.publicToken,
    setStep,
    activeProductKey,
    activePortraitType,
    onGenerationCompleted,
  ]);

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
    onUploadStarted?.();
    void trackChristmasEvent("upload_started", {
      productKey: activeProductKey,
      pathname: vertical.routePath,
      metadata: { portrait_type: activePortraitType, species: vertical.expectedSpecies },
    });
    setBusy(true);
    try {
      const validation = await validateChristmasPhotoFile(file);
      if (!validation.ok) {
        setStep("upload", {
          lastError: validation.message,
          softWarning: null,
        });
        return;
      }

      let softWarning: string | null = null;
      if (validation.width < 400 || validation.height < 400) {
        softWarning = "funnel.softSmall";
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
          const labelKey =
            vertical.expectedSpecies === "dog" ? "funnel.christmasCats" : "funnel.christmasDogs";
          setSpeciesHint({
            messageKey: "funnel.speciesMismatch",
            switchTo,
            labelKey,
          });
          setStep("upload", { lastError: species.error });
          return;
        }
      }

      const localUrl = URL.createObjectURL(file);
      fileBlobRef.current = file;
      // Show the photo immediately for conversion momentum; server upload follows.
      setStep(mode === "hub" ? "subject" : "style", {
        localPreviewUrl: localUrl,
        softWarning,
        lastError: null,
        portraitType: vertical.portraitType,
        species:
          vertical.expectedSpecies === "dog" || vertical.expectedSpecies === "cat"
            ? vertical.expectedSpecies
            : null,
      });

      try {
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
        setStep(mode === "hub" ? "subject" : "style", {
          localPreviewUrl: localUrl,
          uploadId: upload.uploadId,
          sourcePath: upload.path,
          sourceContentType: validation.contentType,
          sourceWidth: validation.width,
          sourceHeight: validation.height,
          blurredPreviewUrl: null,
          softWarning,
          lastError: null,
          portraitType: vertical.portraitType,
          species:
            vertical.expectedSpecies === "dog" || vertical.expectedSpecies === "cat"
              ? vertical.expectedSpecies
              : null,
        });
        onUploadCompleted?.();
        void trackChristmasEvent("upload_completed", {
          productKey: activeProductKey,
          metadata: { portrait_type: activePortraitType, species: vertical.expectedSpecies },
        });
      } catch (uploadErr) {
        const msg =
          uploadErr instanceof Error ? uploadErr.message : "Upload failed";
        const friendly =
          /fetch|network|failed to fetch|json|503|502|unexpected end/i.test(msg)
            ? "Connection hiccup. Your photo is saved on this device — you can continue choosing a style, then retry upload at checkout."
            : msg.length > 160
              ? "We couldn’t upload this photo just now. Your selection is saved — please try again."
              : msg;
        setStep(mode === "hub" ? "subject" : "upload", {
          localPreviewUrl: localUrl,
          lastError: friendly,
        });
      }
    } catch (err) {
      setStep("upload", {
        lastError: err instanceof Error ? err.message : "Upload failed",
      });
    } finally {
      setBusy(false);
    }
  }

  function selectSubject(choice: ChristmasPortraitSubjectChoice) {
    const commerce = commerceForSubjectChoice(choice);
    setStep("style", {
      subjectChoice: choice,
      portraitType: commerce.portraitType,
      species: commerce.species === "any" ? null : commerce.species,
      styleKey: null,
      blurredPreviewUrl: null,
    });
    onSubjectSelected?.(choice);
  }

  async function onStylePick(styleKey: string) {
    if (!fileBlobRef.current && !draft.localPreviewUrl) {
      setStep("upload", { lastError: "Please upload a photo first." });
      return;
    }
    setBusy(true);
    onStyleSelected?.(styleKey);
    void trackChristmasEvent("style_selected", {
      productKey: activeProductKey,
      styleKey,
      metadata: {
        portrait_type: activePortraitType,
        subject: draft.subjectChoice,
      },
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
      setStep("preview", { styleKey, blurredPreviewUrl: preview.dataUrl, lastError: null });
      void trackChristmasEvent("preview_seen", {
        productKey: activeProductKey,
        styleKey,
        metadata: { portrait_type: activePortraitType },
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
      productKey: activeProductKey,
      styleKey: draft.styleKey,
      packageKey: vertical.packageKey,
      amountCents: catalogAmount,
      metadata: { portrait_type: activePortraitType, subject: draft.subjectChoice },
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
      productKey: activeProductKey,
      styleKey: draft.styleKey,
      packageKey: vertical.packageKey,
      metadata: { portrait_type: activePortraitType },
    });
    try {
      captureFunnelAttribution(window.location.search);
      const attr = attributionParamsForInternal();
      const result = await startChristmasCheckout({
        product_key: activeProductKey,
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
        portrait_type: activePortraitType,
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
        currency: result.currency,
      });
      setStep("checkout", {
        orderId: result.orderId,
        publicToken: result.publicToken,
      });
      void trackChristmasEvent("payment_sheet_opened", {
        productKey: activeProductKey,
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

  async function downloadResult() {
    if (!resultUrl || !draft.orderId) return;
    onDownload?.();
    void trackChristmasEvent("download", {
      productKey: activeProductKey,
      orderId: draft.orderId,
      metadata: { portrait_type: activePortraitType },
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

  async function shareResult() {
    if (!resultUrl) return;
    onShare?.();
    void trackChristmasEvent("share", {
      productKey: activeProductKey,
      orderId: draft.orderId,
      metadata: { portrait_type: activePortraitType },
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

  function resetAnother() {
    const next = emptyPortraitDraft();
    writeDraft(vertical.draftStorageKey, next);
    setDraft(next);
    setResultUrl(null);
    setCheckout(null);
    fileBlobRef.current = null;
  }

  function retryStyle() {
    onStyleRetry?.();
    setStep("style", { blurredPreviewUrl: null, styleKey: null });
  }

  function openFilePicker() {
    setStep("upload");
    fileRef.current?.click();
  }

  const styleName = styles.find((s) => s.styleKey === draft.styleKey)?.displayName;
  const creationActive = !["intro"].includes(draft.step) || Boolean(draft.localPreviewUrl);

  return {
    draft,
    setDraft,
    setStep,
    busy,
    speciesHint,
    checkout,
    resultUrl,
    purchasable,
    catalogAmount,
    fileRef,
    styles,
    product,
    styleName,
    activeProductKey,
    activePortraitType,
    creationActive,
    onFileChosen,
    selectSubject,
    onStylePick,
    goOffer,
    startCheckout,
    downloadResult,
    shareResult,
    resetAnother,
    retryStyle,
    openFilePicker,
  };
}
