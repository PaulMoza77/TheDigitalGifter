import { useLocation, useNavigate } from "react-router-dom";
import {
  christmasHtmlLang,
  christmasPathForLocale,
  cleanChristmasSearchForLocaleSwitch,
  parseChristmasLocalePath,
  switchableChristmasLocales,
  writeChristmasLocalePreference,
  type ChristmasLocaleCode,
} from "./localeRouting";
import { useChristmasBrowserLocaleRedirect } from "./useChristmasBrowserLocaleRedirect";
import { cn } from "@/lib/utils";
import "./christmasLanguageSwitcher.css";

/**
 * Compact Christmas language switcher — native select so it stays tiny on
 * mobile. Applies the chosen locale immediately (preference + URL).
 * Browser-language detection runs once on first unprefixed visit.
 */
export function ChristmasLanguageSwitcher({
  className = "",
}: {
  className?: string;
}) {
  useChristmasBrowserLocaleRedirect();
  const location = useLocation();
  const navigate = useNavigate();
  const { locale } = parseChristmasLocalePath(location.pathname);
  const cleanSearch = cleanChristmasSearchForLocaleSwitch(location.search);
  const locales = switchableChristmasLocales(location.pathname);
  const active = (locales.some((item) => item.code === locale) ? locale : "en") as ChristmasLocaleCode;

  function switchTo(next: ChristmasLocaleCode) {
    writeChristmasLocalePreference(next);
    if (typeof document !== "undefined") {
      document.documentElement.lang = christmasHtmlLang(next);
    }
    const to = `${christmasPathForLocale(location.pathname, next)}${cleanSearch}`;
    const current = `${location.pathname}${cleanSearch}`;
    if (to !== current) {
      void navigate(to);
    }
  }

  return (
    <label className={cn("christmas-lang-switcher", className)}>
      <span className="sr-only">Language</span>
      <select
        aria-label="Language"
        value={active}
        onChange={(event) => switchTo(event.target.value as ChristmasLocaleCode)}
      >
        {locales.map((item) => (
          <option key={item.code} value={item.code} lang={christmasHtmlLang(item.code)}>
            {item.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
