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

async function callChristmasFunnel<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const { url, anon } = getPublicSupabaseConfig();
  const { data: sessionData } = await supabase.auth.getSession();
  const auth = sessionData.session?.access_token || anon;
  let response: Response;
  try {
    response = await fetch(`${url.replace(/\/$/, "")}/functions/v1/christmas-funnel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${auth}`,
      },
      body: JSON.stringify({ action, ...body }),
      signal: AbortSignal.timeout(SLOW.has(action) ? 30_000 : 15_000),
    });
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "";
    if (name === "AbortError" || name === "TimeoutError") {
      throw new ChristmasApiError("TIMEOUT", "Request timed out. Please try again.", 408);
    }
    throw caught;
  }
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  };
  if (!response.ok) {
    throw new ChristmasApiError(
      payload.code || "INVALID_REQUEST",
      payload.error || "Christmas funnel request failed",
      response.status,
    );
  }
  return payload as T;
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
