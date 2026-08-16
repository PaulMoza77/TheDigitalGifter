import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getAuthUser, getServiceClient, readJson } from "../_shared/supabase.ts";
import { authorizeUploadAccess, verifyAccessToken } from "../_shared/guestToken.ts";
import { accessTokenSecret } from "../_shared/access.ts";
import { UPLOAD_BUCKET } from "../_shared/uploadPath.ts";

type Body = {
  upload_id?: string;
  uploadId?: string;
  access_token?: string;
  accessToken?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await readJson<Body>(req);
    const uploadId = String(body.upload_id || body.uploadId || "").trim();
    const accessToken = String(body.access_token || body.accessToken || "").trim();
    if (!uploadId) return jsonResponse({ error: "upload_id is required" }, 400);

    const { user } = await getAuthUser(req);
    const token = await verifyAccessToken(accessToken, accessTokenSecret(), {
      typ: "upload",
      id: uploadId,
    });

    const service = getServiceClient();
    const { data: session } = await service
      .from("upload_sessions")
      .select("id, bucket, path, status, user_id, expires_at")
      .eq("id", uploadId)
      .maybeSingle();
    if (!session || session.status !== "confirmed") {
      return jsonResponse({ error: "Upload not confirmed" }, 404);
    }

    const allowed = authorizeUploadAccess({
      uploadUserId: session.user_id ? String(session.user_id) : null,
      authUserId: user?.id ?? null,
      tokenOk: Boolean(token),
      expiresAt: session.expires_at ? String(session.expires_at) : null,
    });
    if (!allowed) return jsonResponse({ error: "Unauthorized" }, 401);
    if (session.bucket !== UPLOAD_BUCKET) {
      return jsonResponse({ error: "Invalid bucket" }, 400);
    }

    const { data, error } = await service.storage
      .from(UPLOAD_BUCKET)
      .createSignedUrl(session.path, 60 * 10);
    if (error || !data?.signedUrl) {
      return jsonResponse({ error: error?.message ?? "Could not sign URL" }, 500);
    }
    return jsonResponse({ url: data.signedUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
