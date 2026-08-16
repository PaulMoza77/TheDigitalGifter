import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PET_OFFER } from "./catalog";
import {
  FieldError,
  PersonalityPicker,
  PetShell,
  PetTypePicker,
  PhotoUploader,
  PriceBadge,
  petFieldClass,
} from "./components";
import type { FieldErrors } from "./validation";
import { validatePetDraft } from "./validation";
import type { PetFunnelNavigation } from "./types";
import { usePetDraft } from "./usePetDraft";

export type PetCreatePageProps = {
  navigation?: PetFunnelNavigation;
  /** Preview-only: show validation errors without submitting. */
  forceErrors?: boolean;
};

export function PetCreatePage({ navigation, forceErrors = false }: PetCreatePageProps) {
  const { draft, previewUrl, hasOriginalFile, storageMessage, setPhotoFromFile, clearPhoto } =
    usePetDraft();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [photoError, setPhotoError] = useState<string | undefined>();
  const nameId = useId();
  const emailId = useId();
  const nameErrorId = useId();
  const emailErrorId = useId();

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
      setPhotoError(
        "Re-attach the original photo before continuing. The saved preview is only for display."
      );
      return;
    }

    setErrors({});
    setPhotoError(undefined);
    navigation?.goToCheckout();
  }

  return (
    <PetShell
      navigation={navigation}
      showBack
      backLabel="Back to the offer"
      onBack={() => navigation?.goToLanding()}
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form
          className="space-y-8"
          onSubmit={(event) => {
            event.preventDefault();
            continueToCheckout();
          }}
          noValidate
        >
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[#d4a84b]">Create</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#f6efe4] sm:text-4xl">
              Introduce the star of the gallery
            </h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-[#f6efe4]/72">
              One photo. A name. A vibe. We keep that face consistent across all twelve secret lives.
            </p>
          </div>

          <PhotoUploader
            previewUrl={previewUrl}
            fileName={draft.photo?.fileName}
            byteSize={draft.photo?.byteSize}
            needsOriginalFile={Boolean(draft.photo) && !hasOriginalFile}
            error={photoError ?? errors.photo}
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
              placeholder="Maple, Chairman Meow, Sir Barksalot…"
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

          <div>
            <Label htmlFor={emailId} className="text-[#f6efe4]">
              Email for the gallery
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
            <p className="mt-1.5 text-xs text-[#f6efe4]/55">
              Used only for this order, payment receipt, and download link.
            </p>
            <FieldError id={emailErrorId} message={errors.email} />
          </div>

          {storageMessage ? (
            <p className="text-sm text-[#f3d48a]" role="status">
              {storageMessage}
            </p>
          ) : null}

          <Button
            type="submit"
            className="h-12 w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63] sm:w-auto sm:px-8"
          >
            Continue to checkout — {PET_OFFER.priceDisplay}
          </Button>
        </form>

        <aside className="h-fit rounded-3xl border border-[#f6efe4]/10 bg-[#1f1712]/80 p-5 lg:sticky lg:top-6">
          <PriceBadge />
          <p className="mt-4 text-sm leading-6 text-[#f6efe4]/72">
            You are not starting a subscription. Checkout is a single {PET_OFFER.priceDisplay} payment
            for 12 QC-approved portraits after human quality control. Extra crops are not included.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-[#f6efe4]/75">
            {PET_OFFER.includes.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </aside>
      </div>
    </PetShell>
  );
}
