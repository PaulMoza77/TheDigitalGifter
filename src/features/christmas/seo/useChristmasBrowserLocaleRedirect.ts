import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  christmasHtmlLang,
  detectBrowserChristmasLocale,
  isChristmasAppPath,
  parseChristmasLocalePath,
  planChristmasBrowserLocaleRedirect,
  readChristmasLocaleAutoFlag,
  readChristmasLocalePreference,
  writeChristmasLocaleAutoFlag,
  writeChristmasLocalePreference,
} from "./localeRouting";

/**
 * On first visit to an unprefixed /christmas URL, detect browser language and
 * apply it immediately (replace-navigate to /{locale}/christmas/...).
 * Prefixed URLs and an explicit English preference win.
 */
export function useChristmasBrowserLocaleRedirect(): void {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isChristmasAppPath(pathname)) return;

    const parsed = parseChristmasLocalePath(pathname);
    const preference = readChristmasLocalePreference();
    const autoAlreadyRan = readChristmasLocaleAutoFlag();
    const detected = detectBrowserChristmasLocale();
    const plan = planChristmasBrowserLocaleRedirect({
      pathname,
      search,
      preference,
      autoAlreadyRan,
      detected,
    });

    if (!parsed.isPrefixed && !preference && !autoAlreadyRan) {
      writeChristmasLocaleAutoFlag();
    }

    writeChristmasLocalePreference(plan.locale);
    if (typeof document !== "undefined") {
      document.documentElement.lang = christmasHtmlLang(plan.locale);
    }

    if (plan.kind === "redirect") {
      const current = `${pathname}${search}`;
      if (plan.path !== current) {
        void navigate(plan.path, { replace: true });
      }
    }
  }, [pathname, search, navigate]);
}
