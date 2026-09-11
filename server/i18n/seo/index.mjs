/**
 * Christmas localized SEO content loader (P3B).
 */
import { getChristmasSeoContent as getRo } from "./ro.mjs";
import { getChristmasSeoContent as getDe } from "./de.mjs";
import { getChristmasSeoContent as getFr } from "./fr.mjs";
import { getChristmasSeoContent as getEs } from "./es.mjs";
import { getChristmasSeoContent as getIt } from "./it.mjs";
import { getChristmasSeoContent as getPt } from "./pt.mjs";
import { getChristmasSeoContent as getNl } from "./nl.mjs";
import { getChristmasSeoContent as getPl } from "./pl.mjs";

const LOADERS = {
  ro: getRo,
  de: getDe,
  fr: getFr,
  es: getEs,
  it: getIt,
  pt: getPt,
  nl: getNl,
  pl: getPl,
};

export const CHRISTMAS_SEO_CONTENT_LOCALES = Object.keys(LOADERS);

/**
 * @param {string} localeCode
 * @param {string} basePath English base path e.g. /christmas/cards
 */
export function getChristmasLocalizedSeoContent(localeCode, basePath) {
  const loader = LOADERS[localeCode];
  if (!loader) return null;
  return loader(basePath) || null;
}

export {
  faqHeadingForLocale,
  homeLabelForLocale,
  localeHref,
  localizeLinks,
} from "./_helpers.mjs";
