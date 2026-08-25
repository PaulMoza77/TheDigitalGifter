import { PET_V3_DRAFT_STORAGE_KEY, PET_V3_SPECIES, PET_V3_STEPS, type PetV3Draft, type PetV3Step } from "./types";

const EMPTY: PetV3Draft = {
  species: PET_V3_SPECIES,
  step: "landing",
  photo: null,
  uploadId: null,
  previewAttemptId: null,
  photoPreviewDataUrl: null,
  generatedPreviewDataUrl: null,
  generationMode: null,
  previewCount: 0,
  lastError: null,
  email: "",
  petName: "",
  subtype: null,
  subtypeDetail: null,
  updatedAt: "",
};

let inMemoryFile: File | null = null;
let inMemoryObjectUrl: string | null = null;

export function createEmptyV3Draft(): PetV3Draft {
  return { ...EMPTY };
}

export function loadV3Draft(): PetV3Draft {
  if (typeof window === "undefined") return createEmptyV3Draft();
  try {
    const raw = window.sessionStorage.getItem(PET_V3_DRAFT_STORAGE_KEY);
    if (!raw) return createEmptyV3Draft();
    const parsed: unknown = JSON.parse(raw);
    return coerce(parsed) ?? createEmptyV3Draft();
  } catch {
    return createEmptyV3Draft();
  }
}

export function saveV3Draft(draft: PetV3Draft): void {
  if (typeof window === "undefined") return;
  const stamped = { ...draft, updatedAt: new Date().toISOString() };
  try {
    window.sessionStorage.setItem(PET_V3_DRAFT_STORAGE_KEY, JSON.stringify(stamped));
  } catch {
    try {
      window.sessionStorage.setItem(
        PET_V3_DRAFT_STORAGE_KEY,
        JSON.stringify({ ...stamped, photoPreviewDataUrl: null, generatedPreviewDataUrl: null }),
      );
    } catch {
      /* quota */
    }
  }
}

export function setV3PhotoFile(file: File | null): string | null {
  if (inMemoryObjectUrl) {
    URL.revokeObjectURL(inMemoryObjectUrl);
    inMemoryObjectUrl = null;
  }
  inMemoryFile = file;
  if (!file) return null;
  inMemoryObjectUrl = URL.createObjectURL(file);
  return inMemoryObjectUrl;
}

export function getV3PhotoFile(): File | null {
  return inMemoryFile;
}

export function getV3PhotoObjectUrl(): string | null {
  return inMemoryObjectUrl;
}

function coerce(value: unknown): PetV3Draft | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const step = (PET_V3_STEPS as readonly string[]).includes(String(row.step))
    ? (row.step as PetV3Step)
    : "landing";
  return {
    species: PET_V3_SPECIES,
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
    uploadId: typeof row.uploadId === "string" && row.uploadId.trim() ? row.uploadId.slice(0, 64) : null,
    previewAttemptId:
      typeof row.previewAttemptId === "string" && row.previewAttemptId.trim()
        ? row.previewAttemptId.slice(0, 180)
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
    subtype: null,
    subtypeDetail: null,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : "",
  };
}
