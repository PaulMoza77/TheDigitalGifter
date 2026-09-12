import type { PetCopyMap } from "./en";
import { PET_COPY_EN } from "./en";
import { PET_COPY_RO } from "./ro";
import { PET_COPY_HU } from "./hu";
import { PET_COPY_DE } from "./de";
import { PET_COPY_IT } from "./it";
import { PET_COPY_FR } from "./fr";
import { PET_COPY_ES } from "./es";
import { PET_COPY_PT } from "./pt";
import { PET_COPY_NL } from "./nl";
import { PET_COPY_PL } from "./pl";
import type { PetUiLocale } from "../locales";
import { PET_DEFAULT_LOCALE } from "../locales";

export type { PetCopyMap } from "./en";

export const PET_COPY_PACKS: Record<PetUiLocale, PetCopyMap> = {
  en: PET_COPY_EN,
  ro: PET_COPY_RO,
  hu: PET_COPY_HU,
  de: PET_COPY_DE,
  it: PET_COPY_IT,
  fr: PET_COPY_FR,
  es: PET_COPY_ES,
  pt: PET_COPY_PT,
  nl: PET_COPY_NL,
  pl: PET_COPY_PL,
};

export type PetCopyVars = Record<string, string | number | null | undefined>;

export function petT(
  key: string,
  locale: PetUiLocale = PET_DEFAULT_LOCALE,
  vars?: PetCopyVars,
): string {
  const pack = PET_COPY_PACKS[locale] || PET_COPY_EN;
  let text = pack[key] ?? PET_COPY_EN[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(value == null ? "" : String(value));
    }
  }
  return text;
}

export function petSpeciesWord(
  species: "dog" | "cat" | "other",
  locale: PetUiLocale,
  form: "label" | "lower" | "your" = "lower",
): string {
  if (form === "label") {
    if (species === "dog") return petT("species.dog", locale);
    if (species === "cat") return petT("species.cat", locale);
    return petT("species.other", locale);
  }
  if (form === "your") {
    if (species === "dog") return petT("species.yourDog", locale);
    if (species === "cat") return petT("species.yourCat", locale);
    return petT("species.yourPet", locale);
  }
  if (species === "dog") return petT("species.dogLower", locale);
  if (species === "cat") return petT("species.catLower", locale);
  return petT("species.pet", locale);
}

/** @deprecated Prefer species-specific keys or petSpeciesWord(..., "your"). */
export function petPossessivePet(
  species: "dog" | "cat" | "other",
  locale: PetUiLocale,
): string {
  return petSpeciesWord(species, locale, "your");
}
