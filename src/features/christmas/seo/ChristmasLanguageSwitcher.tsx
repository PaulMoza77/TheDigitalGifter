import { Link, useLocation } from "react-router-dom";
import {
  CHRISTMAS_UI_LOCALES,
  christmasPathForLocale,
  cleanChristmasSearchForLocaleSwitch,
  parseChristmasLocalePath,
  type ChristmasLocaleCode,
} from "./localeRouting";

/**
 * Compact Christmas language switcher — preserves conceptual route.
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

  return (
    <nav
      className={className}
      aria-label="Language"
      style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", fontSize: "0.85rem" }}
    >
      {CHRISTMAS_UI_LOCALES.map((item) => {
        const to = `${christmasPathForLocale(location.pathname, item.code as ChristmasLocaleCode)}${cleanSearch}`;
        const active = item.code === locale;
        return (
          <Link
            key={item.code}
            to={to}
            hrefLang={item.code}
            aria-current={active ? "page" : undefined}
            style={{
              color: active ? "#d4af37" : "inherit",
              textDecoration: active ? "none" : "underline",
              textUnderlineOffset: "3px",
              opacity: active ? 1 : 0.8,
              fontWeight: active ? 600 : 400,
            }}
          >
            {item.nativeName}
          </Link>
        );
      })}
    </nav>
  );
}
