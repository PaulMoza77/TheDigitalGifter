import { supabase } from "@/lib/supabase";

const FUNNEL_URL = `${String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "")}/functions/v1/christmas-photo-funnel`;
const CHECKOUT_URL = `${String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "")}/functions/v1/christmas-checkout`;

async function anonHeaders(): Promise<Record<string, string>> {
  const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: anon,
  };
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) {
    headers.Authorization = `Bearer ${data.session.access_token}`;
  } else if (anon) {
    headers.Authorization = `Bearer ${anon}`;
  }
  return headers;
}

export async function createChristmasUpload(input: {
  contentType: string;
  byteSize: number;
  width?: number;
  height?: number;
}) {
  const res = await fetch(FUNNEL_URL, {
    method: "POST",
    headers: await anonHeaders(),
    body: JSON.stringify({
      action: "createUpload",
      content_type: input.contentType,
      byte_size: input.byteSize,
      width: input.width,
      height: input.height,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload URL failed");
  return data as {
    ok: true;
    uploadId: string;
    path: string;
    bucket: string;
    token: string;
    signedUrl: string;
    replicate_preview: false;
  };
}

export async function uploadChristmasBlob(signedUrl: string, token: string, blob: Blob, contentType: string) {
  // Prefer Supabase storage uploadToSignedUrl when available via client.
  const pathMatch = /\/object\/upload\/sign\/([^?]+)/.exec(signedUrl);
  if (pathMatch) {
    const objectPath = decodeURIComponent(pathMatch[1].replace(/^christmas-source\//, ""));
    const { error } = await supabase.storage
      .from("christmas-source")
      .uploadToSignedUrl(objectPath, token, blob, { contentType, upsert: true });
    if (error) throw error;
    return;
  }
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!res.ok) throw new Error("Upload failed");
}

export async function startChristmasCheckout(body: Record<string, unknown>) {
  const res = await fetch(CHECKOUT_URL, {
    method: "POST",
    headers: await anonHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || "Checkout failed") as Error & { code?: string };
    err.code = data.code;
    throw err;
  }
  return data as {
    ok: true;
    orderId: string;
    publicToken: string | null;
    sessionId: string;
    clientSecret: string;
    publishableKey: string;
    amountCents: number;
    currency: string;
    uiMode: "custom";
  };
}

export async function getChristmasOrderByToken(publicToken: string) {
  const res = await fetch(FUNNEL_URL, {
    method: "POST",
    headers: await anonHeaders(),
    body: JSON.stringify({ action: "getOrder", public_token: publicToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Order lookup failed");
  return data as {
    ok: true;
    order: {
      id: string;
      product_key: string;
      package_key: string;
      style_key: string | null;
      payment_status: string;
      fulfillment_status: string;
      amount_cents: number;
      currency: string;
      last_error: string | null;
      resultUrl: string | null;
    };
  };
}
