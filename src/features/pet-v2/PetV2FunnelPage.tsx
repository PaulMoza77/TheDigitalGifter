import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { remainingSessionPreviews, sessionAllowsAnotherPreview } from "./abuse";
import { petV2LandingPath, trackPetV2Event } from "./analytics";
import { requestV2Preview } from "./previewClient";
import { V2GeneratingScreen } from "./screens/GeneratingScreen";
import { V2LandingScreen } from "./screens/LandingScreen";
import { V2OfferScreen } from "./screens/OfferScreen";
import { V2PhotoScreen } from "./screens/PhotoScreen";
import { V2PreviewScreen } from "./screens/PreviewScreen";
import { createV2LocalPreview, validateV2PhotoFile } from "./photo";
import {
  getV2PhotoFile,
  getV2PhotoObjectUrl,
  loadV2Draft,
  saveV2Draft,
  setV2PhotoFile,
} from "./storage";
import type { PetV2Draft, PetV2Species, PetV2Step } from "./types";
import { V2Shell } from "./V2Shell";

const STATUS_MESSAGES = [
  "Reading your photo",
  "Starting one royal portrait",
  "Still working — usually under 30 seconds",
];

export function PetV2FunnelPage({ species }: { species: PetV2Species }) {
  const navigate = useNavigate();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<PetV2Draft>(() => ({ ...loadV2Draft(), species }));
  const [photoError, setPhotoError] = useState<string | undefined>();
  const [genStatus, setGenStatus] = useState(STATUS_MESSAGES[0]);
  const [handoffDone, setHandoffDone] = useState(false);
  const previewUrl = getV2PhotoObjectUrl() ?? draft.photoPreviewDataUrl;

  useEffect(() => {
    const next = { ...loadV2Draft(), species };
    setDraft(next);
    saveV2Draft(next);
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
    trackPetV2Event({ eventName: "v2_upload_completed", species });
    go("photo", {
      photo: { fileName: file.name, contentType: check.contentType, byteSize: file.size },
      photoPreviewDataUrl: local,
      lastError: null,
    });
  }

  async function generate(regenerate = false) {
    const file = getV2PhotoFile();
    const source = getV2PhotoObjectUrl() ?? draft.photoPreviewDataUrl;
    if (!file || !source) {
      setPhotoError("Re-attach the original photo to create a preview.");
      go("photo");
      return;
    }
    if (!sessionAllowsAnotherPreview()) {
      go("preview", { lastError: "This session already used its free previews." });
      return;
    }
    go("generating", { lastError: null });
    trackPetV2Event({
      eventName: regenerate ? "v2_preview_regenerated" : "v2_preview_generation_started",
      species,
    });
    let tick = 0;
    const timer = window.setInterval(() => {
      tick += 1;
      setGenStatus(STATUS_MESSAGES[Math.min(tick, STATUS_MESSAGES.length - 1)]);
    }, 4000);
    try {
      const result = await requestV2Preview({ file, species, sourcePreviewUrl: source, regenerate });
      if (!result.ok || !result.imageDataUrl) {
        trackPetV2Event({ eventName: "v2_preview_generation_failed", species });
        go("generating", { lastError: result.error || "Preview generation failed. Nothing was charged." });
        return;
      }
      trackPetV2Event({ eventName: "v2_preview_generation_completed", species });
      trackPetV2Event({ eventName: "v2_preview_viewed", species });
      go("preview", {
        generatedPreviewDataUrl: result.imageDataUrl,
        generationMode: result.mode,
        previewCount: draft.previewCount + 1,
        lastError: null,
      });
    } catch {
      trackPetV2Event({ eventName: "v2_preview_generation_failed", species });
      go("generating", { lastError: "Preview generation failed. Nothing was charged." });
    } finally {
      window.clearInterval(timer);
    }
  }

  const step = draft.step;

  return (
    <V2Shell
      species={species}
      showBack={step !== "landing"}
      onBack={() => {
        if (step === "offer") go("preview");
        else if (step === "preview" || step === "generating") go("photo");
        else go("landing");
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
        title="See your pet in another life | My Pet’s Secret Life"
        description="Upload one pet photo and see a free personalized preview. No card required. Prototype funnel — not the live $27 checkout."
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
          onClear={() => {
            setV2PhotoFile(null);
            setPhotoError(undefined);
            go("photo", { photo: null, photoPreviewDataUrl: null, generatedPreviewDataUrl: null });
          }}
          onGenerate={() => void generate(false)}
        />
      ) : null}

      {step === "generating" ? (
        <V2GeneratingScreen
          thumbnailUrl={previewUrl}
          status={genStatus}
          error={draft.lastError}
          onRetry={() => void generate(draft.previewCount > 0)}
          onBack={() => go("photo")}
        />
      ) : null}

      {step === "preview" && draft.generatedPreviewDataUrl ? (
        <V2PreviewScreen
          previewUrl={draft.generatedPreviewDataUrl}
          petName={draft.petName}
          mode={draft.generationMode}
          canRegenerate={remainingSessionPreviews() > 0}
          onRegenerate={() => void generate(true)}
          onUnlock={() => {
            trackPetV2Event({ eventName: "v2_unlock_clicked", species });
            trackPetV2Event({ eventName: "v2_offer_viewed", species });
            go("offer");
          }}
        />
      ) : null}

      {step === "offer" ? (
        <V2OfferScreen
          email={draft.email}
          onEmail={(email) => go("offer", { email })}
          submitted={handoffDone}
          onContinue={() => {
            trackPetV2Event({ eventName: "v2_begin_checkout", species, amountCents: 1900 });
            setHandoffDone(true);
          }}
        />
      ) : null}
    </V2Shell>
  );
}
