import type { PetV2Draft, PetV2Species } from "./types";
import { clearPreviewOnPhotoChange } from "./previewFlow";

/**
 * V2 Dog/Cat/Other tabs share one draft key. Switching routes must not reuse
 * another species' photo/preview (that caused cross-species prompt/copy bugs).
 */
export function draftAfterSpeciesRouteChange(
  previous: PetV2Draft,
  nextSpecies: PetV2Species,
): { draft: PetV2Draft; clearInMemoryPhoto: boolean } {
  if (previous.species === nextSpecies) {
    return { draft: { ...previous, species: nextSpecies }, clearInMemoryPhoto: false };
  }
  return {
    draft: {
      ...previous,
      ...clearPreviewOnPhotoChange({
        photo: null,
        uploadId: null,
        photoPreviewDataUrl: null,
      }),
      species: nextSpecies,
      step: "landing",
      lastError: null,
      previewCount: 0,
    },
    clearInMemoryPhoto: true,
  };
}
