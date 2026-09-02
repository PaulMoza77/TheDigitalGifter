import { getPublicSupabaseConfig } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import type { ChristmasPackKey, ChristmasSceneKey } from "./config";

export class ChristmasApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export type ChristmasOrderSummary = {
  orderId: string;
  publicToken: string;
  status: string;
  packKey: ChristmasPackKey;
  amountCents: number;
  imageCount: number;
  videoCount: number;
  email?: string;
};

export type ChristmasSceneResult = {
  sceneKey: string;
  title: string;
  status: string;
  imageUrl?: string | null;
};

export type ChristmasVideoResult = {
  id: string;
  sourceSceneKey: string;
  status: string;
  videoUrl?: string | null;
};

export type ChristmasOrderResults = {
  order: ChristmasOrderSummary;
  scenes: ChristmasSceneResult[];
  videos: ChristmasVideoResult[];
  progressPercent: number;
};

type CheckoutResult = {
  orderId: string;
  publicToken: string;
  sessionId: string;
  clientSecret?: string | null;
  publishableKey?: string | null;
  checkoutUrl?: string | null;
  expiresAt?: number | null;
  amountCents: number;
  status?: string;
};

const SLOW = new Set(["createStripeCheckout", "createUpsellCheckout", "createOrder"]);

type FunnelErrorPayload = { error?: string; code?: string };

/** Sentinel returned when a same-origin route looks unavailable (platform 404/502 with no
 * JSON error body) so the caller knows to retry against the Supabase Edge function. */
const ROUTE_UNAVAILABLE = Symbol("christmas-funnel-route-unavailable");

function fetchChristmasFunnel(
  endpoint: string,
  headers: Record<string, string>,
  action: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ action, ...body }),
    signal: AbortSignal.timeout(SLOW.has(action) ? 30_000 : 15_000),
  });
}

async function readVercelFunnelResponse<T>(response: Response): Promise<T | typeof ROUTE_UNAVAILABLE> {
  const payload = (await response.json().catch(() => null)) as FunnelErrorPayload | null;
  const hasAppErrorShape = Boolean(payload && typeof payload === "object" && typeof payload.code === "string");
  if (response.ok) {
    if (!payload) return ROUTE_UNAVAILABLE;
    return payload as T;
  }
  // Only known application errors (our apiError() shape) should short-circuit the fallback.
  // A bare 404/502 with no matching body means the Vercel route itself is missing/broken.
  if ((response.status === 404 || response.status === 502) && !hasAppErrorShape) {
    return ROUTE_UNAVAILABLE;
  }
  throw new ChristmasApiError(
    payload?.code || "INVALID_REQUEST",
    payload?.error || "Christmas funnel request failed",
    response.status,
  );
}

async function callChristmasFunnel<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  const { url, anon } = getPublicSupabaseConfig();
  const auth = accessToken || anon;
  const edgeUrl = `${url.replace(/\/$/, "")}/functions/v1/christmas-funnel`;
  const edgeHeaders = { apikey: anon, Authorization: `Bearer ${auth}` };

  // Prefer Supabase Edge — production does not depend on Vercel deploy.
  try {
    const response = await fetchChristmasFunnel(edgeUrl, edgeHeaders, action, body);
    const payload = (await response.json().catch(() => ({}))) as FunnelErrorPayload;
    if (response.ok) return payload as T;
    if (response.status !== 404 && response.status !== 502) {
      throw new ChristmasApiError(
        payload.code || "INVALID_REQUEST",
        payload.error || "Christmas funnel request failed",
        response.status,
      );
    }
  } catch (caught) {
    if (caught instanceof ChristmasApiError) throw caught;
    const name = caught instanceof Error ? caught.name : "";
    if (name === "AbortError" || name === "TimeoutError") {
      throw new ChristmasApiError("TIMEOUT", "Request timed out. Please try again.", 408);
    }
    // Network-level failure — fall through to same-origin Vercel route below.
  }

  // Fallback: same-origin Vercel port (local dev / when Vercel is available).
  try {
    const response = await fetchChristmasFunnel(
      "/api/christmas-funnel",
      accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      action,
      body,
    );
    const result = await readVercelFunnelResponse<T>(response);
    if (result !== ROUTE_UNAVAILABLE) return result;
  } catch (caught) {
    if (caught instanceof ChristmasApiError) throw caught;
    const name = caught instanceof Error ? caught.name : "";
    if (name === "AbortError" || name === "TimeoutError") {
      throw new ChristmasApiError("TIMEOUT", "Request timed out. Please try again.", 408);
    }
  }

  throw new ChristmasApiError(
    "NETWORK",
    "Checkout could not reach the Christmas backend. Please try again in a moment.",
    503,
  );
}

