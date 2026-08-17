import {
  PET_DEFAULT_DELIVERY_ESTIMATE,
  PET_DEFAULT_PERSONALITY,
  PET_SUBTYPES,
  type PetSpecies,
  type PetSubtype,
} from "./types";

export const PET_NAME_MAX_LENGTH = 40;
export const PET_SUBTYPE_DETAIL_MAX_LENGTH = 40;

const NAME_RE = /^[\p{L}][\p{L}\p{N} .'-]{0,38}$/u;
const PII_KEYS = [
  "petName",
  "name",
  "email",
  "photo",
  "photoUrl",
  "imageUrl",
  "url",
  "token",
  "publicToken",
  "storagePath",
  "fileName",
  "subtypeDetail",
] as const;

export function normalizePetName(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, PET_NAME_MAX_LENGTH);
}

export function validatePetName(value: string): { ok: true; name: string } | { ok: false; message: string } {
  const name = normalizePetName(value);
  if (!name) {
    return { ok: false, message: "Give your pet a name — even a nickname works." };
  }
  if (name.length > PET_NAME_MAX_LENGTH) {
    return { ok: false, message: "Keep the name under 40 characters." };
  }
  if (!NAME_RE.test(name)) {
    return {
      ok: false,
      message: "Use letters, numbers, spaces, apostrophes, or hyphens.",
    };
  }
  return { ok: true, name };
}

export function petPossessive(name: string): string {
  const trimmed = normalizePetName(name);
  if (!trimmed) return "their";
  return /s$/i.test(trimmed) ? `${trimmed}’` : `${trimmed}’s`;
}

export function createSecretLivesCta(name: string): string {
  const checked = validatePetName(name);
  if (!checked.ok) return "Create their secret lives →";
  return `Create ${petPossessive(checked.name)} secret lives →`;
}

export function isPetSubtype(value: string | null | undefined): value is PetSubtype {
  return Boolean(value && (PET_SUBTYPES as readonly string[]).includes(value));
}

export function normalizeSubtypeDetail(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, PET_SUBTYPE_DETAIL_MAX_LENGTH);
}

export function validateOtherSubtype(input: {
  species: PetSpecies | null;
  subtype: string | null;
  subtypeDetail?: string | null;
}): { ok: true; subtype: PetSubtype | null; subtypeDetail: string | null } | { ok: false; message: string } {
  if (input.species !== "other") {
    return { ok: true, subtype: null, subtypeDetail: null };
  }
  if (!isPetSubtype(input.subtype)) {
    return { ok: false, message: "Choose what kind of pet you have." };
  }
  if (input.subtype !== "other") {
    return { ok: true, subtype: input.subtype, subtypeDetail: null };
  }
  const detail = normalizeSubtypeDetail(input.subtypeDetail || "");
  if (!detail) {
    return { ok: false, message: "Tell us what kind of pet." };
  }
  return { ok: true, subtype: "other", subtypeDetail: detail };
}

export function landingNameStepCreatesOrder(): false {
  return false;
}

export function petNameBelongsInUrl(): false {
  return false;
}

export function checkoutAllowedWithOffer(input: {
  amountCents: number | null;
  offerVerified: boolean;
}): boolean {
  return input.offerVerified && Number(input.amountCents) > 0;
}

export function sanitizeFunnelAnalyticsPayload(
  payload: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  if (!payload) return next;
  for (const [key, value] of Object.entries(payload)) {
    if ((PII_KEYS as readonly string[]).includes(key)) continue;
    if (typeof value === "string" && /@/.test(value)) continue;
    if (typeof value === "string" && /^https?:/i.test(value)) continue;
    next[key] = value;
  }
  return next;
}

export function canAutoplayHeroVideo(input: {
  prefersReducedMotion: boolean;
  saveData?: boolean;
  effectiveType?: string;
}): boolean {
  if (input.prefersReducedMotion) return false;
  if (input.saveData) return false;
  const network = String(input.effectiveType || "").toLowerCase();
  if (network === "slow-2g" || network === "2g") return false;
  return true;
}

export function otherGalleryImpliesSamePet(): false {
  return false;
}

export function defaultPersonality() {
  return PET_DEFAULT_PERSONALITY;
}

export function deliveryEstimateLabel(value?: string | null): string {
  const trimmed = String(value || "").trim();
  return trimmed || PET_DEFAULT_DELIVERY_ESTIMATE;
}

export function mixedOtherGalleryLabel(): string {
  return "Made for many kinds of pets";
}
