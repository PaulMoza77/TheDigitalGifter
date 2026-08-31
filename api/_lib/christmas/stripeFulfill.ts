/**
 * Node/Vercel port of supabase/functions/_shared/christmas/stripeFulfill.ts
 * enqueue helpers. Fulfillment itself (RPC calls) lives in api/christmas-funnel.ts
 * since the Vercel action handler already has the Supabase client + request context.
 */
import { asString } from "./crypto";
import { CHRISTMAS_PRODUCT_TYPE } from "./constants";

export function isChristmasCheckoutMetadata(metadata: Record<string, unknown>): boolean {
  return (
    asString(metadata.product_type) === CHRISTMAS_PRODUCT_TYPE || asString(metadata.sku).startsWith("christmas-")
  );
}

/** Best-effort same-origin (Vercel) invoke, falling back to the Supabase Edge
 * function when one is deployed. Intended to be handed to `waitUntil` by the
 * caller so it can keep running after the HTTP response has been sent. */
export async function invokeChristmasGenerate(orderId: string, siteOrigin: string): Promise<void> {
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!serviceKey) {
    console.error("christmas-generate enqueue skipped: missing SUPABASE_SERVICE_ROLE_KEY");
    return;
  }

  if (siteOrigin) {
    try {
      const res = await fetch(`${siteOrigin.replace(/\/$/, "")}/api/christmas-generate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ order_id: orderId }),
      });
      if (res.ok) return;
      console.error(`christmas-generate same-origin invoke failed: ${res.status}`);
    } catch (err) {
      console.error("christmas-generate same-origin invoke error", err);
    }
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  if (!supabaseUrl) return;
  try {
    await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/christmas-generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ order_id: orderId }),
    });
  } catch (err) {
    console.error("christmas-generate edge invoke failed", err);
  }
}

export async function invokeChristmasGenerateVideo(orderId: string, siteOrigin: string): Promise<void> {
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!serviceKey) {
    console.error("christmas-generate-video enqueue skipped: missing SUPABASE_SERVICE_ROLE_KEY");
    return;
  }

  if (siteOrigin) {
    try {
      const res = await fetch(`${siteOrigin.replace(/\/$/, "")}/api/christmas-generate-video`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ order_id: orderId }),
      });
      if (res.ok) return;
      console.error(`christmas-generate-video same-origin invoke failed: ${res.status}`);
    } catch (err) {
      console.error("christmas-generate-video same-origin invoke error", err);
    }
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  if (!supabaseUrl) return;
  try {
    await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/christmas-generate-video`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ order_id: orderId }),
    });
  } catch (err) {
    console.error("christmas-generate-video edge invoke failed", err);
  }
}

/** Resolve a same-origin base URL from request headers so the invoke helpers
 * above work in preview and production deployments without hardcoding a host. */
export function resolveSiteOriginFromRequest(headers: {
  "x-forwarded-proto"?: string | string[];
  host?: string | string[];
}): string {
  const configured = String(process.env.SITE_URL || process.env.PUBLIC_APP_URL || "").trim();
  if (configured) return configured.replace(/\/$/, "");
  const proto = Array.isArray(headers["x-forwarded-proto"])
    ? headers["x-forwarded-proto"][0]
    : headers["x-forwarded-proto"] || "https";
  const host = Array.isArray(headers.host) ? headers.host[0] : headers.host;
  if (host) return `${proto}://${host}`;
  return "https://www.thedigitalgifter.com";
}
