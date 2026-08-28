import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { trackMetaInitiateCheckout } from "@/lib/metaPixel";
import { PetApiError, startPetCheckout } from "../pet/api";
import { PET_DEFAULT_PERSONALITY } from "../pet/types";
import { petFunnelApi } from "../pet/supabaseApi";
import { shouldTrackPetBeginCheckout } from "../pet/funnelAnalytics";
import { validateOtherSubtype, validatePetName } from "../pet/croGuards";
import { remainingSessionPreviews, sessionAllowsAnotherPreview } from "./abuse";
import { petV2LandingPath, trackPetV2Event } from "./analytics";
import { trackV2BeginCheckout } from "./checkoutAnalytics";
import { cryptoRandomId } from "./previewAttempt";
import { previewErrorMessage } from "./previewErrors";
import {
  canGenerateWithSpeciesConfirm,
} from "../pet-funnel-shared/speciesConfirm";
import {
  backStepFrom,
  clearPreviewOnPhotoChange,
  resolveGenerateAttempt,
  shouldRestoreLocalPreview,
} from "./previewFlow";
import { requestV2Preview } from "./previewClient";
import { V2GeneratingScreen } from "./screens/GeneratingScreen";
import { V2LandingScreen } from "./screens/LandingScreen";
import { V2OfferScreen } from "./screens/OfferScreen";
import { V2PhotoScreen } from "./screens/PhotoScreen";
import { V2PreviewScreen } from "./screens/PreviewScreen";
import { createV2LocalPreview, validateV2PhotoFile } from "./photo";
import { getPetV2SessionId } from "./session";
import {
  getV2PhotoFile,
  getV2PhotoObjectUrl,
  loadV2Draft,
  saveV2Draft,
  setV2PhotoFile,
} from "./storage";
import { draftAfterSpeciesRouteChange } from "./speciesRouteIsolation";
import { v2PackOfferCopy } from "./V2PackOffer";
import type { PetV2Draft, PetV2FailureCategory, PetV2Species, PetV2Step } from "./types";
import { V2Shell } from "./V2Shell";

const STATUS_MESSAGES = [
  "Reading your photo",
  "Starting your F1 driver preview",
  "Still working — usually under 30 seconds",
];

