/**
 * Santa Call Stripe isolation.
 * TEST mode uses STRIPE_TEST_* only — never falls back to LIVE STRIPE_SECRET_KEY.
 * LIVE mode uses global STRIPE_* and refuses sk_test_/pk_test_ misconfig.
 */

import { asString } from "./crypto.ts";

export type SantaStripeMode = "test" | "live";

export type SantaStripeCreds = {
  mode: SantaStripeMode;
  secretKey: string;
  /** Optional for hosted Checkout; required for Custom Elements. */
  publishableKey: string | null;
};

function secretMode(key: string): SantaStripeMode | null {
  if (key.startsWith("sk_test_")) return "test";
  if (key.startsWith("sk_live_")) return "live";
  return null;
}

function publishableMode(key: string): SantaStripeMode | null {
  if (key.startsWith("pk_test_")) return "test";
  if (key.startsWith("pk_live_")) return "live";
  return null;
}

/** Env-forced Santa Stripe mode. Default live (other products unaffected). */
export function resolveSantaStripeModeEnv(): SantaStripeMode {
  const raw = asString(Deno.env.get("CHRISTMAS_SANTA_CALL_STRIPE_MODE")).toLowerCase();
  if (raw === "test") return "test";
  return "live";
}

/**
 * Resolve credentials for a Santa checkout.
 * Prefer explicit orderMode (from parent order metadata) when present.
 */
export function resolveSantaStripeCredentials(
  orderMode?: SantaStripeMode | string | null,
): { ok: true; creds: SantaStripeCreds } | { ok: false; code: string; message: string } {
  const envMode = resolveSantaStripeModeEnv();
  const requested = (asString(orderMode).toLowerCase() === "test" ? "test" : asString(orderMode).toLowerCase() === "live" ? "live" : envMode) as SantaStripeMode;

  if (requested === "test") {
    const secret = asString(Deno.env.get("STRIPE_TEST_SECRET_KEY"));
    const publishable = asString(Deno.env.get("STRIPE_TEST_PUBLISHABLE_KEY")) || null;
    if (!secret) {
      return {
        ok: false,
        code: "stripe_test_unconfigured",
        message: "STRIPE_TEST_SECRET_KEY is required for Santa TEST checkout.",
      };
    }
    if (secretMode(secret) !== "test") {
      return {
        ok: false,
        code: "stripe_test_key_invalid",
        message: "STRIPE_TEST_SECRET_KEY must be sk_test_*.",
      };
    }
    // Hard refuse accidental LIVE key in the TEST slot.
    if (secret.startsWith("sk_live_")) {
      return { ok: false, code: "stripe_test_key_invalid", message: "LIVE key rejected in TEST slot." };
    }
    if (publishable && publishableMode(publishable) !== "test") {
      return {
        ok: false,
        code: "stripe_test_publishable_invalid",
        message: "STRIPE_TEST_PUBLISHABLE_KEY must be pk_test_* when set.",
      };
    }
    return { ok: true, creds: { mode: "test", secretKey: secret, publishableKey: publishable } };
  }

  const secret = asString(Deno.env.get("STRIPE_SECRET_KEY"));
  const publishable = asString(Deno.env.get("STRIPE_PUBLISHABLE_KEY")) || null;
  if (!secret) {
    return { ok: false, code: "stripe_unconfigured", message: "STRIPE_SECRET_KEY is not configured." };
  }
  if (secretMode(secret) !== "live") {
    return {
      ok: false,
      code: "stripe_live_key_invalid",
      message: "Santa LIVE mode requires sk_live_* (refusing TEST key on global slot).",
    };
  }
  if (publishable && publishableMode(publishable) !== "live") {
    return {
      ok: false,
      code: "stripe_live_publishable_invalid",
      message: "STRIPE_PUBLISHABLE_KEY must be pk_live_* in LIVE mode.",
    };
  }
  return { ok: true, creds: { mode: "live", secretKey: secret, publishableKey: publishable } };
}

export function isSantaStripeTestOrderMeta(meta: Record<string, unknown> | null | undefined): boolean {
  const m = meta || {};
  return asString(m.stripe_mode).toLowerCase() === "test" || m.santa_qa === true || m.e2e === true;
}

export async function stripeFormPost(
  secretKey: string,
  path: string,
  params: URLSearchParams,
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, body };
}
