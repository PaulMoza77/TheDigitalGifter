// convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import auth from "./auth";

// === Utils ===
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing ENV: ${name}`);
  return v.trim();
}

// HMAC-SHA256 (Web Crypto API - suportat în Convex runtime)
async function hmacSHA256(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return res === 0;
}

// === Webhook handler ===
const stripeWebhook = httpAction(async (ctx, req) => {
  console.log("[Webhook] Incoming request", {
    method: req.method,
    url: req.url,
    pathname: new URL(req.url).pathname,
  });

  const sigHeader = req.headers.get("stripe-signature") || "";
  const secret = requireEnv("STRIPE_WEBHOOK_SECRET");

  // Stripe header: t=...,v1=...,v0=...
  const parts = Object.fromEntries(
    sigHeader.split(",").map((x) => {
      const [k, ...rest] = x.split("=");
      return [k, rest.join("=")];
    })
  );
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return new Response("Bad signature header", { status: 400 });

  // BODY RAW este obligatoriu pentru verificare
  const raw = await req.text();
  const expected = await hmacSHA256(secret, `${t}.${raw}`);
  if (!timingSafeEqual(expected, v1)) {
    return new Response("Invalid signature", { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Ne interesează doar checkout.session.completed
  if (event?.type === "checkout.session.completed") {
    console.log("[Webhook] checkout.session.completed received");
    const session = event.data?.object;
    const meta = session?.metadata || {};
    const userId: string | undefined = meta.userId;
    const pack: string | undefined = meta.pack;

    console.log("[Webhook] Session metadata", {
      userId,
      pack,
      sessionId: session?.id,
    });

    // Preferred: map Stripe price IDs (from env) to credit amounts so the
    // webhook can be authoritative and independent from client-sent metadata.
    const PRICE_ID_TO_CREDITS: Record<string, number> = {
      // env vars expected to hold Stripe price IDs (plan-specific names)
      [requireEnv("PRICE_STARTER")]: 100,
      [requireEnv("PRICE_CREATOR")]: 250,
      [requireEnv("PRICE_PRO")]: 4000,
      [requireEnv("PRICE_ENTERPRISE")]: 50000,
    };

    // Fallback mapping if metadata.pack is present (keeps behavior for older sessions)
    const PACK_TO_CREDITS: Record<string, number> = {
      starter: 100,
      creator: 250,
      pro: 4000,
      enterprise: 50000,
    };

    // Try to determine price id from session (best-effort). Stripe may or may not
    // include line_items in the session payload depending on how the webhook is configured.
    const sessionPriceId: string | undefined =
      session?.line_items?.data?.[0]?.price?.id ||
      session?.display_items?.[0]?.price?.id ||
      session?.line_items?.data?.[0]?.price ||
      undefined;

    let amount = 0;
    if (sessionPriceId && PRICE_ID_TO_CREDITS[sessionPriceId]) {
      amount = PRICE_ID_TO_CREDITS[sessionPriceId];
    } else if (pack) {
      amount = PACK_TO_CREDITS[pack] ?? 0;
    }

    console.log("[Webhook] Determined credits", {
      pack,
      sessionPriceId,
      amount,
    });

    // 1) Dacă avem userId (și nu e "guest_user"), adăugăm pe userId
    if (userId && userId !== "guest_user" && amount > 0) {
      console.log("[Webhook] Adding credits by userId", { userId, amount });
      try {
        await ctx.runMutation(internal.credits.addCreditsByExternalId, {
          userId,
          amount,
        });
        console.log("[Webhook] ✅ Credits added successfully", {
          userId,
          amount,
        });

        // Create order record for revenue tracking
        // Map credits to Euro amount (you can adjust these prices)
        const PACK_TO_PRICE: Record<string, number> = {
          starter: 4.98,
          creator: 9.98,
          pro: 78.98,
          enterprise: 499.98,
        };

        const euroAmount = pack ? (PACK_TO_PRICE[pack] ?? 0) : 0;

        if (euroAmount > 0 && session?.id) {
          try {
            await ctx.runMutation(api.orders.create, {
              userId: userId,
              amount: euroAmount,
              pack: pack || "unknown",
              stripeSessionId: session.id,
            });
            console.log("[Webhook] ✅ Order record created", {
              userId,
              pack,
              euroAmount,
            });
          } catch (orderError) {
            console.error("[Webhook] ⚠️ Failed to create order record", {
              userId,
              pack,
              error: orderError,
            });
            // Don't fail the webhook if order creation fails
          }
        }

        return new Response("ok", { status: 200 });
      } catch (error) {
        console.error("[Webhook] ❌ Failed to add credits by userId", {
          userId,
          amount,
          error,
        });
        return new Response("Failed to add credits", { status: 500 });
      }
    }

    // 2) Altfel, încercăm după email-ul din Stripe (pentru vizitatori)
    const email: string | undefined = session?.customer_details?.email;
    if (email && amount > 0) {
      console.log("[Webhook] Adding credits by email", { email, amount });
      try {
        await ctx.runMutation(internal.credits.addCreditsByEmail, {
          email,
          amount,
        });
        console.log("[Webhook] ✅ Credits added by email", { email, amount });

        // Create order record for revenue tracking (email-based)
        const PACK_TO_PRICE: Record<string, number> = {
          starter: 4.98,
          creator: 9.98,
          pro: 78.98,
          enterprise: 499.98,
        };

        const euroAmount = pack ? (PACK_TO_PRICE[pack] ?? 0) : 0;

        if (euroAmount > 0 && session?.id) {
          try {
            // For email-based purchases, we need to find the userId first
            // This is a limitation - we can't create orders without userId
            // You might want to store email in orders table or link later
            console.log(
              "[Webhook] ⚠️ Skipping order creation for email-based purchase (no userId)",
              {
                email,
                pack,
              }
            );
          } catch (orderError) {
            console.error("[Webhook] ⚠️ Failed to create order record", {
              email,
              pack,
              error: orderError,
            });
          }
        }

        return new Response("ok", { status: 200 });
      } catch (error) {
        console.error("[Webhook] ❌ Failed to add credits by email", {
          email,
          amount,
          error,
        });
        return new Response("Failed to add credits", { status: 500 });
      }
    }

    console.warn(
      "[Webhook] ⚠️ No valid userId or email found, skipping credit addition",
      {
        userId,
        email,
        amount,
      }
    );

    return new Response("ok", { status: 200 });
  }

  // Ignorăm alte evenimente
  return new Response("ignored", { status: 200 });
});

// Router HTTP Convex — expune endpointul /stripe/webhook
const http = httpRouter();

auth.addHttpRoutes(http);

const redirectToApiAuth = httpAction(async (_ctx, req) => {
  const url = new URL(req.url);
  console.log("[Convex Auth] Incoming auth redirect:", {
    path: url.pathname,
    search: url.search,
    method: req.method,
  });
  url.pathname = `/api${url.pathname}`;
  return new Response(null, {
    status: 308,
    headers: { Location: url.toString() },
  });
});

http.route({
  pathPrefix: "/auth/signin/",
  method: "GET",
  handler: redirectToApiAuth,
});

http.route({
  pathPrefix: "/auth/callback/",
  method: "GET",
  handler: redirectToApiAuth,
});

http.route({
  pathPrefix: "/auth/callback/",
  method: "POST",
  handler: redirectToApiAuth,
});

http.route({ path: "/stripe/webhook", method: "POST", handler: stripeWebhook });
export default http;
