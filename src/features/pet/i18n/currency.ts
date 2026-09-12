/**
 * Pet presentment currencies — browser/locale detected, server-owned amounts.
 * Stripe charges the selected currency (not display-only FX).
 */

export const PET_CURRENCIES = ["usd", "eur", "ron", "huf", "pln", "gbp"] as const;
export type PetCurrency = (typeof PET_CURRENCIES)[number];

export const PET_DEFAULT_CURRENCY: PetCurrency = "usd";

/** Stripe zero-decimal currencies — unit_amount is whole major units. */
export const PET_ZERO_DECIMAL_CURRENCIES = new Set<PetCurrency>(["huf"]);

export const PET_CURRENCY_META: Record<
  PetCurrency,
  { code: PetCurrency; locale: string; symbolHint: string; label: string }
> = {
  usd: { code: "usd", locale: "en-US", symbolHint: "$", label: "US Dollar" },
  eur: { code: "eur", locale: "de-DE", symbolHint: "€", label: "Euro" },
  ron: { code: "ron", locale: "ro-RO", symbolHint: "Lei", label: "Romanian Leu" },
  huf: { code: "huf", locale: "hu-HU", symbolHint: "Ft", label: "Hungarian Forint" },
  pln: { code: "pln", locale: "pl-PL", symbolHint: "zł", label: "Polish Złoty" },
  gbp: { code: "gbp", locale: "en-GB", symbolHint: "£", label: "British Pound" },
};

/**
 * Fixed marketing prices (Stripe unit_amount).
 * For HUF values are whole forints; others are minor units (cents/bani/groszy/pence).
 */
export const PET_V2_SALE_AMOUNT: Record<PetCurrency, number> = {
  usd: 299,
  eur: 299,
  ron: 1499,
  huf: 1190,
  pln: 1299,
  gbp: 249,
};

export const PET_V2_COMPARE_AMOUNT: Record<PetCurrency, number> = {
  usd: 2700,
  eur: 2499,
  ron: 13499,
  huf: 9990,
  pln: 10999,
  gbp: 2299,
};

/** V1 list / full pack (same as V2 compare). */
export const PET_V1_LIST_AMOUNT: Record<PetCurrency, number> = { ...PET_V2_COMPARE_AMOUNT };

export const PET_V3_SALE_AMOUNT: Record<PetCurrency, number> = { ...PET_V2_SALE_AMOUNT };

const CURRENCY_SET = new Set<string>(PET_CURRENCIES);

export function isPetCurrency(value: unknown): value is PetCurrency {
  return typeof value === "string" && CURRENCY_SET.has(value.toLowerCase());
}

export function normalizePetCurrency(value: unknown): PetCurrency {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (isPetCurrency(raw)) return raw;
  return PET_DEFAULT_CURRENCY;
}

/** UI locale → default presentment currency. */
export function currencyForPetLocale(locale: string): PetCurrency {
  switch (String(locale || "").toLowerCase().split("-")[0]) {
    case "ro":
      return "ron";
    case "hu":
      return "huf";
    case "pl":
      return "pln";
    case "de":
    case "it":
    case "fr":
    case "es":
    case "pt":
    case "nl":
      return "eur";
    case "en":
    default:
      return "usd";
  }
}

/** Map BCP-47 language tags → currency (region wins when present). */
export function detectBrowserPetCurrency(
  languages: readonly string[] | string | null | undefined = typeof navigator !== "undefined"
    ? navigator.languages?.length
      ? navigator.languages
      : navigator.language
    : null,
): PetCurrency {
  const list = Array.isArray(languages)
    ? languages
    : typeof languages === "string" && languages
      ? [languages]
      : [];

  for (const entry of list) {
    const raw = String(entry || "")
      .trim()
      .toLowerCase()
      .replace("_", "-");
    if (!raw) continue;
    const [lang, region] = raw.split("-");
    const fromRegion = region ? currencyForRegion(region) : null;
    if (fromRegion) return fromRegion;
    if (lang === "en" && region === "gb") return "gbp";
    const fromLang = currencyForPetLocale(lang);
    if (fromLang !== "usd" || lang === "en") return fromLang;
  }
  return PET_DEFAULT_CURRENCY;
}

function currencyForRegion(region: string): PetCurrency | null {
  const r = region.toUpperCase();
  if (r === "RO") return "ron";
  if (r === "HU") return "huf";
  if (r === "PL") return "pln";
  if (r === "GB" || r === "UK") return "gbp";
  if (
    [
      "AT",
      "BE",
      "CY",
      "DE",
      "EE",
      "ES",
      "FI",
      "FR",
      "GR",
      "HR",
      "IE",
      "IT",
      "LT",
      "LU",
      "LV",
      "MT",
      "NL",
      "PT",
      "SI",
      "SK",
      "AD",
      "MC",
      "SM",
      "VA",
    ].includes(r)
  ) {
    return "eur";
  }
  if (r === "US" || r === "CA" || r === "AU" || r === "NZ") return "usd";
  return null;
}

export function petV2SaleAmount(currency: PetCurrency): number {
  return PET_V2_SALE_AMOUNT[currency] ?? PET_V2_SALE_AMOUNT.usd;
}

export function petV2CompareAmount(currency: PetCurrency): number {
  return PET_V2_COMPARE_AMOUNT[currency] ?? PET_V2_COMPARE_AMOUNT.usd;
}

export function petV1ListAmount(currency: PetCurrency): number {
  return PET_V1_LIST_AMOUNT[currency] ?? PET_V1_LIST_AMOUNT.usd;
}

/** Convert Stripe unit_amount → major units for Intl formatting. */
export function petAmountToMajor(amount: number, currency: PetCurrency): number {
  if (PET_ZERO_DECIMAL_CURRENCIES.has(currency)) return amount;
  return amount / 100;
}

export function formatPetMoney(
  amount: number,
  currency: PetCurrency,
  localeHint?: string,
): string {
  const meta = PET_CURRENCY_META[currency] || PET_CURRENCY_META.usd;
  const locale = localeHint || meta.locale;
  const major = petAmountToMajor(amount, currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
      currencyDisplay: currency === "ron" ? "narrowSymbol" : "symbol",
      maximumFractionDigits: PET_ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2,
      minimumFractionDigits: PET_ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2,
    }).format(major);
  } catch {
    if (currency === "ron") return `${major.toFixed(2).replace(".", ",")} Lei`;
    if (currency === "huf") return `${Math.round(major)} Ft`;
    if (currency === "eur") return `€${major.toFixed(2)}`;
    if (currency === "pln") return `${major.toFixed(2).replace(".", ",")} zł`;
    if (currency === "gbp") return `£${major.toFixed(2)}`;
    return `$${major.toFixed(2)}`;
  }
}

export const PET_CURRENCY_PREF_KEY = "tdg.pet.currency.v1" as const;
