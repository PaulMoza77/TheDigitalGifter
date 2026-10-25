/**
 * Santa Call presentment markets — fixed prices, no FX (edge mirror of client module).
 */

export type SantaCallMarket = "ro" | "us";
export type SantaCallPresentmentCurrency = "ron" | "usd";

export const SANTA_CALL_MARKET_PRICES: Record<
  SantaCallMarket,
  { currency: SantaCallPresentmentCurrency; initialMinor: number; extensionMinor: number }
> = {
  ro: { currency: "ron", initialMinor: 5900, extensionMinor: 4900 },
  us: { currency: "usd", initialMinor: 1299, extensionMinor: 999 },
};

export function normalizeSantaCallMarket(value: unknown, fallback: SantaCallMarket = "ro"): SantaCallMarket {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (raw === "ro" || raw === "us") return raw;
  if (raw === "ron") return "ro";
  if (raw === "usd") return "us";
  return fallback;
}

export function marketFromCheckoutBody(body: Record<string, unknown>): SantaCallMarket {
  const explicit = normalizeSantaCallMarket(body.market || body.santa_market, "" as unknown as SantaCallMarket);
  if (explicit === "ro" || explicit === "us") return explicit;
  const currency = String(body.currency || body.preferred_currency || "")
    .trim()
    .toLowerCase();
  if (currency === "usd") return "us";
  if (currency === "ron") return "ro";
  const lang = String(body.language || body.locale || "")
    .trim()
    .toLowerCase()
    .split("-")[0];
  if (lang === "ro") return "ro";
  if (lang === "en") return "us";
  return "ro";
}

export function pricesForSantaCallMarket(market: SantaCallMarket) {
  return SANTA_CALL_MARKET_PRICES[normalizeSantaCallMarket(market)];
}

export function resolveSantaCallCharge(input: {
  market: SantaCallMarket;
  kind: "initial" | "extension";
  clientAmountCents?: unknown;
  clientCurrency?: unknown;
}):
  | { ok: true; market: SantaCallMarket; currency: SantaCallPresentmentCurrency; amountCents: number }
  | { ok: false; code: string; message: string } {
  const market = normalizeSantaCallMarket(input.market);
  const prices = pricesForSantaCallMarket(market);
  const amountCents = input.kind === "initial" ? prices.initialMinor : prices.extensionMinor;
  const currency = prices.currency;

  if (input.clientCurrency != null && String(input.clientCurrency).trim() !== "") {
    if (String(input.clientCurrency).trim().toLowerCase() !== currency) {
      return { ok: false, code: "currency_mismatch", message: "Currency does not match selected market." };
    }
  }
  if (input.clientAmountCents != null && String(input.clientAmountCents).trim() !== "") {
    const n = Number(input.clientAmountCents);
    if (Number.isFinite(n) && n !== amountCents) {
      return { ok: false, code: "amount_mismatch", message: "Amount does not match selected market." };
    }
  }

  return { ok: true, market, currency, amountCents };
}
