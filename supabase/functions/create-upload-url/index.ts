import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getAuthUser, getServiceClient, readJson } from "../_shared/supabase.ts";
import { mvpProduct } from "../_shared/mvpProduct.ts";

type Body = {
  file_name?: string;
  content_type?: string;
  size_bytes?: number;
};

const JPEG = [0xff, 0xd8, 0xff];

function extFromName(name: string) {
  return String(name.split(".").pop() || "").toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await readJson<Body>(req);
    const fileName = String(body.file_name || "photo.jpg");
    const contentType = String(body.content_type || "image/jpeg").toLowerCase();
    const sizeBytes = Number(body.size_bytes || 0);
    const ext = extFromName(fileName);

    if (sizeBytes <= 0 || sizeBytes > mvpProduct.uploadMaxBytes) {
      return jsonResponse({ error: "Image must be a JPG, PNG, or WebP under 10 MB." }, 400);
    }

    if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
      return jsonResponse({ error: "File extension must be .jpg, .png, or .webp." }, 400);
    }

    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(contentType)) {
      return jsonResponse({ error: "Please upload a JPG, PNG, or WebP image." }, 400);
    }

    void JPEG;
    const { user } = await getAuthUser(req);
    const folder = user?.id || "guest";
    const safe = fileName.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(0, 60);
    const path = `${folder}/${Date.now()}-${crypto.randomUUID()}-${safe}`;

    const service = getServiceClient();
    const { data, error } = await service.storage
      .from("customer-uploads")
      .createSignedUploadUrl(path);

    if (error || !data?.signedUrl) {
      throw new Error(error?.message || "Could not create upload URL");
    }

    return jsonResponse({
      bucket: "customer-uploads",
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
