import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { petSourceImage } from "./catalog";
import { usePublicPetOffer } from "./usePublicPetOffer";
import {
  FieldError,
  PersonalityPicker,
  PetShell,
  PetTypePicker,
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
  const { priceDisplay } = usePublicPetOffer();
  const { draft, previewUrl, hasOriginalFile, storageMessage, setPhotoFromFile, clearPhoto } =
    usePetDraft();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [photoError, setPhotoError] = useState<string | undefined>();
  const nameId = useId();
  const emailId = useId();
  const nameErrorId = useId();
  const emailErrorId = useId();
  const selectedSpecies = draft.species ?? species;

  useEffect(() => {
    draft.setSpecies(species);
    // Landing CTA chooses the type. Do not re-run when the local draft object identity changes.
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
    });
    if (!result.ok) setErrors(result.errors);
  }, [forceErrors, draft.petName, draft.species, draft.personality, draft.email, draft.photo]);

  function continueToCheckout() {
    const result = validatePetDraft({
      petName: draft.petName,
      species: draft.species,
      personality: draft.personality,
      email: draft.email,
      photo: draft.photo,
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
        className="mx-auto max-w-xl space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          continueToCheckout();
        }}
        noValidate
      >
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#f6efe4]">
            Start with one photo
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#f6efe4]/65">
            We keep this face in all twelve portraits and both cinematic clips.
          </p>
        </div>

        <PhotoUploader
          previewUrl={previewUrl}
          fileName={draft.photo?.fileName}
          byteSize={draft.photo?.byteSize}
          needsOriginalFile={Boolean(draft.photo) && !hasOriginalFile}
          error={photoError ?? errors.photo}
          exampleImage={petSourceImage(selectedSpecies)}
          onFileAccepted={async (file) => {
            const result = await setPhotoFromFile(file);
            if (!result.ok) {
              setPhotoError(result.message);
              return;
            }
            setPhotoError(undefined);
            setErrors((current) => ({ ...current, photo: undefined }));
          }}
          onFileRejected={(message) => setPhotoError(message)}
          onClear={() => {
            clearPhoto();
            setPhotoError(undefined);
          }}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor={nameId} className="text-[#f6efe4]">
              Pet name
            </Label>
            <Input
              id={nameId}
              name="petName"
              value={draft.petName}
              autoComplete="off"
              maxLength={40}
              placeholder="Maple"
              aria-invalid={Boolean(errors.petName)}
              aria-describedby={errors.petName ? nameErrorId : undefined}
              className={`mt-2 ${petFieldClass(Boolean(errors.petName))}`}
              onChange={(event) => {
                draft.setPetName(event.target.value);
                setErrors((current) => ({ ...current, petName: undefined }));
              }}
            />
            <FieldError id={nameErrorId} message={errors.petName} />
          </div>

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
        </div>

        <PetTypePicker
          value={draft.species}
          error={errors.species}
          onChange={(species) => {
            draft.setSpecies(species);
            setErrors((current) => ({ ...current, species: undefined }));
          }}
        />

        <PersonalityPicker
          value={draft.personality}
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
          className="h-12 w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63]"
        >
          Continue — {priceDisplay}
        </Button>
        <p className="text-center text-xs text-[#f6efe4]/50">
          {priceDisplay} once · No subscription
        </p>
      </form>
    </PetShell>
  );
}
