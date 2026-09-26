import {
  GENERATION_UNAVAILABLE_MESSAGE,
  HIGGSFIELD_API_BASE,
  extractHiggsfieldImageUrl,
  isSuccessfulHiggsfieldStatus,
  isTerminalHiggsfieldStatus,
} from "./higgsfieldImage.ts";

type FetchImpl = typeof fetch;

function authHeaders(authorization: string, hasBody: boolean): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: authorization,
    Accept: "application/json",
    "User-Agent": "tdg-generator/higgsfield",
  };
  if (hasBody) headers["Content-Type"] = "application/json";
  return headers;
}

export async function higgsfieldJson(
  authorization: string,
  method: string,
  path: string,
  body?: unknown,
  fetchImpl: FetchImpl = fetch,
): Promise<Record<string, unknown>> {
  const url = path.startsWith("http") ? path : `${HIGGSFIELD_API_BASE}${path}`;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method,
      headers: authHeaders(authorization, body !== undefined),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(GENERATION_UNAVAILABLE_MESSAGE);
  }
  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  if (text) {
    try {
      const json = JSON.parse(text) as unknown;
      if (json && typeof json === "object") parsed = json as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }
  if (!response.ok) {
    throw new Error(GENERATION_UNAVAILABLE_MESSAGE);
  }
  return parsed;
}

export async function uploadBytesToHiggsfield(
  authorization: string,
  bytes: Uint8Array,
  contentType: string,
  fetchImpl: FetchImpl = fetch,
): Promise<string> {
  const meta = await higgsfieldJson(
    authorization,
    "POST",
    "/files/generate-upload-url",
    { content_type: contentType },
    fetchImpl,
  );
  const uploadUrl = String(meta.upload_url || "");
  const publicUrl = String(meta.public_url || "");
  if (!uploadUrl || !publicUrl) throw new Error(GENERATION_UNAVAILABLE_MESSAGE);
  const uploadHeaders = new Headers();
  const rawHeaders = meta.upload_headers;
  if (rawHeaders && typeof rawHeaders === "object") {
    for (const [key, value] of Object.entries(rawHeaders as Record<string, unknown>)) {
      if (typeof value === "string") uploadHeaders.set(key, value);
    }
  }
  if (!uploadHeaders.has("Content-Type")) uploadHeaders.set("Content-Type", contentType);
  const putBody = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const uploaded = await fetchImpl(uploadUrl, { method: "PUT", headers: uploadHeaders, body: putBody });
  if (!uploaded.ok) throw new Error(GENERATION_UNAVAILABLE_MESSAGE);
  return publicUrl;
}

export async function submitHiggsfieldImage(
  authorization: string,
  path: string,
  body: Record<string, unknown>,
  fetchImpl: FetchImpl = fetch,
): Promise<string> {
  const submitted = await higgsfieldJson(authorization, "POST", path, body, fetchImpl);
  const requestId = String(submitted.request_id || "").trim();
  if (!requestId) throw new Error(GENERATION_UNAVAILABLE_MESSAGE);
  return requestId;
}

export async function pollHiggsfieldImage(
  authorization: string,
  requestId: string,
  fetchImpl: FetchImpl = fetch,
  options?: { maxAttempts?: number; sleepMs?: number },
): Promise<{ done: boolean; imageUrl: string | null; failed: boolean }> {
  const maxAttempts = options?.maxAttempts ?? 12;
  const sleepMs = options?.sleepMs ?? 2000;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const current = await higgsfieldJson(
      authorization,
      "GET",
      `/requests/${requestId}/status`,
      undefined,
      fetchImpl,
    );
    const status = String(current.status || "");
    if (isTerminalHiggsfieldStatus(status)) {
      if (!isSuccessfulHiggsfieldStatus(status)) {
        return { done: true, imageUrl: null, failed: true };
      }
      return { done: true, imageUrl: extractHiggsfieldImageUrl(current), failed: false };
    }
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, sleepMs));
    }
  }
  return { done: false, imageUrl: null, failed: false };
}
