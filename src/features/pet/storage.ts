import {
  PET_DRAFT_STORAGE_KEY,
  PET_PERSONALITIES,
  PET_PHOTO_CONTENT_TYPES,
  PET_SPECIES,
  type PetFunnelDraft,
  type PetPersistedDraft,
  type PetPersonality,
  type PetPhotoContentType,
  type PetSpecies,
} from "./types";

const EMPTY_DRAFT: PetFunnelDraft = {
  petName: "",
  species: null,
  personality: null,
  email: "",
  photo: null,
  photoPreviewDataUrl: null,
  updatedAt: "",
};

const MAX_PREVIEW_CHARS = 180_000;

export function createEmptyPetDraft(): PetFunnelDraft {
  return { ...EMPTY_DRAFT };
}

export function loadPetDraft(): PetFunnelDraft {
  if (typeof window === "undefined") return createEmptyPetDraft();

  try {
    const raw = window.localStorage.getItem(PET_DRAFT_STORAGE_KEY);
    if (!raw) return createEmptyPetDraft();

    const parsed: unknown = JSON.parse(raw);
    const draft = coercePersistedDraft(parsed);
    return draft ?? createEmptyPetDraft();
  } catch {
    return createEmptyPetDraft();
  }
}

export function savePetDraft(draft: PetFunnelDraft): { ok: boolean; message?: string } {
  if (typeof window === "undefined") {
    return { ok: false, message: "Storage is not available." };
  }

  const safePreview =
    draft.photoPreviewDataUrl && draft.photoPreviewDataUrl.length > MAX_PREVIEW_CHARS
      ? null
      : draft.photoPreviewDataUrl;

  const payload: PetPersistedDraft = {
    version: 1,
    draft: {
      ...draft,
      photoPreviewDataUrl: safePreview,
      updatedAt: new Date().toISOString(),
    },
  };

  try {
    window.localStorage.setItem(PET_DRAFT_STORAGE_KEY, JSON.stringify(payload));
    return { ok: true };
  } catch {
    try {
      const withoutPreview: PetPersistedDraft = {
        version: 1,
        draft: { ...payload.draft, photoPreviewDataUrl: null },
      };
      window.localStorage.setItem(PET_DRAFT_STORAGE_KEY, JSON.stringify(withoutPreview));
      return {
        ok: true,
        message: "Draft saved without the photo preview because storage was full.",
      };
    } catch {
      return {
        ok: false,
        message: "Could not save your draft on this device. You can still continue.",
      };
    }
  }
}

export function clearPetDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PET_DRAFT_STORAGE_KEY);
  } catch {
    // Ignore quota / privacy-mode failures.
  }
}

let inMemoryPhotoFile: File | null = null;
let inMemoryObjectUrl: string | null = null;

export function setPetPhotoFile(file: File | null): string | null {
  if (inMemoryObjectUrl) {
    URL.revokeObjectURL(inMemoryObjectUrl);
    inMemoryObjectUrl = null;
  }

  inMemoryPhotoFile = file;
  if (!file) return null;

  inMemoryObjectUrl = URL.createObjectURL(file);
  return inMemoryObjectUrl;
}

export function getPetPhotoFile(): File | null {
  return inMemoryPhotoFile;
}

export function getPetPhotoObjectUrl(): string | null {
  return inMemoryObjectUrl;
}

export async function createSafePhotoPreview(file: File): Promise<string | null> {
  if (typeof window === "undefined" || typeof createImageBitmap !== "function") {
    return null;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxEdge = 720;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return null;
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
    if (!dataUrl.startsWith("data:image/jpeg") || dataUrl.length > MAX_PREVIEW_CHARS) {
      return null;
    }
    return dataUrl;
  } catch {
    return null;
  }
}

function coercePersistedDraft(value: unknown): PetFunnelDraft | null {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.draft)) {
    return null;
  }

  const draft = value.draft;
  const species = asEnum(draft.species, PET_SPECIES);
  const personality = asEnum(draft.personality, PET_PERSONALITIES);
  const photo = coercePhotoMeta(draft.photo);
  const preview =
    typeof draft.photoPreviewDataUrl === "string" &&
    draft.photoPreviewDataUrl.startsWith("data:image/")
      ? draft.photoPreviewDataUrl.slice(0, MAX_PREVIEW_CHARS)
      : null;

  return {
    petName: typeof draft.petName === "string" ? draft.petName.slice(0, 40) : "",
    species,
    personality,
    email: typeof draft.email === "string" ? draft.email.slice(0, 120) : "",
    photo,
    photoPreviewDataUrl: preview,
    updatedAt: typeof draft.updatedAt === "string" ? draft.updatedAt : "",
  };
}

function coercePhotoMeta(value: unknown): PetFunnelDraft["photo"] {
  if (!isRecord(value)) return null;
  const contentType = asEnum(value.contentType, PET_PHOTO_CONTENT_TYPES);
  if (!contentType) return null;
  if (typeof value.fileName !== "string" || typeof value.byteSize !== "number") {
    return null;
  }

  return {
    fileName: value.fileName.slice(0, 180),
    contentType: contentType as PetPhotoContentType,
    byteSize: value.byteSize,
    width: typeof value.width === "number" ? value.width : null,
    height: typeof value.height === "number" ? value.height : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asEnum<T extends string>(
  value: unknown,
  options: readonly T[]
): T | null {
  if (typeof value !== "string") return null;
  return (options as readonly string[]).includes(value) ? (value as T) : null;
}

export function isPetSpecies(value: string | null): value is PetSpecies {
  return value !== null && (PET_SPECIES as readonly string[]).includes(value);
}

export function isPetPersonality(value: string | null): value is PetPersonality {
  return value !== null && (PET_PERSONALITIES as readonly string[]).includes(value);
}
