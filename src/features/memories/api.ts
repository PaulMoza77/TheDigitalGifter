import { getPublicSupabaseConfig } from "@/lib/env";
import {
  MEMORIES_API_EDGE_ACTION,
  MEMORIES_API_PATH,
  type MemoriesPlanKey,
} from "./config";
import { getMemoriesSessionId } from "./session";
import {
  attributionParamsForInternal,
  captureFunnelAttribution,
  getFunnelFirstTouchContext,
} from "../pet/funnelAttribution";

type ApiResult = Record<string, unknown>;

async function callMemoriesApi(action: string, body: Record<string, unknown> = {}): Promise<ApiResult> {
  captureFunnelAttribution();
  const attribution = attributionParamsForInternal();
  const context = getFunnelFirstTouchContext();
  const payload = {
    action,
    client_session_id: getMemoriesSessionId(),
    funnel_session_id: getMemoriesSessionId(),
    utm_source: attribution.utm_source ?? null,
    utm_medium: attribution.utm_medium ?? null,
    utm_campaign: attribution.utm_campaign ?? null,
    utm_content: attribution.utm_content ?? null,
    utm_term: attribution.utm_term ?? null,
    campaign_id: attribution.campaign_id ?? null,
    adset_id: attribution.adset_id ?? null,
    ad_id: attribution.ad_id ?? null,
    referrer_host: context.referrerHost,
    ...body,
  };

  const { url, anon } = getPublicSupabaseConfig();
  const edgeUrl = `${url.replace(/\/$/, "")}/functions/v1/${MEMORIES_API_EDGE_ACTION}`;

  try {
    const edgeRes = await fetch(edgeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify(payload),
    });
    if (edgeRes.ok || edgeRes.status < 500) {
      return (await edgeRes.json()) as ApiResult;
    }
  } catch {
    /* fall through to origin */
  }

  const originRes = await fetch(MEMORIES_API_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  return (await originRes.json()) as ApiResult;
}

export const memoriesApi = {
  config: () => callMemoriesApi("config"),
  upsertSession: (step?: string) => callMemoriesApi("upsert_session", { step }),
  createUploadUrl: (input: { contentType: string; fileName: string; byteSize: number }) =>
    callMemoriesApi("create_upload_url", {
      content_type: input.contentType,
      file_name: input.fileName,
      byte_size: input.byteSize,
    }),
  confirmUpload: (uploadId: string, publicToken: string) =>
    callMemoriesApi("confirm_upload", { upload_id: uploadId, public_token: publicToken }),
  removeUpload: (uploadId: string, publicToken: string) =>
    callMemoriesApi("remove_upload", { upload_id: uploadId, public_token: publicToken }),
  submitEmail: (input: {
    email: string;
    fullName?: string;
    marketingOptIn: boolean;
    processingConsent: boolean;
    authorityAck: boolean;
  }) =>
    callMemoriesApi("submit_email", {
      email: input.email,
      full_name: input.fullName,
      marketing_opt_in: input.marketingOptIn,
      processing_consent: input.processingConsent,
      authority_ack: input.authorityAck,
    }),
  selectPlan: (planKey: MemoriesPlanKey) => callMemoriesApi("select_plan", { plan_key: planKey }),
  createCheckout: (planKey: MemoriesPlanKey, idempotencyKey?: string) =>
    callMemoriesApi("create_checkout", {
      plan_key: planKey,
      idempotency_key: idempotencyKey,
    }),
  joinWaitlist: (planKey: MemoriesPlanKey) => callMemoriesApi("join_waitlist", { plan_key: planKey }),
  orderStatus: (token: string) => callMemoriesApi("order_status", { token }),
  billingPortal: (token: string) => callMemoriesApi("billing_portal", { token }),
  cancelSubscription: (token: string) => callMemoriesApi("cancel_subscription", { token }),
};

export async function uploadFileToSignedUrl(file: File, signedUrl: string, token?: string) {
  const headers: Record<string, string> = {
    "Content-Type": file.type || "application/octet-stream",
  };
  if (token) {
    // Supabase signed upload URL may include token query; keep for compatibility
  }
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers,
    body: file,
  });
  if (!res.ok) {
    throw new Error(`Upload failed (${res.status})`);
  }
}
