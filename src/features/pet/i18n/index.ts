export {
  PET_UI_LOCALE_CODES,
  PET_UI_LOCALES,
  PET_DEFAULT_LOCALE,
  detectBrowserPetLocale,
  isPetUiLocale,
  normalizePetUiLocale,
  type PetUiLocale,
} from "./locales";
export {
  parsePetLocalePath,
  petPathForLocale,
  withPetLocale,
  isPetAppPath,
  normalizePetPath,
} from "./localeRouting";
export { petT, petSpeciesWord, petPossessivePet, PET_COPY_PACKS } from "./copy";
export { usePetLocale, usePetT, usePetBrowserLocaleRedirect } from "./usePetLocale";
export { PetLanguageSwitcher } from "./PetLanguageSwitcher";
export { petLocalePrefixedRoutes } from "./petLocaleRoutes";
