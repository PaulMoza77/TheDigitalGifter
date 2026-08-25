import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHead } from "@/components/PageHead";
import { PET_DEFAULT_PERSONALITY } from "./types";
import { sceneImageSrc } from "./catalog";
import { trackFunnelEvent } from "./funnelAnalytics";
import { trackPetFunnelInternalEvent } from "./funnelInternal";
import {
  FieldError,
  FunnelProgress,
  PersonalityPicker,
  PetShell,
  PhotoUploader,
  petFieldClass,
} from "./components";
import type { FieldErrors } from "./validation";
import { validatePetDraft } from "./validation";
import type { PetFunnelNavigation, PetSpecies } from "./types";
import { usePetDraft } from "./usePetDraft";

export type PetCreatePageProps = {
  navigation?: PetFunnelNavigation;
  species?: PetSpecies;
  /** Preview-only: show validation errors without submitting. */
  forceErrors?: boolean;
};

export function PetCreatePage({
  navigation,
  species = "dog",
  forceErrors = false,
}: PetCreatePageProps) {
  const { draft, previewUrl, hasOriginalFile, storageMessage, setPhotoFromFile, clearPhoto } =
    usePetDraft();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [photoError, setPhotoError] = useState<string | undefined>();
  const emailId = useId();
  const emailErrorId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const selectedSpecies = draft.species ?? species;
  const petLabel = draft.petName.trim() || "your pet";
  const wowScene = selectedSpecies === "cat" ? "astronaut" : "formula-racer";
  const wowImage = sceneImageSrc(wowScene, selectedSpecies === "other" ? "dog" : selectedSpecies);

  useEffect(() => {
    draft.setSpecies(species);
    if (!draft.personality) draft.setPersonality(PET_DEFAULT_PERSONALITY);
    headingRef.current?.focus();
    trackPetFunnelInternalEvent({ eventName: "photo_step_viewed", species });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [species]);

  useEffect(() => {
    if (!forceErrors) return;
    const result = validatePetDraft({
      petName: draft.petName,
      species: draft.species,
      personality: draft.personality,
      email: draft.email,
      photo: draft.photo,
      subtype: draft.subtype,
      subtypeDetail: draft.subtypeDetail,
    });
    if (!result.ok) setErrors(result.errors);
  }, [forceErrors, draft.petName, draft.species, draft.personality, draft.email, draft.photo, draft.subtype, draft.subtypeDetail]);

  function continueToCheckout() {
    const result = validatePetDraft({
      petName: draft.petName,
      species: draft.species,
      personality: draft.personality || PET_DEFAULT_PERSONALITY,
      email: draft.email,
      photo: draft.photo,
      subtype: draft.subtype,
      subtypeDetail: draft.subtypeDetail,
    });

    if (!result.ok) {
      setErrors(result.errors);
      setPhotoError(result.errors.photo);
      return;
    }

    if (!hasOriginalFile && draft.photo) {
      setPhotoError("Re-attach the original photo. The saved preview is only for display.");
      return;
    }

    setErrors({});
    setPhotoError(undefined);
    trackFunnelEvent("PetDetailsCompleted", { species: selectedSpecies });
    navigation?.goToCheckout();
  }

  return (
    <PetShell
      navigation={navigation}
      species={selectedSpecies}
      showBack
      backLabel="Back"
      onBack={() => navigation?.goToLanding(selectedSpecies)}
    >
      <form
        className="mx-auto max-w-xl space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          continueToCheckout();
        }}
        noValidate
      >
        <PageHead
          title="Upload a pet photo | My Pet’s Secret Life"
          description="Upload one photo and your email to create 12 personalized portraits and 2 cinematic clips. No charge yet."
          exactTitle
        />
        <FunnelProgress current={2} />
        <div>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-[1.65rem] font-semibold leading-tight tracking-tight text-[#f6efe4] outline-none sm:text-3xl"
          >
            Great — now upload a photo of {petLabel}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#f6efe4]/70">
            Choose a clear photo where {petLabel === "your pet" ? "their" : `${petLabel}’s`} face is easy to
            see.
          </p>
        </div>

        <PhotoUploader
          previewUrl={previewUrl}
          fileName={draft.photo?.fileName}
          byteSize={draft.photo?.byteSize}
          needsOriginalFile={Boolean(draft.photo) && !hasOriginalFile}
          uploadLabel={
            petLabel === "your pet" ? "Upload your pet’s photo" : `Upload ${petLabel}’s photo`
          }
          error={photoError ?? errors.photo}
          guidance=""
          successMessage={
            draft.photo
              ? `Great photo — ${petLabel === "your pet" ? "their" : `${petLabel}’s`} face is clear.`
              : undefined
          }
          onFileAccepted={(file) => {
            void (async () => {
              trackFunnelEvent("PhotoUploadStarted", { species: selectedSpecies });
              const result = await setPhotoFromFile(file);
              if (!result.ok) {
                setPhotoError(result.message);
                return;
              }
              trackFunnelEvent("PhotoUploadCompleted", { species: selectedSpecies });
              setPhotoError(undefined);
              setErrors((current) => ({ ...current, photo: undefined }));
            })();
          }}
          onFileRejected={(message) => setPhotoError(message)}
          onClear={() => {
            clearPhoto();
            setPhotoError(undefined);
          }}
        />

        <p className="text-center text-xs text-[#f6efe4]/55">
          Takes a few seconds · Your photo stays private
        </p>

        <aside className="flex items-center gap-3 rounded-2xl border border-[#f6efe4]/10 bg-[#1a1410]/80 p-3">
          <img
            src={wowImage}
            alt=""
            width={72}
            height={108}
            loading="lazy"
            decoding="async"
            className="h-[72px] w-12 shrink-0 rounded-lg object-cover"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#f6efe4]">One photo. Incredible secret lives.</p>
            <p className="mt-0.5 text-xs leading-5 text-[#f6efe4]/55">
              Same face — transformed into scenes like this.
            </p>
          </div>
        </aside>

        <div>
          <Label htmlFor={emailId} className="text-[#f6efe4]">
            Email
          </Label>
          <Input
            id={emailId}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={draft.email}
            placeholder="you@email.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? emailErrorId : undefined}
            className={`mt-2 ${petFieldClass(Boolean(errors.email))}`}
            onChange={(event) => {
              draft.setEmail(event.target.value);
              setErrors((current) => ({ ...current, email: undefined }));
            }}
          />
          <FieldError id={emailErrorId} message={errors.email} />
        </div>

        <PersonalityPicker
          value={draft.personality || PET_DEFAULT_PERSONALITY}
          error={errors.personality}
          onChange={(personality) => {
            draft.setPersonality(personality);
            setErrors((current) => ({ ...current, personality: undefined }));
          }}
        />

        {storageMessage ? (
          <p className="text-sm text-[#f3d48a]" role="status">
            {storageMessage}
          </p>
        ) : null}

        <Button
          type="submit"
          className="h-12 min-h-[44px] w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63]"
        >
          Continue — no charge yet
        </Button>
        <p className="text-center text-xs text-[#f6efe4]/45">
          Your photo is used only to create your order.
        </p>
      </form>
    </PetShell>
  );
}
