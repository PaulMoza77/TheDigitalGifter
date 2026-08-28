import { useEffect, useId, useRef, useState } from "react";
import { PageHead } from "@/components/PageHead";
import { remainingSessionPreviews, sessionAllowsAnotherPreview } from "./abuse";
import { trackPetV3Event } from "./analytics";
import { PET_V3_FUNNEL_CONFIG } from "./config";
import { useV3EmbeddedCheckout } from "./useV3EmbeddedCheckout";
import { cryptoRandomId } from "../pet-v2/previewAttempt";
import { previewErrorMessage } from "../pet-v2/previewErrors";
import {
  backStepFrom,
  clearPreviewOnPhotoChange,
  resolveGenerateAttempt,
  shouldRestoreLocalPreview,
} from "../pet-v2/previewFlow";
import { requestV3Preview } from "./previewClient";
import { canGenerateWithSpeciesConfirm } from "../pet-funnel-shared/speciesConfirm";
import { V3GeneratingScreen } from "./screens/GeneratingScreen";
import { V3LandingScreen } from "./screens/LandingScreen";
import { V3OfferScreen } from "./screens/OfferScreen";
import { V3PhotoScreen } from "./screens/PhotoScreen";
import { V3PreviewScreen } from "./screens/PreviewScreen";
import { createV2LocalPreview, validateV2PhotoFile } from "../pet-v2/photo";
import { getPetV3SessionId } from "./session";
import {
  getV3PhotoFile,
  getV3PhotoObjectUrl,
  loadV3Draft,
  saveV3Draft,
  setV3PhotoFile,
} from "./storage";
import type { PetV3Draft, PetV3FailureCategory, PetV3Step } from "./types";
import { PET_V3_ROUTE, PET_V3_SPECIES } from "./types";
import { V3Shell } from "./V3Shell";

const STATUS_MESSAGES = PET_V3_FUNNEL_CONFIG.copy.generatingStatus;

