import { Link, useLocation } from "react-router-dom";
import {
  christmasPathForLocale,
  cleanChristmasSearchForLocaleSwitch,
  parseChristmasLocalePath,
  switchableChristmasLocales,
  type ChristmasLocaleCode,
} from "./localeRouting";

/**
 * Compact Christmas language switcher — preserves conceptual route.
 * Only lists locales usable for the current page (product-gated for Santa/Messages).
 * Does not put private personalization query params into the destination URL.
 */
export function ChristmasLanguageSwitcher({
  className = "",
}: {
  className?: string;
}) {
  const location = useLocation();
  const { locale } = parseChristmasLocalePath(location.pathname);
  const cleanSearch = cleanChristmasSearchForLocaleSwitch(location.search);
  const locales = switchableChristmasLocales(location.pathname);

  return (
    <nav
      className={className}
      aria-label="Language"
      style={{
        display: "flex",
        gap: "0.65rem",
        flexWrap: "wrap",
        fontSize: "0.85rem",
        maxWidth: "100%",
      }}
    >
      {locales.map((item) => {
        const to = `${christmasPathForLocale(location.pathname, item.code as ChristmasLocaleCode)}${cleanSearch}`;
        const active = item.code === locale;
        return (
          <Link
            key={item.code}
            to={to}
            hrefLang={item.code === "pt" ? "pt-PT" : item.code}
            aria-current={active ? "page" : undefined}
            style={{
              color: active ? "#d4af37" : "inherit",
              textDecoration: active ? "none" : "underline",
              textUnderlineOffset: "3px",
              opacity: active ? 1 : 0.8,
              fontWeight: active ? 600 : 400,
              whiteSpace: "nowrap",
            }}
          >
            {item.nativeName}
          </Link>
        );
      })}
    </nav>
  );
}
