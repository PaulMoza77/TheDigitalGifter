import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import {
  assertAdmin,
  getAuthUser,
  getServiceClient,
  readJson,
  requiredEnv,
} from "../_shared/supabase.ts";

async function replicateImage(prompt: string) {
  const token = requiredEnv("REPLICATE_API_TOKEN");
  const model =
    Deno.env.get("REPLICATE_NANO_BANANA_MODEL") ||
    Deno.env.get("REPLICATE_IMAGE_MODEL") ||
    "google/nano-banana";
  const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({ input: { prompt } }),
  });
  const prediction = await res.json();
  if (!res.ok) throw new Error(prediction?.detail || prediction?.error || "Replicate failed");
  const out = prediction.output;
  if (typeof out === "string") return out;
  if (Array.isArray(out) && out[0]) return String(out[0]);
  throw new Error("No image from Replicate");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { user } = await getAuthUser(req);
    await assertAdmin(user?.email);
    const body = await readJson<{ prompt?: string; title?: string; occasion?: string }>(req);
    const prompt = String(body.prompt || "").trim();
    if (!prompt) return jsonResponse({ error: "prompt required" }, 400);

    const remoteUrl = await replicateImage(prompt);
    const img = await fetch(remoteUrl);
    const bytes = new Uint8Array(await img.arrayBuffer());
    const path = `previews/ai/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`;
    const service = getServiceClient();
    const { error } = await service.storage
      .from("templates")
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (error) throw error;
    const publicUrl = `${requiredEnv("SUPABASE_URL")}/storage/v1/object/public/templates/${path}`;
    return jsonResponse({
      preview_url: publicUrl,
      previewUrl: publicUrl,
      image_url: publicUrl,
      url: publicUrl,
      publicUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("Admin") || message.includes("Forbidden") ? 403 : 500;
    return jsonResponse({ error: message }, status);
  }
});
