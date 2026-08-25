import { useCallback, useRef, useState } from "react";
import type { PetFunnelDraft, PetPersonality, PetPhotoMeta, PetSpecies, PetSubtype } from "./types";
import {
  createEmptyPetDraft,
  createSafePhotoPreview,
  getPetPhotoFile,
  getPetPhotoObjectUrl,
  loadPetDraft,
  savePetDraft,
  setPetPhotoFile,
} from "./storage";
import { validatePetPhotoFile } from "./validation";
import { normalizePetPhotoFile } from "./photoNormalize";

export function usePetDraft() {
  const [draft, setDraft] = useState<PetFunnelDraft>(() => loadPetDraft());
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const persist = useCallback((next: PetFunnelDraft) => {
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    const result = savePetDraft(stamped);
    setStorageMessage(result.message ?? null);
    draftRef.current = stamped;
    setDraft(stamped);
  }, []);

  const update = useCallback(
    (patch: Partial<PetFunnelDraft>) => {
      persist({ ...draftRef.current, ...patch });
    },
    [persist]
  );

  const setPhotoFromFile = useCallback(
    async (file: File) => {
      const normalized = await normalizePetPhotoFile(file);
      if (!normalized.ok) {
        return { ok: false as const, message: normalized.message };
      }

      const validation = validatePetPhotoFile(normalized.file);
      if (!validation.ok) {
        return { ok: false as const, message: validation.message };
      }

      setPetPhotoFile(normalized.file);
      const preview = await createSafePhotoPreview(normalized.file);
      const meta: PetPhotoMeta = {
        fileName: normalized.file.name,
        contentType: validation.contentType,
        byteSize: normalized.file.size,
        width: null,
        height: null,
      };

      persist({
        ...draftRef.current,
        photo: meta,
        photoPreviewDataUrl: preview,
      });

      return { ok: true as const };
    },
    [persist]
  );

  const clearPhoto = useCallback(() => {
    setPetPhotoFile(null);
    persist({
      ...draftRef.current,
      photo: null,
      photoPreviewDataUrl: null,
    });
  }, [persist]);

  const reset = useCallback(() => {
    setPetPhotoFile(null);
    persist(createEmptyPetDraft());
  }, [persist]);

  return {
    draft: {
      ...draft,
      setPetName: (petName: string) => update({ petName }),
      setSpecies: (species: PetSpecies) =>
        update({
          species,
          subtype: species === "other" ? draftRef.current.subtype : null,
          subtypeDetail: species === "other" ? draftRef.current.subtypeDetail : null,
        }),
      setSubtype: (subtype: PetSubtype | null, subtypeDetail: string | null = null) =>
        update({ subtype, subtypeDetail: subtype === "other" ? subtypeDetail : null }),
      setPersonality: (personality: PetPersonality) => update({ personality }),
      setEmail: (email: string) => update({ email }),
    },
    previewUrl: getPetPhotoObjectUrl() ?? draft.photoPreviewDataUrl,
    hasOriginalFile: Boolean(getPetPhotoFile()),
    storageMessage,
    setPhotoFromFile,
    clearPhoto,
    reset,
    photoFile: getPetPhotoFile(),
  };
}
