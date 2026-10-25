/**
 * Santa Call presentment markets — fixed prices, no FX conversion.
 * Server recomputes amounts; client preference is advisory until checkout locks.
 */

export const SANTA_CALL_MARKETS = ["ro", "us"] as const;
export type SantaCallMarket = (typeof SANTA_CALL_MARKETS)[number];
export type SantaCallPresentmentCurrency = "ron" | "usd";

export const SANTA_CALL_MARKET_PRICES: Record<
  SantaCallMarket,
  {
    currency: SantaCallPresentmentCurrency;
    initialMinor: number;
    extensionMinor: number;
    locale: string;
    labelRo: string;
    labelEn: string;
  }
> = {
  ro: {
    currency: "ron",
    initialMinor: 5900,
    extensionMinor: 4900,
    locale: "ro-RO",
    labelRo: "România · RON",
    labelEn: "Romania · RON",
  },
  us: {
    currency: "usd",
    initialMinor: 1299,
    extensionMinor: 999,
    locale: "en-US",
    labelRo: "Statele Unite · USD",
    labelEn: "United States · USD",
  },
};

const MARKET_SET = new Set<string>(SANTA_CALL_MARKETS);
const STORAGE_KEY = "tdg_santa_call_market_v1";

export function isSantaCallMarket(value: unknown): value is SantaCallMarket {
  return typeof value === "string" && MARKET_SET.has(value.toLowerCase());
}

function asPlainText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function normalizeSantaCallMarket(value: unknown, fallback: SantaCallMarket = "ro"): SantaCallMarket {
  const raw = asPlainText(value).trim().toLowerCase();
  if (isSantaCallMarket(raw)) return raw;
  return fallback;
}

/** Suggest market from UI language or browser region — never from spoken call language. */
export function suggestSantaCallMarket(input?: {
  uiLanguage?: string | null;
  browserLanguages?: readonly string[] | string | null;
}): SantaCallMarket {
  const ui = asPlainText(input?.uiLanguage).toLowerCase().split("-")[0];
  if (ui === "ro") return "ro";
  if (ui === "en") return "us";

  const list = Array.isArray(input?.browserLanguages)
    ? input.browserLanguages
    : typeof input?.browserLanguages === "string" && input.browserLanguages
      ? [input.browserLanguages]
      : typeof navigator !== "undefined"
        ? navigator.languages?.length
          ? navigator.languages
          : [navigator.language]
        : [];

  for (const tag of list) {
    const lower = asPlainText(tag).toLowerCase();
    if (lower.includes("-ro") || lower.startsWith("ro")) return "ro";
    if (lower.includes("-us") || lower === "en-us") return "us";
  }
  return "us";
}

export function readStoredSantaCallMarket(): SantaCallMarket | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const v = localStorage.getItem(STORAGE_KEY);
    return isSantaCallMarket(v) ? v : null;
  } catch {
    return null;
  }
}

export function storeSantaCallMarket(market: SantaCallMarket) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, market);
  } catch {
    /* ignore */
  }
}

export function pricesForSantaCallMarket(market: SantaCallMarket) {
  return SANTA_CALL_MARKET_PRICES[normalizeSantaCallMarket(market)];
}

export function formatSantaCallMoney(amountMinor: number, currency: string) {
  const code = String(currency || "ron").toLowerCase();
  try {
    return new Intl.NumberFormat(code === "ron" ? "ro-RO" : "en-US", {
      style: "currency",
      currency: code.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${code.toUpperCase()}`;
  }
}

/** Assert client-sent amount matches fixed map (server must still recompute). */
export function assertSantaCallPriceMatch(input: {
  market: SantaCallMarket;
  kind: "initial" | "extension";
  amountMinor: number;
  currency: string;
}): { ok: true } | { ok: false; code: string } {
  const prices = pricesForSantaCallMarket(input.market);
  const expected = input.kind === "initial" ? prices.initialMinor : prices.extensionMinor;
  if (String(input.currency || "").toLowerCase() !== prices.currency) {
    return { ok: false, code: "currency_mismatch" };
  }
  if (Number(input.amountMinor) !== expected) {
    return { ok: false, code: "amount_mismatch" };
  }
  return { ok: true };
}
