import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, readJson } from "../_shared/supabase.ts";
import { mvpProduct } from "../_shared/mvpProduct.ts";
import { verifyAccessToken } from "../_shared/guestToken.ts";
import { accessTokenSecret } from "../_shared/access.ts";
import { isServerManagedUploadPath, UPLOAD_BUCKET } from "../_shared/uploadPath.ts";
import { validateImageUpload } from "../_shared/imageValidation.ts";

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
    if (!uploadId || !accessToken) {
      return jsonResponse({ error: "upload_id and access_token are required" }, 400);
    }

    const secret = accessTokenSecret();
    const token = await verifyAccessToken(accessToken, secret, { typ: "upload", id: uploadId });
    if (!token) return jsonResponse({ error: "Unauthorized" }, 401);

    const service = getServiceClient();
    const { data: session, error } = await service
      .from("upload_sessions")
      .select("id, bucket, path, status, declared_mime, expires_at")
      .eq("id", uploadId)
      .maybeSingle();
    if (error) throw error;
    if (!session) return jsonResponse({ error: "Upload not found" }, 404);
    if (session.expires_at && new Date(String(session.expires_at)).getTime() <= Date.now()) {
      return jsonResponse({ error: "Upload expired" }, 400);
    }
    if (session.bucket !== UPLOAD_BUCKET || !isServerManagedUploadPath(session.path)) {
      return jsonResponse({ error: "Invalid upload path" }, 400);
    }
    if (session.status === "confirmed") {
      return jsonResponse({ ok: true, alreadyConfirmed: true });
    }

    const { data: file, error: downloadError } = await service.storage
      .from(UPLOAD_BUCKET)
      .download(session.path);
    if (downloadError || !file) {
      return jsonResponse({ error: "Object missing. Upload the file first." }, 400);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const headerBytes = bytes.slice(0, 16);
    const validated = validateImageUpload({
      fileName: session.path,
      reportedMime: String(session.declared_mime || "application/octet-stream"),
      sizeBytes: bytes.byteLength,
      headerBytes,
    });

    if (!validated.ok || bytes.byteLength > mvpProduct.uploadMaxBytes) {
      await service.storage.from(UPLOAD_BUCKET).remove([session.path]);
      await service
        .from("upload_sessions")
        .update({ status: "rejected", magic_ok: false })
        .eq("id", uploadId);
      return jsonResponse(
        { error: validated.ok ? "File too large" : validated.error, reason: "invalid_image_bytes" },
        400,
      );
    }

    await service
      .from("upload_sessions")
      .update({
        status: "confirmed",
        magic_ok: true,
        confirmed_at: new Date().toISOString(),
        declared_mime: validated.mime,
        declared_size: bytes.byteLength,
      })
      .eq("id", uploadId);

    return jsonResponse({
      ok: true,
      mime: validated.mime,
      byteSize: bytes.byteLength,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
