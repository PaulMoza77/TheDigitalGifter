import { useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  detectBrowserPetLocale,
  PET_DEFAULT_LOCALE,
  readPetLocaleAutoFlag,
  readPetLocalePreference,
  writePetLocaleAutoFlag,
  writePetLocalePreference,
  type PetUiLocale,
} from "./locales";
import {
  isPetAppPath,
  parsePetLocalePath,
  petPathForLocale,
} from "./localeRouting";
import { petT, type PetCopyVars } from "./copy";

/**
 * Resolve active pet UI locale from the URL (primary), then preference.
 * English remains the unprefixed default.
 */
export function usePetLocale(): PetUiLocale {
  const { pathname } = useLocation();
  return useMemo(() => {
    const parsed = parsePetLocalePath(pathname);
    if (parsed.isPrefixed) return parsed.locale;
    return readPetLocalePreference() ?? PET_DEFAULT_LOCALE;
  }, [pathname]);
}

export function usePetT(locale?: PetUiLocale) {
  const fromUrl = usePetLocale();
  const active = locale ?? fromUrl;
  return useCallback((key: string, vars?: PetCopyVars) => petT(key, active, vars), [active]);
}

/**
 * On first visit to an unprefixed /pet URL, detect browser language and
 * redirect once to /{locale}/pet/... when supported and not English.
 * Prefixed URLs and an explicit English preference win. EN stays primary.
 */
export function usePetBrowserLocaleRedirect(): void {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isPetAppPath(pathname)) return;

    const parsed = parsePetLocalePath(pathname);

    if (parsed.isPrefixed) {
      writePetLocalePreference(parsed.locale);
      if (typeof document !== "undefined") {
        document.documentElement.lang = parsed.locale;
      }
      return;
    }

    // Unprefixed English URL
    const preference = readPetLocalePreference();
    if (preference === "en") {
      if (typeof document !== "undefined") document.documentElement.lang = "en";
      return;
    }

    if (preference && preference !== "en") {
      const next = petPathForLocale(pathname, preference);
      if (next !== pathname) {
        void navigate(`${next}${search}`, { replace: true });
      }
      return;
    }

    // No preference yet — detect browser once per session tab.
    if (readPetLocaleAutoFlag()) {
      writePetLocalePreference("en");
      if (typeof document !== "undefined") document.documentElement.lang = "en";
      return;
    }

    writePetLocaleAutoFlag();
    const detected = detectBrowserPetLocale();
    writePetLocalePreference(detected);
    if (detected === "en") {
      if (typeof document !== "undefined") document.documentElement.lang = "en";
      return;
    }
    const next = petPathForLocale(pathname, detected);
    if (next !== pathname) {
      void navigate(`${next}${search}`, { replace: true });
    }
  }, [pathname, search, navigate]);
}
