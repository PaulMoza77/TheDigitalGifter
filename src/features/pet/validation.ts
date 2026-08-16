import { z } from "zod";
import {
  PET_PERSONALITIES,
  PET_PHOTO_CONTENT_TYPES,
  PET_PHOTO_MAX_BYTES,
  PET_SPECIES,
  type PetPhotoContentType,
  type PetPhotoMeta,
} from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const petDraftSchema = z.object({
  petName: z
    .string()
    .trim()
    .min(1, "Give your pet a name — even a nickname works.")
    .max(40, "Keep the name under 40 characters."),
  species: z.enum(PET_SPECIES, {
    error: "Choose dog, cat, or other.",
  }),
  personality: z.enum(PET_PERSONALITIES, {
    error: "Pick the personality that should show up in every scene.",
  }),
  email: z
    .string()
    .trim()
    .min(1, "We need an email for the order and downloads.")
    .refine((value) => EMAIL_RE.test(value), "Enter a valid email address."),
  photo: z.custom<PetPhotoMeta>((value) => Boolean(value), {
    message: "Upload a photo of your pet first.",
  }),
});

export type PetDraftFormValues = z.infer<typeof petDraftSchema>;

export type FieldErrors = Partial<
  Record<"petName" | "species" | "personality" | "email" | "photo", string>
>;

export function validatePetDraft(input: {
  petName: string;
  species: string | null;
  personality: string | null;
  email: string;
  photo: PetPhotoMeta | null;
}): { ok: true; values: PetDraftFormValues } | { ok: false; errors: FieldErrors } {
  const parsed = petDraftSchema.safeParse({
    petName: input.petName,
    species: input.species,
    personality: input.personality,
    email: input.email,
    photo: input.photo,
  });

  if (parsed.success) {
    return { ok: true, values: parsed.data };
  }

  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (
      key === "petName" ||
      key === "species" ||
      key === "personality" ||
      key === "email" ||
      key === "photo"
    ) {
      if (!errors[key]) errors[key] = issue.message;
    }
  }
  return { ok: false, errors };
}

const EXTENSION_BY_TYPE: Record<PetPhotoContentType, readonly string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

export type PhotoValidationResult =
  | { ok: true; contentType: PetPhotoContentType }
  | { ok: false; message: string };

export function validatePetPhotoFile(file: File): PhotoValidationResult {
  if (file.size <= 0) {
    return { ok: false, message: "That file looks empty. Try another photo." };
  }

  if (file.size > PET_PHOTO_MAX_BYTES) {
    return {
      ok: false,
      message: "Photos must be 15 MB or smaller. Try a slightly smaller file.",
    };
  }

  const contentType = normalizePhotoContentType(file.type, file.name);
  if (!contentType) {
    return {
      ok: false,
      message: "Use a JPEG, PNG, or WebP photo.",
    };
  }

  return { ok: true, contentType };
}

export function normalizePhotoContentType(
  mimeType: string,
  fileName: string
): PetPhotoContentType | null {
  const loweredMime = mimeType.toLowerCase();
  if ((PET_PHOTO_CONTENT_TYPES as readonly string[]).includes(loweredMime)) {
    return loweredMime as PetPhotoContentType;
  }

  const loweredName = fileName.toLowerCase();
  for (const type of PET_PHOTO_CONTENT_TYPES) {
    if (EXTENSION_BY_TYPE[type].some((ext) => loweredName.endsWith(ext))) {
      return type;
    }
  }

  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
