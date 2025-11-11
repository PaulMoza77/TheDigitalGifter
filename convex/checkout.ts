// convex/checkout.ts
import { action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/** --- Helpers --- */
function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val || !val.trim()) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return val.trim();
}

async function createStripeCheckoutSession(body: Record<string, string>) {
  const secret = requireEnv("STRIPE_SECRET_KEY");

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) params.append(k, v);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe error ${res.status}: ${text}`);
  }

  return (await res.json()) as { url?: string; id: string };
}

/** --- Actions --- */

/**
 * Recommended: client sends only the pack.
 * Packs must have price IDs configured in env:
 *  - PRICE_25_CREDITS
 *  - PRICE_50_CREDITS
 *  - PRICE_500_CREDITS
 *  - PRICE_5000_CREDITS
 *
 * Requires authenticated user - throws if not logged in.
 */
export const createCheckoutByPack = action({
  args: {
    pack: v.string(), // "starter" | "creator" | "pro" | "enterprise"
  },
  handler: async (ctx, args) => {
    // ✅ Require authentication
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in to purchase credits");
    }

    const valid = ["starter", "creator", "pro", "enterprise"] as const;
    if (!valid.includes(args.pack as any)) {
      throw new Error(`Invalid pack: ${args.pack}`);
    }

    const baseUrl = (
      process.env.PUBLIC_APP_URL || "http://localhost:5173"
    ).trim();

    const PRICE_IDS: Record<string, string> = {
      starter: requireEnv("PRICE_25_CREDITS"),
      creator: requireEnv("PRICE_50_CREDITS"),
      pro: requireEnv("PRICE_500_CREDITS"),
      enterprise: requireEnv("PRICE_5000_CREDITS"),
    };

    const priceId = PRICE_IDS[args.pack];

    console.log("[Checkout] Creating session", {
      userId,
      pack: args.pack,
      priceId,
    });

    const session = await createStripeCheckoutSession({
      mode: "payment",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: `${baseUrl}/?checkout=success`,
      cancel_url: `${baseUrl}/?checkout=cancel`,
      "metadata[userId]": String(userId),
      "metadata[pack]": args.pack,
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL");

    console.log("[Checkout] Session created", {
      sessionId: session.id,
      url: session.url,
    });
    return { url: session.url };
  },
});

/**
 * Optional: pass a priceId directly from the client.
 */
export const createCheckout = action({
  args: {
    priceId: v.string(),
    userId: v.string(),
  },
  handler: async (_ctx, args) => {
    const baseUrl = (
      process.env.PUBLIC_APP_URL || "http://localhost:5173"
    ).trim();

    const session = await createStripeCheckoutSession({
      mode: "payment",
      "line_items[0][price]": args.priceId,
      "line_items[0][quantity]": "1",
      success_url: `${baseUrl}/?success=1`,
      cancel_url: `${baseUrl}/?canceled=1`,
      "metadata[userId]": String(args.userId),
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { url: session.url };
  },
});