export const christmasFunnelApi = {
  createOrder: (input: {
    email: string;
    customerName?: string;
    photo: { fileName: string; contentType: string; byteSize: number };
    packKey?: ChristmasPackKey;
    sceneKeys?: ChristmasSceneKey[];
    funnelSessionId?: string;
  }) => callChristmasFunnel<ChristmasOrderSummary>("createOrder", input as unknown as Record<string, unknown>),

  getSignedUploadUrl: (input: {
    orderId: string;
    publicToken: string;
    contentType: string;
    byteSize: number;
    fileName?: string;
  }) =>
    callChristmasFunnel<{
      uploadUrl: string;
      method: string;
      headers: Record<string, string>;
      objectPath: string;
    }>("getSignedUploadUrl", input),

  confirmUpload: (input: { orderId: string; publicToken: string; objectPath: string }) =>
    callChristmasFunnel<{ ok: boolean }>("confirmUpload", input),

  updateOrderContact: (input: {
    orderId: string;
    publicToken: string;
    email: string;
    customerName?: string;
  }) => callChristmasFunnel<{ ok: boolean }>("updateOrderContact", input),

  createStripeCheckout: (input: {
    orderId: string;
    publicToken: string;
    uiMode?: "elements" | "hosted";
    successUrl?: string;
    cancelUrl?: string;
    funnelSessionId?: string;
    attribution?: Record<string, string | null | undefined>;
  }) => callChristmasFunnel<CheckoutResult>("createStripeCheckout", input as unknown as Record<string, unknown>),

  createUpsellCheckout: (input: {
    parentOrderId: string;
    publicToken: string;
    packKey: "magic" | "ultimate";
    sceneKeys?: ChristmasSceneKey[];
    videoSourceSceneKeys?: ChristmasSceneKey[];
    surpriseMe?: boolean;
    uiMode?: "elements" | "hosted";
    successUrl?: string;
    cancelUrl?: string;
    funnelSessionId?: string;
  }) => callChristmasFunnel<CheckoutResult>("createUpsellCheckout", input as unknown as Record<string, unknown>),

  /** Best-effort client-side fulfillment nudge: verifies the Stripe session and runs the same
   * RPC the webhook uses, so paid orders unlock immediately even if stripe-webhook (Edge) is
   * unavailable or lags. Idempotent — safe to call even if the webhook already fulfilled it. */
  confirmStripePayment: (input: { publicToken: string; sessionId: string }) =>
    callChristmasFunnel<{ ok: boolean; status: string; alreadyPaid: boolean; orderId: string; publicToken: string }>(
      "confirmStripePayment",
      input,
    ),

  getOrderByPublicToken: (input: { publicToken: string }) =>
    callChristmasFunnel<ChristmasOrderResults>("getOrderByPublicToken", input),

  pollGenerationProgress: (input: { publicToken: string }) =>
    callChristmasFunnel<ChristmasOrderResults>("pollGenerationProgress", input),

  listMyChristmasGalleries: () =>
    callChristmasFunnel<
      Array<{
        orderId: string;
        publicToken: string;
        packKey: string;
        packName: string;
        status: string;
        createdAt: string;
        imageCount: number;
        videoCount: number;
        scenes: ChristmasSceneResult[];
        videos: ChristmasVideoResult[];
      }>
    >("listMyChristmasGalleries", {}),
};

export async function uploadChristmasPhotoToSignedUrl(
  uploadUrl: string,
  blob: Blob,
  contentType: string,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!res.ok) throw new ChristmasApiError("UPLOAD_FAILED", "Photo upload failed. Please try again.", res.status);
}
