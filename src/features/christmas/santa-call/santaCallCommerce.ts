/**
 * Santa Call commercial helpers without importing @supabase/supabase-js.
 * Uses anon REST + edge functions so the landing chunk stays off the
 * vendor-supabase critical path (auth session is optional for this funnel).
 */

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const ANON = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "");
const CHECKOUT_URL = `${SUPABASE_URL}/functions/v1/christmas-checkout`;

function anonHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: ANON,
    Authorization: `Bearer ${ANON}`,
  };
}

export async function fetchSantaCallCommercialOffers(): Promise<unknown[]> {
  const url = `${SUPABASE_URL}/rest/v1/pricing_items?category=eq.christmas_offer&select=*`;
  const res = await fetch(url, {
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`offers_fetch_failed:${res.status}`);
  }
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? data : [];
}

const checkoutInflight = new Map<string, Promise<SantaCheckoutResponse>>();

export type SantaCheckoutResponse = {
  ok: true;
  orderId: string;
  publicToken: string | null;
  sessionId: string;
  clientSecret: string;
  publishableKey: string;
  amountCents: number;
  currency: string;
  uiMode: "custom" | "hosted";
  checkoutUrl?: string | null;
};

function checkoutDedupeKey(body: Record<string, unknown>): string {
  return JSON.stringify({
    product_key: body.product_key,
    package_key: body.package_key,
    email: body.email,
    market: body.market,
    amount_cents: body.amount_cents,
    existing_order_id: body.existing_order_id,
  });
}

export async function startSantaCallCheckout(
  body: Record<string, unknown>,
): Promise<SantaCheckoutResponse> {
  const key = checkoutDedupeKey(body);
  const existing = checkoutInflight.get(key);
  if (existing) return existing;
  const pending = (async () => {
    const res = await fetch(CHECKOUT_URL, {
      method: "POST",
      headers: anonHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || "Checkout failed") as Error & {
        code?: string;
      };
      err.code = data.code;
      throw err;
    }
    return data as SantaCheckoutResponse;
  })().finally(() => {
    checkoutInflight.delete(key);
  });
  checkoutInflight.set(key, pending);
  return pending;
}
