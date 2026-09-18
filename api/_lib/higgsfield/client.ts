import { createHash } from "node:crypto";
import { HIGGSFIELD_API_BASE, parseHiggsfieldEstimate, type VerifiedEstimate } from "../../../src/features/admin-library/higgsfieldModels";

export type HiggsfieldCredentials = { keyId: string; secret: string };

export function readHiggsfieldCredentials(env: NodeJS.ProcessEnv = process.env): HiggsfieldCredentials {
  const combined = String(env.HF_CREDENTIALS || env.HF_KEY || "").trim();
  if (combined.includes(":")) {
    const idx = combined.indexOf(":");
    const keyId = combined.slice(0, idx).trim();
    const secret = combined.slice(idx + 1).trim();
    if (keyId && secret) return { keyId, secret };
  }
  const keyId = String(env.HF_API_KEY_ID || env.HF_API_KEY || "").trim();
  const secret = String(env.HF_API_KEY_SECRET || env.HF_SECRET || env.HF_API_SECRET || "").trim();
  if (!keyId || !secret) {
    throw new Error(
      "Higgsfield credentials are not configured. Set HF_CREDENTIALS (KEY_ID:KEY_SECRET) on the job runner (Vercel / VPS secrets), never in the browser.",
    );
  }
  return { keyId, secret };
}

export function higgsfieldAuthHeader(creds: HiggsfieldCredentials): string {
  return `Key ${creds.keyId}:${creds.secret}`;
}

export function higgsfieldMockEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = String(env.HIGGSFIELD_MOCK || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "[invalid-url]";
  }
}

async function higgsfieldFetch(
  pathOrUrl: string,
  init: RequestInit,
  creds: HiggsfieldCredentials,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${HIGGSFIELD_API_BASE}${pathOrUrl}`;
  const headers = new Headers(init.headers);
  headers.set("Authorization", higgsfieldAuthHeader(creds));
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { detail: text.slice(0, 200) };
    }
  }
  return { ok: res.ok, status: res.status, json };
}

export type HiggsfieldRequest = {
  status: string;
  request_id: string;
  status_url?: string;
  cancel_url?: string;
  error?: string | null;
  video?: { url?: string } | null;
  images?: Array<{ url?: string }>;
};

export function videoUrlFromStatus(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const rec = body as Record<string, unknown>;
  const video = rec.video;
  if (video && typeof video === "object" && typeof (video as { url?: unknown }).url === "string") {
    return String((video as { url: string }).url);
  }
  if (typeof rec.video_url === "string") return rec.video_url;
  return null;
}

export type HiggsfieldTransport = {
  estimate: (path: string, body: Record<string, unknown>) => Promise<VerifiedEstimate | null>;
  submit: (path: string, body: Record<string, unknown>) => Promise<HiggsfieldRequest>;
  status: (statusUrlOrId: string) => Promise<HiggsfieldRequest>;
  createUploadUrl: (contentType: string) => Promise<{
    public_url: string;
    upload_url: string;
    upload_headers: Record<string, string>;
    content_type: string;
  }>;
  putUpload: (uploadUrl: string, bytes: Uint8Array, headers: Record<string, string>) => Promise<void>;
};

export function createLiveHiggsfieldTransport(creds: HiggsfieldCredentials): HiggsfieldTransport {
  return {
    async estimate(path, body) {
      const res = await higgsfieldFetch(path, { method: "POST", body: JSON.stringify(body) }, creds);
      if (!res.ok) return null;
      return parseHiggsfieldEstimate(res.json);
    },
    async submit(path, body) {
      const res = await higgsfieldFetch(path, { method: "POST", body: JSON.stringify(body) }, creds);
      if (!res.ok) {
        const detail =
          res.json && typeof res.json === "object" && "detail" in res.json
            ? String((res.json as { detail: unknown }).detail)
            : `Higgsfield submit failed (${res.status})`;
        throw new Error(detail);
      }
      const rec = res.json as HiggsfieldRequest;
      if (!rec?.request_id) throw new Error("Higgsfield submit returned no request_id");
      return rec;
    },
    async status(statusUrlOrId) {
      const path = statusUrlOrId.startsWith("http")
        ? statusUrlOrId
        : `/requests/${statusUrlOrId}/status`;
      const res = await higgsfieldFetch(path, { method: "GET" }, creds);
      if (!res.ok) throw new Error(`Higgsfield status failed (${res.status})`);
      return res.json as HiggsfieldRequest;
    },
    async createUploadUrl(contentType) {
      const res = await higgsfieldFetch(
        "/files/generate-upload-url",
        { method: "POST", body: JSON.stringify({ content_type: contentType }) },
        creds,
      );
      if (!res.ok) throw new Error(`Higgsfield upload URL failed (${res.status})`);
      const rec = res.json as {
        public_url?: string;
        upload_url?: string;
        upload_headers?: Record<string, string>;
        content_type?: string;
      };
      if (!rec.public_url || !rec.upload_url) throw new Error("Higgsfield upload URL missing fields");
      return {
        public_url: rec.public_url,
        upload_url: rec.upload_url,
        upload_headers: rec.upload_headers || { "Content-Type": contentType },
        content_type: rec.content_type || contentType,
      };
    },
    async putUpload(uploadUrl, bytes, headers) {
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers,
        body: Buffer.from(bytes),
      });
      if (!res.ok) throw new Error(`Higgsfield file upload failed (${res.status})`);
    },
  };
}

export function createMockHiggsfieldTransport(options?: { requestId?: string; videoUrl?: string; estimateUsd?: number }): HiggsfieldTransport {
  const requestId = options?.requestId || "00000000-0000-4000-8000-000000000001";
  const videoUrl = options?.videoUrl || "https://example.invalid/mock.mp4";
  const estimateUsd = options?.estimateUsd ?? 0.42;
  return {
    async estimate() {
      return { usd: estimateUsd, credits: "6.72", source: "higgsfield_estimate" };
    },
    async submit() {
      return {
        status: "queued",
        request_id: requestId,
        status_url: `${HIGGSFIELD_API_BASE}/requests/${requestId}/status`,
      };
    },
    async status() {
      return {
        status: "completed",
        request_id: requestId,
        video: { url: videoUrl },
      };
    },
    async createUploadUrl(contentType) {
      const publicUrl = `https://cdn.example.invalid/mock-upload-${createHash("sha1").update(contentType).digest("hex").slice(0, 8)}`;
      return {
        public_url: publicUrl,
        upload_url: `${publicUrl}/put`,
        upload_headers: { "Content-Type": contentType },
        content_type: contentType,
      };
    },
    async putUpload() {
      return;
    },
  };
}

export function getHiggsfieldTransport(env: NodeJS.ProcessEnv = process.env): HiggsfieldTransport {
  if (higgsfieldMockEnabled(env)) return createMockHiggsfieldTransport();
  return createLiveHiggsfieldTransport(readHiggsfieldCredentials(env));
}

export function safeStatusSummary(req: HiggsfieldRequest): Record<string, unknown> {
  return {
    status: req.status,
    request_id: req.request_id,
    has_video: Boolean(videoUrlFromStatus(req)),
    status_url: req.status_url ? redactUrl(req.status_url) : null,
    error: req.error ? String(req.error).slice(0, 240) : null,
  };
}
