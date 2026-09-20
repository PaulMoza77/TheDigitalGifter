/**
 * Isolated marketplace resolver.
 * Never invent a marketplace (e.g. there is no EBAY_RO).
 */

export const EBAY_MARKETPLACES = [
  "EBAY_US",
  "EBAY_GB",
  "EBAY_DE",
  "EBAY_FR",
  "EBAY_IT",
  "EBAY_ES",
  "EBAY_NL",
  "EBAY_AT",
  "EBAY_AU",
  "EBAY_CA",
  "EBAY_IE",
  "EBAY_BE",
  "EBAY_CH",
  "EBAY_PL",
] as const;

export type EbayMarketplaceId = (typeof EBAY_MARKETPLACES)[number];

const MARKETPLACE_CURRENCY: Record<EbayMarketplaceId, string> = {
  EBAY_US: "USD",
  EBAY_GB: "GBP",
  EBAY_DE: "EUR",
  EBAY_FR: "EUR",
  EBAY_IT: "EUR",
  EBAY_ES: "EUR",
  EBAY_NL: "EUR",
  EBAY_AT: "EUR",
  EBAY_AU: "AUD",
  EBAY_CA: "CAD",
  EBAY_IE: "EUR",
  EBAY_BE: "EUR",
  EBAY_CH: "CHF",
  EBAY_PL: "PLN",
};

/** Closest official eBay marketplace for an ISO country. Romania has none. */
const COUNTRY_TO_MARKETPLACE: Record<string, EbayMarketplaceId> = {
  US: "EBAY_US",
  GB: "EBAY_GB",
  UK: "EBAY_GB",
  DE: "EBAY_DE",
  AT: "EBAY_AT",
  CH: "EBAY_CH",
  FR: "EBAY_FR",
  BE: "EBAY_BE",
  IT: "EBAY_IT",
  ES: "EBAY_ES",
  PT: "EBAY_ES",
  NL: "EBAY_NL",
  IE: "EBAY_IE",
  AU: "EBAY_AU",
  NZ: "EBAY_AU",
  CA: "EBAY_CA",
  PL: "EBAY_PL",
  // EU countries without their own marketplace → closest DE hub
  RO: "EBAY_DE",
  BG: "EBAY_DE",
  HU: "EBAY_DE",
  CZ: "EBAY_DE",
  SK: "EBAY_DE",
  HR: "EBAY_DE",
  SI: "EBAY_DE",
  GR: "EBAY_DE",
  DK: "EBAY_DE",
  SE: "EBAY_DE",
  FI: "EBAY_DE",
  LU: "EBAY_DE",
  EE: "EBAY_DE",
  LV: "EBAY_DE",
  LT: "EBAY_DE",
  CY: "EBAY_DE",
  MT: "EBAY_DE",
};

const LOCALE_TO_MARKETPLACE: Record<string, EbayMarketplaceId> = {
  en: "EBAY_GB",
  "en-us": "EBAY_US",
  "en-gb": "EBAY_GB",
  de: "EBAY_DE",
  "de-de": "EBAY_DE",
  "de-at": "EBAY_AT",
  "de-ch": "EBAY_CH",
  fr: "EBAY_FR",
  "fr-fr": "EBAY_FR",
  it: "EBAY_IT",
  es: "EBAY_ES",
  nl: "EBAY_NL",
  pl: "EBAY_PL",
  pt: "EBAY_ES",
  ro: "EBAY_DE",
};

export function isEbayMarketplace(value: string | null | undefined): value is EbayMarketplaceId {
  return Boolean(value && (EBAY_MARKETPLACES as readonly string[]).includes(value));
}

export function currencyForEbayMarketplace(marketplace: EbayMarketplaceId): string {
  return MARKETPLACE_CURRENCY[marketplace];
}

export function resolveEbayMarketplace(input: {
  countryCode?: string | null;
  locale?: string | null;
}): EbayMarketplaceId {
  const country = String(input.countryCode || "")
    .trim()
    .toUpperCase()
    .slice(0, 2);
  if (country && COUNTRY_TO_MARKETPLACE[country]) return COUNTRY_TO_MARKETPLACE[country];
  const locale = String(input.locale || "")
    .trim()
    .toLowerCase()
    .replace("_", "-");
  if (locale && LOCALE_TO_MARKETPLACE[locale]) return LOCALE_TO_MARKETPLACE[locale];
  const lang = locale.split("-")[0];
  if (lang && LOCALE_TO_MARKETPLACE[lang]) return LOCALE_TO_MARKETPLACE[lang];
  return "EBAY_DE";
}

export function coarseDeliveryCountry(countryCode?: string | null): string | null {
  const country = String(countryCode || "")
    .trim()
    .toUpperCase()
    .slice(0, 2);
  if (/^[A-Z]{2}$/.test(country)) return country;
  return null;
}
