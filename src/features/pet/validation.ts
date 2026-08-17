import { z } from "zod";
import { validateOtherSubtype, validatePetName } from "./croGuards";
import {
  PET_DEFAULT_PERSONALITY,
  PET_PERSONALITIES,
  PET_PHOTO_CONTENT_TYPES,
  PET_PHOTO_MAX_BYTES,
  PET_SPECIES,
  type PetPhotoContentType,
  type PetPhotoMeta,
  type PetSubtype,
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
  subtype: z.enum(["rabbit", "bird", "small_pet", "reptile", "horse", "other"]).nullable().optional(),
  subtypeDetail: z.string().trim().max(40).nullable().optional(),
});

export type PetDraftFormValues = z.infer<typeof petDraftSchema>;

export type FieldErrors = Partial<
  Record<
    "petName" | "species" | "personality" | "email" | "photo" | "subtype" | "subtypeDetail",
    string
  >
>;

export function validatePetDraft(input: {
  petName: string;
  species: string | null;
  personality: string | null;
  email: string;
  photo: PetPhotoMeta | null;
  subtype?: string | null;
  subtypeDetail?: string | null;
}): { ok: true; values: PetDraftFormValues } | { ok: false; errors: FieldErrors } {
  const named = validatePetName(input.petName);
  const subtypeCheck = validateOtherSubtype({
    species: (PET_SPECIES as readonly string[]).includes(String(input.species))
      ? (input.species as (typeof PET_SPECIES)[number])
      : null,
    subtype: input.subtype ?? null,
    subtypeDetail: input.subtypeDetail,
  });
  const parsed = petDraftSchema.safeParse({
    petName: named.ok ? named.name : input.petName,
    species: input.species,
    personality: input.personality || PET_DEFAULT_PERSONALITY,
    email: input.email,
    photo: input.photo,
    subtype: subtypeCheck.ok ? subtypeCheck.subtype : input.subtype,
    subtypeDetail: subtypeCheck.ok ? subtypeCheck.subtypeDetail : input.subtypeDetail,
  });

  if (parsed.success && named.ok && subtypeCheck.ok) {
    return {
      ok: true,
      values: {
        ...parsed.data,
        petName: named.name,
        subtype: subtypeCheck.subtype,
        subtypeDetail: subtypeCheck.subtypeDetail,
      },
    };
  }

  const errors: FieldErrors = {};
  if (!named.ok) errors.petName = named.message;
  if (!subtypeCheck.ok) errors.subtype = subtypeCheck.message;
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (
        key === "petName" ||
        key === "species" ||
        key === "personality" ||
        key === "email" ||
        key === "photo" ||
        key === "subtype" ||
        key === "subtypeDetail"
      ) {
        if (!errors[key]) errors[key] = issue.message;
      }
    }
  }
  return { ok: false, errors };
}

export function validateCreateStep(input: {
  petName: string;
  species: string | null;
  personality: string | null;
  email: string;
  photo: PetPhotoMeta | null;
  subtype?: string | null;
  subtypeDetail?: string | null;
}) {
  return validatePetDraft(input);
}

export type { PetSubtype };

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
