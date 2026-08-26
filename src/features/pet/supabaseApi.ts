import { getPublicSupabaseConfig } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import { PetApiError, type PetFunnelApi } from "./api";
import type { PetFunnelApiErrorCode } from "./types";

async function callPetFunnel<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const { url, anon } = getPublicSupabaseConfig();
  const { data: sessionData } = await supabase.auth.getSession();
  const auth = sessionData.session?.access_token || anon;
  let response: Response;
  try {
    response = await fetch(`${url.replace(/\/$/, "")}/functions/v1/pet-funnel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${auth}`,
      },
      body: JSON.stringify({ action, ...body }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "";
    if (name === "AbortError" || name === "TimeoutError") {
      throw new PetApiError("INVALID_REQUEST", "Status check timed out.", 408);
    }
    throw caught;
  }
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    code?: PetFunnelApiErrorCode;
  };
  if (!response.ok) {
    throw new PetApiError(
      payload.code || (response.status === 404 ? "ORDER_NOT_FOUND" : "INVALID_REQUEST"),
      payload.error || "Pet funnel request failed",
      response.status,
    );
  }
  return payload as T;
}

export function createPetFunnelApi(): PetFunnelApi {
  return {
    createOrder: (input) => callPetFunnel("createOrder", input as unknown as Record<string, unknown>),
    getSignedUploadUrl: (input) =>
      callPetFunnel("getSignedUploadUrl", input as unknown as Record<string, unknown>),
    confirmUpload: (input) => callPetFunnel("confirmUpload", input as unknown as Record<string, unknown>),
    updateOrderContact: (input) =>
      callPetFunnel("updateOrderContact", input as unknown as Record<string, unknown>),
    recordV3InitiateCheckout: (input) =>
      callPetFunnel("recordV3InitiateCheckout", input as unknown as Record<string, unknown>),
    createStripeCheckout: (input) =>
      callPetFunnel("createStripeCheckout", input as unknown as Record<string, unknown>),
    createUpsellCheckout: (input) =>
      callPetFunnel("createUpsellCheckout", input as unknown as Record<string, unknown>),
    getOrderByPublicToken: (input) =>
      callPetFunnel("getOrderByPublicToken", input as unknown as Record<string, unknown>),
    pollGenerationProgress: (input) =>
      callPetFunnel("pollGenerationProgress", input as unknown as Record<string, unknown>),
    getOrderResults: (input) =>
      callPetFunnel("getOrderResults", input as unknown as Record<string, unknown>),
    listMyPetGalleries: () => callPetFunnel("listMyPetGalleries", {}),
    getPublicOffer: () => callPetFunnel("getPublicOffer", {}),
  };
}

export const petFunnelApi: PetFunnelApi = createPetFunnelApi();