export function PetV2FunnelPage({ species }: { species: PetV2Species }) {
  const navigate = useNavigate();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const generateLockRef = useRef(false);
  const unlockTrackLockRef = useRef(false);
  const lastFailureCategoryRef = useRef<PetV2FailureCategory | null>(null);
  const [draft, setDraft] = useState<PetV2Draft>(() => {
    const loaded = loadV2Draft();
    const isolated = draftAfterSpeciesRouteChange(loaded, species);
    if (isolated.clearInMemoryPhoto) setV2PhotoFile(null);
    return isolated.draft;
  });
  const [photoError, setPhotoError] = useState<string | undefined>();
  const [speciesConfirmed, setSpeciesConfirmed] = useState(false);
  const [genStatus, setGenStatus] = useState(STATUS_MESSAGES[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const previewUrl = getV2PhotoObjectUrl() ?? draft.photoPreviewDataUrl;

  useEffect(() => {
    const loaded = loadV2Draft();
    const isolated = draftAfterSpeciesRouteChange(loaded, species);
    if (isolated.clearInMemoryPhoto) {
      setV2PhotoFile(null);
      setSpeciesConfirmed(false);
      setPhotoError(undefined);
      lastFailureCategoryRef.current = null;
    }
    setDraft(isolated.draft);
    saveV2Draft(isolated.draft);
    trackPetV2Event({ eventName: "v2_landing_view", species });
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex, nofollow");
  }, [species]);

  useEffect(() => {
    saveV2Draft(draft);
  }, [draft]);

  useEffect(() => {
    if (draft.step === "preview" && !draft.generatedPreviewDataUrl) {
      setDraft((current) => ({ ...current, step: "photo" }));
    }
  }, [draft.step, draft.generatedPreviewDataUrl]);

  function go(step: PetV2Step, patch: Partial<PetV2Draft> = {}) {
    setDraft((current) => ({ ...current, ...patch, species, step }));
  }

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    trackPetV2Event({ eventName: "v2_upload_started", species });
    const check = validateV2PhotoFile(file);
    if (!check.ok) {
      setPhotoError(check.message);
      trackPetV2Event({ eventName: "v2_upload_failed", species });
      go("photo");
      return;
    }
    setV2PhotoFile(file);
    const local = await createV2LocalPreview(file);
    setPhotoError(undefined);
    setSpeciesConfirmed(false);
    trackPetV2Event({ eventName: "v2_upload_completed", species });
    go("photo", clearPreviewOnPhotoChange({
      photo: { fileName: file.name, contentType: check.contentType, byteSize: file.size },
      uploadId: cryptoRandomId(),
      photoPreviewDataUrl: local,
    }));
  }

  async function generate(regenerate = false) {
    if (generateLockRef.current || isGenerating) return;
    const file = getV2PhotoFile();
    const source = getV2PhotoObjectUrl() ?? draft.photoPreviewDataUrl;
    if (!file || !source) {
      setPhotoError("Re-attach the original photo to create a preview.");
      go("photo");
      return;
    }
    if (species === "other") {
      const subtypeCheck = validateOtherSubtype({
        species,
        subtype: draft.subtype,
        subtypeDetail: draft.subtypeDetail,
      });
      if (!subtypeCheck.ok) {
        setPhotoError(subtypeCheck.message);
        go("photo");
        return;
      }
    } else {
      const confirm = canGenerateWithSpeciesConfirm({
        hasPhoto: true,
        confirmed: speciesConfirmed,
        kind: species === "cat" ? "cat" : "dog",
      });
      if (!confirm.ok) {
        setPhotoError(confirm.message);
        go("photo");
        return;
      }
    }

    if (shouldRestoreLocalPreview(draft, regenerate)) {
      trackPetV2Event({ eventName: "v2_preview_viewed", species });
      go("preview", { lastError: null });
      return;
    }

    if (!sessionAllowsAnotherPreview()) {
      go("preview", {
        lastError: "This session already used its free previews.",
        generatedPreviewDataUrl: draft.generatedPreviewDataUrl,
      });
      return;
    }

    generateLockRef.current = true;
    setIsGenerating(true);

    const sessionId = getPetV2SessionId();
    const uploadId = draft.uploadId || cryptoRandomId();
    const retryAfterFailure = Boolean(draft.lastError);
    const { attemptId } = resolveGenerateAttempt({
      sessionId,
      uploadId,
      previewAttemptId: draft.previewAttemptId,
      regenerate,
      retryAfterFailure,
      lastFailureCategory: lastFailureCategoryRef.current,
    });

    go("generating", {
      lastError: null,
      uploadId,
      previewAttemptId: attemptId,
    });
    trackPetV2Event({
      eventName: regenerate ? "v2_preview_regenerated" : "v2_preview_generation_started",
      species,
      attemptId,
    });
    let tick = 0;
    const timer = window.setInterval(() => {
      tick += 1;
      setGenStatus(STATUS_MESSAGES[Math.min(tick, STATUS_MESSAGES.length - 1)]);
    }, 4000);
    try {
      const result = await requestV2Preview({
        file,
        species,
        sourcePreviewUrl: source,
        regenerate,
        idempotencyKey: attemptId,
      });
      if (!result.ok || !result.imageDataUrl) {
        const failureCategory = result.failureCategory || result.errorCode || "server_error";
        lastFailureCategoryRef.current = failureCategory as PetV2FailureCategory;
        trackPetV2Event({
          eventName: "v2_preview_generation_failed",
          species,
          attemptId,
          failureCategory,
        });
        go("generating", {
          lastError: previewErrorMessage(result),
          previewAttemptId: attemptId,
        });
        return;
      }
      lastFailureCategoryRef.current = null;
      trackPetV2Event({
        eventName: "v2_preview_generation_completed",
        species,
        attemptId,
      });
      trackPetV2Event({ eventName: "v2_preview_viewed", species });
      go("preview", {
        generatedPreviewDataUrl: result.imageDataUrl,
        generationMode: result.mode,
        previewCount: result.reused ? draft.previewCount : draft.previewCount + 1,
        previewAttemptId: attemptId,
        lastError: null,
      });
    } catch {
      lastFailureCategoryRef.current = "server_error";
      trackPetV2Event({
        eventName: "v2_preview_generation_failed",
        species,
        attemptId,
        failureCategory: "server_error",
      });
      go("generating", {
        lastError: previewErrorMessage({ failureCategory: "server_error" }),
        previewAttemptId: attemptId,
      });
    } finally {
      window.clearInterval(timer);
      generateLockRef.current = false;
      setIsGenerating(false);
    }
  }

  async function pay() {
    setCheckoutError(null);
    const named = validatePetName(draft.petName);
    if (!named.ok) {
      setCheckoutError(named.message);
      return;
    }
    const email = draft.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setCheckoutError("Enter a valid email address.");
      return;
    }
    const subtypeCheck = validateOtherSubtype({
      species,
      subtype: draft.subtype,
      subtypeDetail: draft.subtypeDetail,
    });
    if (!subtypeCheck.ok) {
      setCheckoutError(subtypeCheck.message);
      return;
    }
    const file = getV2PhotoFile();
    if (!file || !draft.photo) {
      setCheckoutError("Re-attach the original photo before paying.");
      go("photo");
      return;
    }

    const offer = v2PackOfferCopy();
    setCheckoutBusy(true);
    try {
      const result = await startPetCheckout({
        api: petFunnelApi,
        email,
        petName: named.name,
        species,
        personality: PET_DEFAULT_PERSONALITY,
        photo: draft.photo,
        file,
        successUrl: `${window.location.origin}/pet/order`,
        cancelUrl: `${window.location.origin}${petV2LandingPath(species)}`,
        subtype: subtypeCheck.subtype,
        subtypeDetail: subtypeCheck.subtypeDetail,
        funnelVariant: "v2",
        funnelSessionId: getPetV2SessionId(),
      });

      if (result.status === "payment_processing" || result.status === "comped" || !result.checkoutUrl) {
        window.location.assign(`/pet/order?token=${encodeURIComponent(result.publicToken)}`);
        return;
      }

      const tracked = trackV2BeginCheckout({
        species,
        result: { ...result, orderId: result.orderId },
        fallbackAmountCents: offer.amountCents,
      });

      if (tracked && shouldTrackPetBeginCheckout(result)) {
        const serverAmount = result.chargedAmountCents ?? result.amountCents ?? offer.amountCents;
        trackMetaInitiateCheckout({
          eventId: result.eventId || `pet_ic_${result.orderId}`,
          valueCents: serverAmount,
          orderId: result.orderId,
        });
      }

      window.location.assign(result.checkoutUrl);
    } catch (caught) {
      const message =
        caught instanceof PetApiError
          ? caught.message
          : "Checkout could not start. Nothing was charged — try again.";
      setCheckoutError(message);
    } finally {
      setCheckoutBusy(false);
    }
  }

  const step = draft.step;

  return (
    <V2Shell
      species={species}
      showBack={step !== "landing"}
      footer={
        step === "landing"
          ? "Free preview first — card only if you unlock the collection."
          : undefined
      }
      padForSticky={step === "landing"}
      onBack={() => {
        if (isGenerating) return;
        go(backStepFrom(step, draft));
      }}
      onSpecies={
        step === "landing"
          ? (next) => {
              void navigate(petV2LandingPath(next));
            }
          : undefined
      }
    >
      <PageHead
        title={
          species === "cat"
            ? "See your cat as a Formula 1 driver | My Pet’s Secret Life"
            : species === "other"
              ? "See your pet as a Formula 1 driver | My Pet’s Secret Life"
              : "See your dog as a Formula 1 driver | My Pet’s Secret Life"
        }
        description={`${v2PackOfferCopy().headline}. Upload one ${species === "cat" ? "cat" : species === "other" ? "pet" : "dog"} photo for a free cinematic F1 driver preview. No card required for the preview.`}
        exactTitle
      />
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp,image/heic,image/heif"
        className="sr-only"
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {step === "landing" ? (
        <V2LandingScreen
          species={species}
          fileInputId={inputId}
          onUploadClick={() => {
            if (previewUrl) {
              go("photo");
              return;
            }
            inputRef.current?.click();
          }}
        />
      ) : null}

      {step === "photo" ? (
        <V2PhotoScreen
          species={species}
          previewUrl={previewUrl}
          fileName={draft.photo?.fileName}
          error={photoError}
          inputId={inputId}
          inputRef={inputRef}
          generating={isGenerating}
          subtype={draft.subtype}
          subtypeDetail={draft.subtypeDetail}
          onSubtype={(subtype, detail) => go("photo", { subtype, subtypeDetail: detail || null })}
          onClear={() => {
            setV2PhotoFile(null);
            setPhotoError(undefined);
            setSpeciesConfirmed(false);
            lastFailureCategoryRef.current = null;
            go("photo", clearPreviewOnPhotoChange({
              photo: null,
              uploadId: null,
              photoPreviewDataUrl: null,
            }));
          }}
          speciesConfirmed={speciesConfirmed}
          onSpeciesConfirmed={setSpeciesConfirmed}
          onViewPreview={
            draft.generatedPreviewDataUrl
              ? () => {
                  trackPetV2Event({ eventName: "v2_preview_viewed", species });
                  go("preview", { lastError: null });
                }
              : undefined
          }
          onGenerate={() => void generate(false)}
        />
      ) : null}

      {step === "generating" ? (
        <V2GeneratingScreen
          thumbnailUrl={previewUrl}
          status={genStatus}
          error={draft.lastError}
          busy={isGenerating}
          onRetry={() => void generate(false)}
          onBack={() => {
            if (!isGenerating) go("photo");
          }}
        />
      ) : null}

      {step === "preview" && draft.generatedPreviewDataUrl ? (
        <V2PreviewScreen
          previewUrl={draft.generatedPreviewDataUrl}
          sourceUrl={previewUrl}
          petName={draft.petName}
          species={species}
          mode={draft.generationMode}
          canRegenerate={remainingSessionPreviews() > 0 && !isGenerating}
          onRegenerate={() => void generate(true)}
          onUnlock={() => {
            if (unlockTrackLockRef.current) return;
            unlockTrackLockRef.current = true;
            trackPetV2Event({ eventName: "v2_unlock_clicked", species });
            trackPetV2Event({ eventName: "v2_offer_viewed", species });
            go("offer");
            window.setTimeout(() => {
              unlockTrackLockRef.current = false;
            }, 800);
          }}
        />
      ) : null}

      {step === "offer" ? (
        <V2OfferScreen
          species={species}
          email={draft.email}
          petName={draft.petName}
          subtype={draft.subtype}
          subtypeDetail={draft.subtypeDetail}
          busy={checkoutBusy}
          error={checkoutError}
          onEmail={(email) => go("offer", { email })}
          onPetName={(petName) => go("offer", { petName })}
          onSubtype={(subtype, detail) => go("offer", { subtype, subtypeDetail: detail || null })}
          onContinue={() => void pay()}
        />
      ) : null}
    </V2Shell>
  );
}
