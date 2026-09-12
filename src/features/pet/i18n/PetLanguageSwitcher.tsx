import { useLocation, useNavigate } from "react-router-dom";
import { currencyForPetLocale } from "./currency";
import { PET_UI_LOCALES, type PetUiLocale, writePetLocalePreference } from "./locales";
import { parsePetLocalePath, petPathForLocale } from "./localeRouting";
import { writePetCurrencyPreference } from "./usePetCurrency";
import { usePetLocale, usePetT } from "./usePetLocale";
import { cn } from "@/lib/utils";

export function PetLanguageSwitcher({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const locale = usePetLocale();
  const t = usePetT(locale);
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { basePath } = parsePetLocalePath(pathname);

  function switchTo(next: PetUiLocale) {
    writePetLocalePreference(next);
    writePetCurrencyPreference(currencyForPetLocale(next));
    const target = petPathForLocale(basePath, next);
    void navigate(`${target}${search}`);
    if (typeof document !== "undefined") {
      document.documentElement.lang = next;
    }
  }

  return (
    <label className={cn("inline-flex items-center gap-2 text-xs text-[#f6efe4]/60", className)}>
      <span className={compact ? "sr-only" : undefined}>{t("chrome.lang")}</span>
      <select
        aria-label={t("chrome.lang")}
        value={locale}
        onChange={(event) => switchTo(event.target.value as PetUiLocale)}
        className="h-9 max-w-[10.5rem] rounded-full border border-[#f6efe4]/15 bg-[#1a1410] px-3 text-xs font-medium text-[#f6efe4] outline-none focus-visible:ring-2 focus-visible:ring-[#d4a84b]"
      >
        {PET_UI_LOCALES.map((item) => (
          <option key={item.code} value={item.code}>
            {item.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
