import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import {
  assertAdmin,
  getAuthUser,
  getServiceClient,
  isServiceRoleRequest,
  readJson,
  requiredEnv,
} from "../_shared/supabase.ts";
import { assertRateLimit, clientIp } from "../_shared/rateLimit.ts";
import {
  REQUEST_UNAVAILABLE_MESSAGE,
  TEMPLATE_UNAVAILABLE_MESSAGE,
  describesExplicitContent,
  describesIntimateContact,
  isProhibitedIdentity,
  isTemplateAllowed,
} from "../_shared/contentPolicy.ts";

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

function ledgerBalance(rows: Array<{ direction?: string | null; credits?: number | string | null }> | null) {
  return (rows ?? []).reduce((sum, row) => {
    const value = Number(row.credits ?? 0);
    if (!Number.isFinite(value)) return sum;
    if (row.direction === "in") return sum + value;
    if (row.direction === "out") return sum - value;
    return sum;
  }, 0);
}

function isPaidStatus(status: string | null | undefined) {
  return ["paid", "complete", "completed", "succeeded"].includes(String(status || "").toLowerCase());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { user } = await getAuthUser(req);
    const serviceRole = isServiceRoleRequest(req);
    const body = await readJson<{ generation_id?: string; session_id?: string }>(req);
    const generationId = String(body.generation_id || "").trim();
    const sessionId = String(body.session_id || "").trim();
    if (!generationId) return jsonResponse({ error: "generation_id is required" }, 400);

    const service = getServiceClient();
    const allowed = await assertRateLimit(
      service,
      `generate:${user?.id || clientIp(req)}`,
      20,
      3600,
    );
    if (!allowed) return jsonResponse({ error: "Too many generation attempts. Please wait." }, 429);

    const { data: generation, error } = await service
      .from("generations")
      .select("*")
      .eq("id", generationId)
      .maybeSingle();
    if (error) throw error;
    if (!generation) return jsonResponse({ error: "generation not found" }, 404);

    let admin = false;
    if (user?.email) {
      try {
        await assertAdmin(user.email);
        admin = true;
      } catch {
        admin = false;
      }
    }

    const ownerId = String(generation.user_id || "").trim();
    const ownerEmail = String(generation.email || generation.user_email || "").trim().toLowerCase();
    const userEmail = String(user?.email || "").trim().toLowerCase();
    const isOwner = Boolean(
      user &&
        ((ownerId && ownerId === user.id) || (ownerEmail && userEmail && ownerEmail === userEmail)),
    );

    const linkedSession = (
      sessionId ||
      String(generation.stripe_session_id || generation.checkout_session_id || generation.metadata?.stripe_session_id || "")
    ).trim();

    let paid = String(generation.metadata?.payment_status || "").toLowerCase() === "paid";
    if (linkedSession) {
      const { data: order } = await service
        .from("orders")
        .select("id,status,user_id,email,stripe_session_id")
        .eq("stripe_session_id", linkedSession)
        .maybeSingle();
      if (order && isPaidStatus(order.status)) {
        const orderEmail = String(order.email || "").trim().toLowerCase();
        const sessionMatchesGeneration =
          String(generation.stripe_session_id || "") === linkedSession ||
          String(generation.checkout_session_id || "") === linkedSession ||
          String(generation.metadata?.stripe_session_id || "") === linkedSession;
        if (sessionMatchesGeneration || (user && (order.user_id === user.id || (orderEmail && orderEmail === userEmail)))) {
          paid = true;
        }
      }
    }

    if (!serviceRole && !admin && !isOwner && !paid) {
      return jsonResponse(
        { error: "Authentication required. Generation must belong to a signed-in owner or a verified paid order." },
        401,
      );
    }

    if (!serviceRole && !admin && isOwner && !paid) {
      const creditKey = userEmail || ownerEmail;
      const cost = Number(generation.credit_cost ?? generation.credits ?? 1) || 1;
      const { data: ledgerRows } = await service
        .from("credits_ledger")
        .select("direction, credits")
        .eq("user_convex_id", creditKey);
      const balance = ledgerBalance(
        ledgerRows as Array<{ direction?: string | null; credits?: number | string | null }>,
      );
      if (balance < cost) {
        return jsonResponse(
          { error: "Not enough credits. Purchase credits or complete checkout before generating." },
          402,
        );
      }
    }

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

    const templateId = String(generation.template_id || "").trim();
    if (templateId) {
      const { data: templateRow } = await service
        .from("templates")
        .select("id,title,style_id,slug,prompt,is_active")
        .eq("id", templateId)
        .maybeSingle();
      if (
        templateRow &&
        (templateRow.is_active === false || !isTemplateAllowed(templateRow))
      ) {
        await service
          .from("generations")
          .update({ status: "failed", error: TEMPLATE_UNAVAILABLE_MESSAGE })
          .eq("id", generationId);
        return jsonResponse({ error: TEMPLATE_UNAVAILABLE_MESSAGE }, 403);
      }
    }

    const identity = {
      id: generation.template_id,
      style_id: generation.style_id || generation.style_slug,
      slug: generation.style_slug,
      title: generation.title,
      prompt,
    };
    if (
      isProhibitedIdentity(identity) ||
      describesIntimateContact(prompt) ||
      describesExplicitContent(prompt)
    ) {
      await service
        .from("generations")
        .update({ status: "failed", error: REQUEST_UNAVAILABLE_MESSAGE })
        .eq("id", generationId);
      return jsonResponse({ error: REQUEST_UNAVAILABLE_MESSAGE }, 403);
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

    return jsonResponse({ imageUrl: publicUrl, generation_id: generationId, status: "completed" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
