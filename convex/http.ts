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

    const PACK_TO_CREDITS: Record<string, number> = {
      starter: 25,
      creator: 50,
      pro: 500,
      enterprise: 5000,
    };
    const amount = pack ? (PACK_TO_CREDITS[pack] ?? 0) : 0;

    console.log("[Webhook] Calculated credits", { pack, amount });

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
