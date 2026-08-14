import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getAuthUser, getServiceClient, readJson } from "../_shared/supabase.ts";
import { mvpProduct } from "../_shared/mvpProduct.ts";
import { signAccessToken } from "../_shared/guestToken.ts";
import { accessTokenSecret, hashClientIp } from "../_shared/access.ts";
import {
  allowRateLimit,
  extensionFromMime,
  serverUploadPath,
  UPLOAD_BUCKET,
} from "../_shared/uploadPath.ts";

type Body = {
  file_name?: string;
  content_type?: string;
  size_bytes?: number;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const secret = accessTokenSecret();
    if (!secret) return jsonResponse({ error: "Access token secret is not configured." }, 503);

    const body = await readJson<Body>(req);
    const contentType = String(body.content_type || "image/jpeg").toLowerCase();
    const sizeBytes = Number(body.size_bytes || 0);
    const ext = extensionFromMime(contentType);
    void body.file_name;

    if (sizeBytes <= 0 || sizeBytes > mvpProduct.uploadMaxBytes) {
      return jsonResponse({ error: "Image must be a JPG, PNG, or WebP under 10 MB." }, 400);
    }
    if (!ext) {
      return jsonResponse({ error: "Please upload a JPG, PNG, or WebP image." }, 400);
    }

    const { user } = await getAuthUser(req);
    const ipHash = await hashClientIp(req);
    const service = getServiceClient();
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countErr } = await service
      .from("upload_sessions")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", hourAgo);
    if (countErr) throw countErr;
    if (!allowRateLimit(count ?? 0)) {
      return jsonResponse({ error: "Too many uploads. Please wait and try again." }, 429);
    }

    const uploadId = crypto.randomUUID();
    const path = serverUploadPath(uploadId, ext);
    const expiresAt = new Date(
      Date.now() + mvpProduct.uploadRetentionHours * 60 * 60 * 1000,
    ).toISOString();

    const { error: insertErr } = await service.from("upload_sessions").insert({
      id: uploadId,
      bucket: UPLOAD_BUCKET,
      path,
      declared_mime: contentType,
      declared_size: sizeBytes,
      status: "pending_upload",
      user_id: user?.id ?? null,
      ip_hash: ipHash,
      expires_at: expiresAt,
    });
    if (insertErr) throw insertErr;

    const { data, error } = await service.storage
      .from(UPLOAD_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data?.signedUrl) {
      throw new Error(error?.message || "Could not create upload URL");
    }

    const accessToken = await signAccessToken(
      {
        typ: "upload",
        id: uploadId,
        exp: Math.floor(Date.now() / 1000) + mvpProduct.uploadRetentionHours * 3600,
      },
      secret,
    );

    return jsonResponse({
      upload_id: uploadId,
      access_token: accessToken,
      bucket: UPLOAD_BUCKET,
      path,
      signed_url: data.signedUrl,
      token: data.token,
      expires_in_hours: mvpProduct.uploadRetentionHours,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
