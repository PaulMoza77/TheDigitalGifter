/** Client-side species confirmation before free preview generation. */

import { petT, type PetUiLocale } from "../pet/i18n";

export type SpeciesConfirmKind = "dog" | "cat";

export function speciesConfirmLabel(
  kind: SpeciesConfirmKind,
  locale: PetUiLocale = "en",
): string {
  return kind === "cat"
    ? petT("v2.photo.confirm.cat", locale)
    : petT("v2.photo.confirm.dog", locale);
}

export function speciesConfirmRequiredError(
  kind: SpeciesConfirmKind,
  locale: PetUiLocale = "en",
): string {
  return kind === "cat"
    ? petT("v2.photo.confirmErr.cat", locale)
    : petT("v2.photo.confirmErr.dog", locale);
}

export function canGenerateWithSpeciesConfirm(input: {
  hasPhoto: boolean;
  confirmed: boolean;
  kind: SpeciesConfirmKind | null;
  locale?: PetUiLocale;
}): { ok: true } | { ok: false; message: string } {
  const locale = input.locale ?? "en";
  if (!input.hasPhoto) {
    return { ok: false, message: petT("v2.photo.needPhoto", locale) };
  }
  if (input.kind && !input.confirmed) {
    return { ok: false, message: speciesConfirmRequiredError(input.kind, locale) };
  }
  return { ok: true };
}
