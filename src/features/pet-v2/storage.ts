import { PET_V2_DRAFT_STORAGE_KEY, PET_V2_STEPS, type PetV2Draft, type PetV2Species, type PetV2Step } from "./types";

const EMPTY: PetV2Draft = {
  species: "dog",
  step: "landing",
  photo: null,
  photoPreviewDataUrl: null,
  generatedPreviewDataUrl: null,
  generationMode: null,
  previewCount: 0,
  lastError: null,
  email: "",
  petName: "",
  updatedAt: "",
};

let inMemoryFile: File | null = null;
let inMemoryObjectUrl: string | null = null;

export function createEmptyV2Draft(species: PetV2Species = "dog"): PetV2Draft {
  return { ...EMPTY, species };
}

export function loadV2Draft(): PetV2Draft {
  if (typeof window === "undefined") return createEmptyV2Draft();
  try {
    const raw = window.sessionStorage.getItem(PET_V2_DRAFT_STORAGE_KEY);
    if (!raw) return createEmptyV2Draft();
    const parsed: unknown = JSON.parse(raw);
    return coerce(parsed) ?? createEmptyV2Draft();
  } catch {
    return createEmptyV2Draft();
  }
}

export function saveV2Draft(draft: PetV2Draft): void {
  if (typeof window === "undefined") return;
  const stamped = { ...draft, updatedAt: new Date().toISOString() };
  try {
    window.sessionStorage.setItem(PET_V2_DRAFT_STORAGE_KEY, JSON.stringify(stamped));
  } catch {
    try {
      window.sessionStorage.setItem(
        PET_V2_DRAFT_STORAGE_KEY,
        JSON.stringify({ ...stamped, photoPreviewDataUrl: null, generatedPreviewDataUrl: null }),
      );
    } catch {
      /* quota */
    }
  }
}

export function setV2PhotoFile(file: File | null): string | null {
  if (inMemoryObjectUrl) {
    URL.revokeObjectURL(inMemoryObjectUrl);
    inMemoryObjectUrl = null;
  }
  inMemoryFile = file;
  if (!file) return null;
  inMemoryObjectUrl = URL.createObjectURL(file);
  return inMemoryObjectUrl;
}

export function getV2PhotoFile(): File | null {
  return inMemoryFile;
}

export function getV2PhotoObjectUrl(): string | null {
  return inMemoryObjectUrl;
}

function coerce(value: unknown): PetV2Draft | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const species = row.species === "cat" || row.species === "other" ? row.species : "dog";
  const step = (PET_V2_STEPS as readonly string[]).includes(String(row.step))
    ? (row.step as PetV2Step)
    : "landing";
  return {
    species,
    step,
    photo:
      row.photo && typeof row.photo === "object"
        ? {
            fileName: String((row.photo as { fileName?: string }).fileName || "photo.jpg").slice(0, 180),
            contentType:
              (row.photo as { contentType?: string }).contentType === "image/png"
                ? "image/png"
                : (row.photo as { contentType?: string }).contentType === "image/webp"
                  ? "image/webp"
                  : "image/jpeg",
            byteSize: Number((row.photo as { byteSize?: number }).byteSize) || 0,
          }
        : null,
    photoPreviewDataUrl:
      typeof row.photoPreviewDataUrl === "string" && row.photoPreviewDataUrl.startsWith("data:image/")
        ? row.photoPreviewDataUrl
        : null,
    generatedPreviewDataUrl:
      typeof row.generatedPreviewDataUrl === "string" &&
      row.generatedPreviewDataUrl.startsWith("data:image/")
        ? row.generatedPreviewDataUrl
        : null,
    generationMode: row.generationMode === "live" || row.generationMode === "mock" ? row.generationMode : null,
    previewCount: Math.max(0, Number(row.previewCount) || 0),
    lastError: typeof row.lastError === "string" ? row.lastError : null,
    email: typeof row.email === "string" ? row.email.slice(0, 120) : "",
    petName: typeof row.petName === "string" ? row.petName.slice(0, 40) : "",
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : "",
  };
}
