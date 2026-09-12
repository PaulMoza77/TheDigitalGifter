import { useCallback, useMemo, useSyncExternalStore } from "react";
import { usePetLocale } from "./usePetLocale";
import {
  PET_CURRENCY_PREF_KEY,
  PET_CURRENCIES,
  PET_CURRENCY_META,
  PET_DEFAULT_CURRENCY,
  currencyForPetLocale,
  detectBrowserPetCurrency,
  formatPetMoney,
  isPetCurrency,
  normalizePetCurrency,
  petV1ListAmount,
  petV2CompareAmount,
  petV2SaleAmount,
  type PetCurrency,
} from "./currency";

let memoryPref: PetCurrency | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function readPetCurrencyPreference(): PetCurrency | null {
  if (typeof window === "undefined") return memoryPref;
  try {
    const raw = window.localStorage.getItem(PET_CURRENCY_PREF_KEY);
    return isPetCurrency(raw) ? raw : null;
  } catch {
    return memoryPref;
  }
}

export function writePetCurrencyPreference(currency: PetCurrency): void {
  memoryPref = currency;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PET_CURRENCY_PREF_KEY, currency);
    } catch {
      /* ignore */
    }
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): PetCurrency | null {
  return readPetCurrencyPreference();
}

/**
 * Resolve presentment currency:
 * 1) explicit preference
 * 2) browser region/language
 * 3) UI locale map
 * 4) USD
 */
export function resolvePetCurrency(input?: {
  preference?: PetCurrency | null;
  locale?: string;
  languages?: readonly string[] | string | null;
}): PetCurrency {
  if (input?.preference && isPetCurrency(input.preference)) return input.preference;
  const browser = detectBrowserPetCurrency(input?.languages);
  if (browser !== PET_DEFAULT_CURRENCY) return browser;
  if (input?.locale) return currencyForPetLocale(input.locale);
  return PET_DEFAULT_CURRENCY;
}

export function usePetCurrency(): PetCurrency {
  const locale = usePetLocale();
  const preference = useSyncExternalStore(subscribe, getSnapshot, () => null);
  return useMemo(
    () =>
      resolvePetCurrency({
        preference,
        locale,
        languages: typeof navigator !== "undefined" ? navigator.languages : null,
      }),
    [preference, locale],
  );
}

export function usePetMoney() {
  const currency = usePetCurrency();
  const locale = usePetLocale();
  const localeHint = PET_CURRENCY_META[currency]?.locale;

  const format = useCallback(
    (amount: number, override?: PetCurrency) =>
      formatPetMoney(amount, override ?? currency, localeHint),
    [currency, localeHint],
  );

  const v2Sale = useMemo(
    () => ({
      currency,
      amount: petV2SaleAmount(currency),
      compareAmount: petV2CompareAmount(currency),
      priceDisplay: formatPetMoney(petV2SaleAmount(currency), currency, localeHint),
      compareAtDisplay: formatPetMoney(petV2CompareAmount(currency), currency, localeHint),
    }),
    [currency, localeHint],
  );

  const v1List = useMemo(
    () => ({
      currency,
      amount: petV1ListAmount(currency),
      priceDisplay: formatPetMoney(petV1ListAmount(currency), currency, localeHint),
    }),
    [currency, localeHint],
  );

  const setCurrency = useCallback((next: PetCurrency) => {
    writePetCurrencyPreference(normalizePetCurrency(next));
  }, []);

  return {
    currency,
    locale,
    format,
    v2Sale,
    v1List,
    setCurrency,
    currencies: PET_CURRENCIES,
  };
}
