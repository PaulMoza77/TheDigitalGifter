/**
 * Server-side pet presentment currencies (mirrors client currency.ts).
 * Keep amounts in sync with src/features/pet/i18n/currency.ts
 */

export const PET_CURRENCIES = ["usd", "eur", "ron", "huf", "pln", "gbp"] as const;
export type PetCurrency = (typeof PET_CURRENCIES)[number];
export const PET_DEFAULT_CURRENCY: PetCurrency = "usd";
export const PET_ZERO_DECIMAL_CURRENCIES = new Set<PetCurrency>(["huf"]);

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

export const PET_V1_LIST_AMOUNT: Record<PetCurrency, number> = { ...PET_V2_COMPARE_AMOUNT };
export const PET_V3_SALE_AMOUNT: Record<PetCurrency, number> = { ...PET_V2_SALE_AMOUNT };

const SET = new Set<string>(PET_CURRENCIES);

export function isPetCurrency(value: unknown): value is PetCurrency {
  return typeof value === "string" && SET.has(value.toLowerCase());
}

export function normalizePetCurrency(value: unknown): PetCurrency {
  const raw = String(value || "").trim().toLowerCase();
  if (isPetCurrency(raw)) return raw;
  return PET_DEFAULT_CURRENCY;
}

export function petV2SaleAmount(currency: PetCurrency = "usd"): number {
  return PET_V2_SALE_AMOUNT[currency] ?? PET_V2_SALE_AMOUNT.usd;
}

export function petV2CompareAmount(currency: PetCurrency = "usd"): number {
  return PET_V2_COMPARE_AMOUNT[currency] ?? PET_V2_COMPARE_AMOUNT.usd;
}

export function petV1ListAmount(currency: PetCurrency = "usd"): number {
  return PET_V1_LIST_AMOUNT[currency] ?? PET_V1_LIST_AMOUNT.usd;
}

export function petV3SaleAmount(currency: PetCurrency = "usd"): number {
  return PET_V3_SALE_AMOUNT[currency] ?? PET_V3_SALE_AMOUNT.usd;
}

/** Format for API responses / emails (en locale for stability). */
export function formatPetMoneyServer(amount: number, currency: PetCurrency): string {
  const major = PET_ZERO_DECIMAL_CURRENCIES.has(currency) ? amount : amount / 100;
  const locales: Record<PetCurrency, string> = {
    usd: "en-US",
    eur: "de-DE",
    ron: "ro-RO",
    huf: "hu-HU",
    pln: "pl-PL",
    gbp: "en-GB",
  };
  try {
    return new Intl.NumberFormat(locales[currency], {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: PET_ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2,
      minimumFractionDigits: PET_ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2,
    }).format(major);
  } catch {
    return `${major} ${currency.toUpperCase()}`;
  }
}
