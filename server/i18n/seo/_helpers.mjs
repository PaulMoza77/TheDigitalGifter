/**
 * Shared helpers for Christmas localized SEO packs (P3B).
 */

/**
 * Prefix absolute Christmas hrefs with /{locale} (Strategy A).
 * Leaves external / non-christmas paths alone. English uses no prefix.
 * @param {string} locale
 * @param {string} href
 */
export function localeHref(locale, href) {
  const path = String(href || "");
  if (!path.startsWith("/")) return path;
  if (locale === "en") return path;
  if (path.startsWith(`/${locale}/`)) return path;
  if (path.startsWith("/christmas") || path === "/christmas-ai-photos") {
    return `/${locale}${path}`;
  }
  return path;
}

/**
 * Map link arrays into the locale namespace.
 * @param {string} locale
 * @param {Array<{ href: string, label: string }>} links
 */
export function localizeLinks(locale, links = []) {
  return links.map((l) => ({ ...l, href: localeHref(locale, l.href) }));
}

/**
 * FAQ heading by locale.
 * @param {string} locale
 */
export function faqHeadingForLocale(locale) {
  const map = {
    en: "Frequently Asked Questions",
    ro: "Întrebări frecvente",
    de: "Häufig gestellte Fragen",
    fr: "Questions fréquentes",
    es: "Preguntas frecuentes",
    it: "Domande frequenti",
    pt: "Perguntas frequentes",
    nl: "Veelgestelde vragen",
    pl: "Najczęściej zadawane pytania",
  };
  return map[locale] || map.en;
}

/**
 * Home breadcrumb label.
 * @param {string} locale
 */
export function homeLabelForLocale(locale) {
  const map = {
    en: "Home",
    ro: "Acasă",
    de: "Startseite",
    fr: "Accueil",
    es: "Inicio",
    it: "Home",
    pt: "Início",
    nl: "Home",
    pl: "Strona główna",
  };
  return map[locale] || map.en;
}