export function PetV3FunnelPage() {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const generateLockRef = useRef(false);
  const lastFailureCategoryRef = useRef<PetV3FailureCategory | null>(null);
  const [draft, setDraft] = useState<PetV3Draft>(() => loadV3Draft());
  const [photoError, setPhotoError] = useState<string | undefined>();
  const [speciesConfirmed, setSpeciesConfirmed] = useState(false);
  const [genStatus, setGenStatus] = useState(STATUS_MESSAGES[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const previewUrl = getV3PhotoObjectUrl() ?? draft.photoPreviewDataUrl;
  const photoFile = getV3PhotoFile();
  const embeddedCheckout = useV3EmbeddedCheckout({
    active: draft.step === "offer",
    photo: draft.photo,
    file: photoFile,
    onRestartExpired: () => {
      // Preserve UTMs via existing attribution storage; clear in-memory photo and return to upload.
      setV3PhotoFile(null);
      setPhotoError(undefined);
      lastFailureCategoryRef.current = null;
      go("photo", clearPreviewOnPhotoChange({
        photo: null,
        uploadId: null,
        photoPreviewDataUrl: null,
      }));
    },
  });

  useEffect(() => {
    const next = loadV3Draft();
    setDraft(next);
    saveV3Draft(next);
    trackPetV3Event({ eventName: "v3_landing_view" });
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex, nofollow");
  }, []);

  useEffect(() => {
    saveV3Draft(draft);
  }, [draft]);

  useEffect(() => {
    if (draft.step === "preview" && !draft.generatedPreviewDataUrl) {
      setDraft((current) => ({ ...current, step: "photo" }));
    }
  }, [draft.step, draft.generatedPreviewDataUrl]);

  function go(step: PetV3Step, patch: Partial<PetV3Draft> = {}) {
    setDraft((current) => ({ ...current, ...patch, species: PET_V3_SPECIES, step }));
  }

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    trackPetV3Event({ eventName: "v3_upload_started" });
    const check = validateV2PhotoFile(file);
    if (!check.ok) {
      setPhotoError(check.message);
      trackPetV3Event({ eventName: "v3_upload_failed" });
      go("photo");
      return;
    }
    setV3PhotoFile(file);
    const local = await createV2LocalPreview(file);
    setPhotoError(undefined);
    setSpeciesConfirmed(false);
    trackPetV3Event({ eventName: "v3_upload_completed" });
    go("photo", clearPreviewOnPhotoChange({
      photo: { fileName: file.name, contentType: check.contentType, byteSize: file.size },
      uploadId: cryptoRandomId(),
      photoPreviewDataUrl: local,
    }));
  }

  async function generate(regenerate = false) {
    if (generateLockRef.current || isGenerating) return;
    const file = getV3PhotoFile();
    const source = getV3PhotoObjectUrl() ?? draft.photoPreviewDataUrl;
    if (!file || !source) {
      setPhotoError("Re-attach the original cat photo to create a preview.");
      go("photo");
      return;
    }

    const confirm = canGenerateWithSpeciesConfirm({
      hasPhoto: true,
      confirmed: speciesConfirmed,
      kind: "cat",
    });
    if (!confirm.ok) {
      setPhotoError(confirm.message);
      go("photo");
      return;
    }

    if (shouldRestoreLocalPreview(draft, regenerate)) {
      trackPetV3Event({ eventName: "v3_preview_viewed" });
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

    const sessionId = getPetV3SessionId();
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
    trackPetV3Event({
      eventName: regenerate ? "v3_preview_regenerated" : "v3_preview_generation_started",
      attemptId,
    });
    let tick = 0;
    const timer = window.setInterval(() => {
      tick += 1;
      setGenStatus(STATUS_MESSAGES[Math.min(tick, STATUS_MESSAGES.length - 1)]);
    }, 4000);
    try {
      const result = await requestV3Preview({
        file,
        sourcePreviewUrl: source,
        regenerate,
        idempotencyKey: attemptId,
      });
      if (!result.ok || !result.imageDataUrl) {
        const failureCategory = result.failureCategory || result.errorCode || "server_error";
        lastFailureCategoryRef.current = failureCategory as PetV3FailureCategory;
        trackPetV3Event({
          eventName: "v3_preview_generation_failed",
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
      trackPetV3Event({
        eventName: "v3_preview_generation_completed",
        attemptId,
      });
      trackPetV3Event({ eventName: "v3_preview_viewed" });
      go("preview", {
        generatedPreviewDataUrl: result.imageDataUrl,
        generationMode: result.mode,
        previewCount: result.reused ? draft.previewCount : draft.previewCount + 1,
        previewAttemptId: attemptId,
        lastError: null,
      });
    } catch {
      lastFailureCategoryRef.current = "server_error";
      trackPetV3Event({
        eventName: "v3_preview_generation_failed",
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

  const step = draft.step;
  const copy = PET_V3_FUNNEL_CONFIG.copy;

  return (
    <V3Shell
      showBack={step !== "landing"}
      footer={step === "landing" ? copy.landingFooter : undefined}
      padForSticky={step === "landing"}
      onBack={() => {
        if (isGenerating) return;
        go(backStepFrom(step, draft));
      }}
    >
      <PageHead title={copy.pageTitle} description={copy.pageDescription} exactTitle />
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
        <V3LandingScreen
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
        <V3PhotoScreen
          previewUrl={previewUrl}
          fileName={draft.photo?.fileName}
          error={photoError}
          inputId={inputId}
          inputRef={inputRef}
          generating={isGenerating}
          onClear={() => {
            setV3PhotoFile(null);
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
                  trackPetV3Event({ eventName: "v3_preview_viewed" });
                  go("preview", { lastError: null });
                }
              : undefined
          }
          onGenerate={() => void generate(false)}
        />
      ) : null}

      {step === "generating" ? (
        <V3GeneratingScreen
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
        <V3PreviewScreen
          previewUrl={draft.generatedPreviewDataUrl}
          sourceUrl={previewUrl}
          petName={draft.petName}
          mode={draft.generationMode}
          canRegenerate={remainingSessionPreviews() > 0 && !isGenerating}
          onRegenerate={() => void generate(true)}
          onUnlock={() => {
            trackPetV3Event({ eventName: "v3_offer_viewed" });
            go("offer");
          }}
        />
      ) : null}

      {step === "offer" ? (
        <V3OfferScreen
          email={draft.email}
          petName={draft.petName}
          checkout={embeddedCheckout}
          onEmail={(email) => go("offer", { email })}
          onPetName={(petName) => go("offer", { petName })}
        />
      ) : null}
    </V3Shell>
  );
}
