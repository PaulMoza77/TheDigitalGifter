/**
 * Christmas Story Stripe isolation — TEST only for Mission 02B.
 * Never falls back to LIVE STRIPE_SECRET_KEY.
 * Production checkout kill-switch: CHRISTMAS_STORY_CHECKOUT_ENABLED must be true
 * AND mode must be test. LIVE mode is refused until explicitly authorized later.
 */

import { asString } from "./crypto.ts";

export type StoryStripeMode = "test" | "live" | "disabled";

export type StoryStripeCreds = {
  mode: "test";
  secretKey: string;
  publishableKey: string | null;
};

export const STORY_STRIPE_API_VERSION = "2025-03-31.basil";

export function isStoryCheckoutEnabled(): boolean {
  const raw = asString(Deno.env.get("CHRISTMAS_STORY_CHECKOUT_ENABLED")).toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
}

/** Env mode. Default disabled. LIVE is never selected in Mission 02B. */
export function resolveStoryStripeModeEnv(): StoryStripeMode {
  if (!isStoryCheckoutEnabled()) return "disabled";
  const raw = asString(Deno.env.get("CHRISTMAS_STORY_STRIPE_MODE")).toLowerCase();
  if (raw === "test") return "test";
  // Refuse live even if misconfigured.
  if (raw === "live") return "disabled";
  return "disabled";
}

export function resolveStoryStripeTestCredentials():
  | { ok: true; creds: StoryStripeCreds }
  | { ok: false; code: string; message: string } {
  if (!isStoryCheckoutEnabled()) {
    return {
      ok: false,
      code: "checkout_kill_switch",
      message: "Christmas Story checkout is disabled (production kill-switch ON).",
    };
  }
  if (resolveStoryStripeModeEnv() !== "test") {
    return {
      ok: false,
      code: "stripe_mode_disabled",
      message: "Christmas Story Stripe mode is not TEST.",
    };
  }
  const secret = asString(Deno.env.get("STRIPE_TEST_SECRET_KEY"));
  const publishable = asString(Deno.env.get("STRIPE_TEST_PUBLISHABLE_KEY")) || null;
  if (!secret) {
    return {
      ok: false,
      code: "stripe_test_unconfigured",
      message: "STRIPE_TEST_SECRET_KEY is required for Story TEST checkout.",
    };
  }
  if (!secret.startsWith("sk_test_")) {
    return {
      ok: false,
      code: "stripe_test_key_invalid",
      message: "STRIPE_TEST_SECRET_KEY must be sk_test_* (LIVE keys refused).",
    };
  }
  if (secret.startsWith("sk_live_")) {
    return { ok: false, code: "stripe_test_key_invalid", message: "LIVE key rejected in TEST slot." };
  }
  if (publishable && !publishable.startsWith("pk_test_")) {
    return {
      ok: false,
      code: "stripe_test_publishable_invalid",
      message: "STRIPE_TEST_PUBLISHABLE_KEY must be pk_test_* when set.",
    };
  }
  return { ok: true, creds: { mode: "test", secretKey: secret, publishableKey: publishable } };
}

export async function stripeTestFormPost(
  path: string,
  secretKey: string,
  body: URLSearchParams,
  idempotencyKey?: string,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
    "Stripe-Version": STORY_STRIPE_API_VERSION,
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers,
    body,
  });
  const json = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

export function isStoryStripeTestMeta(meta: Record<string, unknown> | null | undefined): boolean {
  const m = meta || {};
  return (
    asString(m.product_family).toLowerCase() === "christmas_story" &&
    asString(m.stripe_mode).toLowerCase() === "test"
  );
}
