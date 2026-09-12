/**
 * Client pet locale path helpers (Strategy A, same as Christmas).
 * English: /pet/... · Others: /{locale}/pet/...
 */

import {
  PET_DEFAULT_LOCALE,
  PET_UI_LOCALES,
  isPetUiLocale,
  type PetUiLocale,
} from "./locales";

const LOCALE_PREFIX_RE = /^\/([a-z]{2})(\/|$)/i;

export function normalizePetPath(pathname: string): string {
  const raw = String(pathname || "").split("?")[0].split("#")[0];
  if (!raw || raw === "/") return "/";
  return raw.replace(/\/+$/, "") || "/";
}

export function isPetAppPath(pathname: string): boolean {
  const { basePath } = parsePetLocalePath(pathname);
  return (
    basePath === "/pet" ||
    basePath.startsWith("/pet/") ||
    basePath === "/pet-v2" ||
    basePath.startsWith("/pet-v2/")
  );
}

export function parsePetLocalePath(pathname: string): {
  locale: PetUiLocale;
  basePath: string;
  publicPath: string;
  isPrefixed: boolean;
} {
  const raw = normalizePetPath(pathname);
  const match = raw.match(LOCALE_PREFIX_RE);
  if (!match) {
    return { locale: PET_DEFAULT_LOCALE, basePath: raw, publicPath: raw, isPrefixed: false };
  }
  const prefix = match[1].toLowerCase();
  if (prefix === "en") {
    const rest = normalizePetPath(raw.slice(3) || "/");
    return {
      locale: PET_DEFAULT_LOCALE,
      basePath: rest,
      publicPath: rest,
      isPrefixed: true,
    };
  }
  const known = PET_UI_LOCALES.find((l) => l.prefix === prefix);
  if (!known || !isPetUiLocale(known.code)) {
    return { locale: PET_DEFAULT_LOCALE, basePath: raw, publicPath: raw, isPrefixed: false };
  }
  const rest = normalizePetPath(raw.slice(prefix.length + 1) || "/");
  if (!rest.startsWith("/pet") && rest !== "/pet-v2" && !rest.startsWith("/pet-v2/")) {
    // Prefix belongs to another product (e.g. /ro/christmas) — not a pet locale path.
    return { locale: PET_DEFAULT_LOCALE, basePath: raw, publicPath: raw, isPrefixed: false };
  }
  return {
    locale: known.code,
    basePath: rest,
    publicPath: raw,
    isPrefixed: true,
  };
}

/** Map current pet URL to the same page in another locale. */
export function petPathForLocale(pathname: string, locale: PetUiLocale): string {
  const { basePath } = parsePetLocalePath(pathname);
  if (!isPetAppPath(pathname) && !basePath.startsWith("/pet")) {
    return normalizePetPath(pathname);
  }
  if (locale === "en") return basePath;
  const def = PET_UI_LOCALES.find((l) => l.code === locale);
  if (!def?.prefix) return basePath;
  return normalizePetPath(`/${def.prefix}${basePath}`);
}

export function withPetLocale(path: string, locale: PetUiLocale): string {
  const base = normalizePetPath(path.startsWith("/") ? path : `/${path}`);
  return petPathForLocale(base, locale);
}
