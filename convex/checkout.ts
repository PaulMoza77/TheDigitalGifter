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
 *  - PRICE_STARTER
 *  - PRICE_CREATOR
 *  - PRICE_PRO
 *  - PRICE_ENTERPRISE
 *
 * Requires authenticated user - throws if not logged in.
 */
export const createCheckoutByPack = action({
  args: {
    pack: v.string(), // "starter" | "creator" | "pro" | "enterprise"
    quantity: v.optional(v.number()), // Bundle quantity (default 1)
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

    // Pack prices in cents (for Stripe)
    const PACK_PRICES: Record<string, number> = {
      starter: 498, // €4.98
      creator: 998, // €9.98
      pro: 7898, // €78.98
      enterprise: 49998, // €499.98
    };

    // Pack display names
    const PACK_NAMES: Record<string, string> = {
      starter: "Starter",
      creator: "Creator",
      pro: "Pro",
      enterprise: "Enterprise",
    };

    const quantity = args.quantity ?? 1;

    // Tiered bundle discount: 2=10%, 3=15%, 4+=20%
    const getDiscount = (qty: number): number => {
      if (qty >= 4) return 0.2;
      if (qty >= 3) return 0.15;
      if (qty >= 2) return 0.1;
      return 0;
    };

    const discount = getDiscount(quantity);
    const basePrice = PACK_PRICES[args.pack];
    const discountedPrice = Math.round(basePrice * (1 - discount));

    console.log("[Checkout] Creating session", {
      userId,
      pack: args.pack,
      quantity,
      basePrice,
      discount: `${discount * 100}%`,
      discountedPrice,
      totalBeforeDiscount: basePrice * quantity,
      totalAfterDiscount: discountedPrice * quantity,
    });

    // Build session params using price_data (no pre-created price ID needed)
    const sessionParams: Record<string, string> = {
      mode: "payment",
      // Use price_data to set custom discounted price
      "line_items[0][price_data][currency]": "eur",
      "line_items[0][price_data][unit_amount]": String(discountedPrice),
      "line_items[0][price_data][product_data][name]": `${PACK_NAMES[args.pack]} Pack${discount > 0 ? ` (${Math.round(discount * 100)}% OFF)` : ""}`,
      "line_items[0][price_data][product_data][description]": `Credit bundle for The Digital Gifter`,
      "line_items[0][quantity]": String(quantity),
      success_url: `${baseUrl}/?checkout=success`,
      cancel_url: `${baseUrl}/?checkout=cancel`,
      "metadata[userId]": String(userId),
      "metadata[pack]": args.pack,
      "metadata[quantity]": String(quantity),
      "metadata[discount]": String(discount),
    };

    const session = await createStripeCheckoutSession(sessionParams);

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
