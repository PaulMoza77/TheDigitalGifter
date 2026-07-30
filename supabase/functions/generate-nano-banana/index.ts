import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getAuthUser, getServiceClient, readJson, requiredEnv } from "../_shared/supabase.ts";

async function generateWithReplicate(prompt: string, imageUrl: string | null) {
  const token = Deno.env.get("REPLICATE_API_TOKEN");
  if (!token) throw new Error("REPLICATE_API_TOKEN is not configured");

  // Prefer Google nano-banana style model if configured; fallback to generic img2img/text model env.
  const model =
    Deno.env.get("REPLICATE_NANO_BANANA_MODEL") ||
    Deno.env.get("REPLICATE_IMAGE_MODEL") ||
    "google/nano-banana";

  const input: Record<string, unknown> = { prompt };
  if (imageUrl) {
    input.image = imageUrl;
    input.image_input = [imageUrl];
  }

  const createRes = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({ input }),
  });

  let prediction = await createRes.json();
  if (!createRes.ok) {
    // Fallback to predictions endpoint with version env
    const version = Deno.env.get("REPLICATE_MODEL_VERSION");
    if (!version) {
      throw new Error(prediction?.detail || prediction?.error || "Replicate prediction failed");
    }
    const res2 = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({ version, input }),
    });
    prediction = await res2.json();
    if (!res2.ok) {
      throw new Error(prediction?.detail || prediction?.error || "Replicate prediction failed");
    }
  }

  // Poll if not finished
  let guard = 0;
  while (
    prediction?.status &&
    !["succeeded", "failed", "canceled"].includes(prediction.status) &&
    guard < 60
  ) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    prediction = await poll.json();
    guard += 1;
  }

  if (prediction.status !== "succeeded") {
    throw new Error(prediction?.error || `Generation ${prediction?.status || "failed"}`);
  }

  const out = prediction.output;
  if (typeof out === "string") return out;
  if (Array.isArray(out) && typeof out[0] === "string") return out[0];
  if (out && typeof out === "object" && typeof out.url === "string") return out.url;
  throw new Error("Replicate returned no image URL");
}

async function generateWithGoogle(prompt: string, imageUrl: string | null) {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY") || Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY / GEMINI_API_KEY is not configured");
  // Placeholder path — prefer Replicate for image models in this codebase.
  throw new Error(
    "Google image generation path is not fully configured. Set REPLICATE_API_TOKEN instead.",
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { user } = await getAuthUser(req);
    const body = await readJson<{ generation_id?: string }>(req);
    const generationId = String(body.generation_id || "").trim();
    if (!generationId) return jsonResponse({ error: "generation_id is required" }, 400);

    const service = getServiceClient();
    const { data: generation, error } = await service
      .from("generations")
      .select("*")
      .eq("id", generationId)
      .maybeSingle();
    if (error) throw error;
    if (!generation) return jsonResponse({ error: "generation not found" }, 404);

    await service
      .from("generations")
      .update({ status: "processing", error: null })
      .eq("id", generationId);

    const prompt = String(generation.prompt || "").trim();
    const sourceUrl = String(
      generation.source_image_url || generation.preview_image_url || "",
    ).trim() || null;

    if (!prompt) {
      await service
        .from("generations")
        .update({ status: "failed", error: "Missing prompt" })
        .eq("id", generationId);
      return jsonResponse({ error: "Missing prompt" }, 400);
    }

    let imageUrl: string;
    try {
      if (Deno.env.get("REPLICATE_API_TOKEN")) {
        imageUrl = await generateWithReplicate(prompt, sourceUrl);
      } else if (Deno.env.get("GOOGLE_AI_API_KEY") || Deno.env.get("GEMINI_API_KEY")) {
        imageUrl = await generateWithGoogle(prompt, sourceUrl);
      } else {
        throw new Error(
          "No AI provider configured. Set REPLICATE_API_TOKEN (preferred) or GOOGLE_AI_API_KEY.",
        );
      }
    } catch (genErr) {
      const message = genErr instanceof Error ? genErr.message : String(genErr);
      await service
        .from("generations")
        .update({ status: "failed", error: message })
        .eq("id", generationId);
      return jsonResponse({ error: message }, 502);
    }

    // Download and store in generated-images bucket
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error("Failed to download generated image");
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    const objectPath = `generations/${generationId}.jpg`;
    const { error: upErr } = await service.storage
      .from("generated-images")
      .upload(objectPath, bytes, { contentType: "image/jpeg", upsert: true });
    if (upErr) throw upErr;

    const publicUrl = `${requiredEnv("SUPABASE_URL")}/storage/v1/object/public/generated-images/${objectPath}`;

    await service
      .from("generations")
      .update({
        status: "completed",
        final_image_url: publicUrl,
        result_image_url: publicUrl,
        preview_image_url: publicUrl,
        error: null,
      })
      .eq("id", generationId);

    // Best-effort credit debit when authenticated user present
    const debitEmail = (user?.email || generation.user_email || "").toString().trim().toLowerCase();
    if (debitEmail) {
      const cost = Number(generation.credit_cost ?? generation.credits ?? 1) || 1;
      await service.from("credits_ledger").insert({
        user_convex_id: debitEmail,
        user_id: user?.id ?? generation.user_id ?? null,
        direction: "out",
        credits: cost,
        reason: "generation",
        generation_id: generationId,
      });
    }

    return jsonResponse({ imageUrl: publicUrl, generation_id: generationId, status: "completed" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
