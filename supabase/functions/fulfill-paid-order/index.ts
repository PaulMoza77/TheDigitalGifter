import { jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, readJson } from "../_shared/supabase.ts";
import { requireFulfillmentSecret } from "../_shared/stripe.ts";
import { mvpProduct } from "../_shared/mvpProduct.ts";
import { signAccessToken } from "../_shared/guestToken.ts";
import { accessTokenSecret } from "../_shared/access.ts";
import { RESULT_BUCKET, resultObjectPath, UPLOAD_BUCKET } from "../_shared/uploadPath.ts";

type Body = {
  order_id?: string;
  orderId?: string;
  generation_id?: string;
  generationId?: string;
  job_id?: string;
};

async function signedDownloadUrl(
  service: ReturnType<typeof getServiceClient>,
  bucket: string,
  path: string,
) {
  const { data, error } = await service.storage
    .from(bucket)
    .createSignedUrl(path, mvpProduct.signedUrlTtlSeconds);
  if (error || !data?.signedUrl) throw new Error(error?.message || "Could not sign upload");
  return data.signedUrl;
}

async function sendResultEmail(args: {
  email: string;
  orderId: string;
  accessToken: string;
}) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.warn("[fulfill-paid-order] RESEND_API_KEY missing; skipping email");
    return { skipped: true as const };
  }

  const from = Deno.env.get("RESULT_EMAIL_FROM") || "TheDigitalGifter <support@thedigitalgifter.com>";
  const siteUrl = Deno.env.get("SITE_URL") || "https://www.thedigitalgifter.com";
  const resultHref = `${siteUrl}/funnel/result?order_id=${encodeURIComponent(args.orderId)}&access_token=${encodeURIComponent(args.accessToken)}`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [args.email],
      subject: "Your TheDigitalGifter image is ready",
      html: `<p>Your personalized still image is ready.</p>
<p><a href="${resultHref}">Open your result</a></p>
<p>This image is AI-generated. Personal use only. Results are kept for 30 days.</p>`,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn("[fulfill-paid-order] email failed:", text);
    return { skipped: false as const, error: text };
  }
  return { skipped: false as const };
}

async function generateWithReplicate(prompt: string, imageUrl: string | null) {
  const token = Deno.env.get("REPLICATE_API_TOKEN");
  if (!token) throw new Error("REPLICATE_API_TOKEN is not configured");

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
  if (typeof out === "string") return { url: out, predictionId: String(prediction.id || "") };
  if (Array.isArray(out) && typeof out[0] === "string") {
    return { url: out[0], predictionId: String(prediction.id || "") };
  }
  throw new Error("Replicate returned no image URL");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  if (!requireFulfillmentSecret(req)) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  try {
    const body = await readJson<Body>(req);
    const orderId = String(body.order_id || body.orderId || "").trim();
    const generationId = String(body.generation_id || body.generationId || "").trim();
    if (!orderId || !generationId) {
      return jsonResponse({ error: "order_id and generation_id are required", ok: false }, 400);
    }

    const service = getServiceClient();
    const { data: claimed, error: claimErr } = await service.rpc("claim_mvp_generation_start", {
      p_generation_id: generationId,
      p_max_attempts: mvpProduct.maxGenerationAttempts,
    });
    if (claimErr) throw claimErr;

    if (!claimed?.run_generation) {
      const kind = String(claimed?.kind || "blocked");
      const ok = kind === "already_complete";
      return jsonResponse({
        ok,
        status: "skipped",
        kind,
        generation_id: generationId,
      }, ok ? 200 : 409);
    }

    const { data: generation, error: genErr } = await service
      .from("generations")
      .select("*")
      .eq("id", generationId)
      .maybeSingle();
    if (genErr) throw genErr;
    if (!generation) return jsonResponse({ error: "generation not found", ok: false }, 404);

    const { data: order, error: orderErr } = await service
      .from("mvp_orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    if (orderErr) throw orderErr;
    if (!order) return jsonResponse({ error: "order not found", ok: false }, 404);

    const photoBucket = String(order.photo_bucket || UPLOAD_BUCKET);
    const photoPath = String(order.photo_path || "");
    let sourceUrl: string | null = null;
    if (photoPath) {
      sourceUrl = await signedDownloadUrl(service, photoBucket, photoPath);
    }

    const prompt = String(
      order.template_prompt ||
        generation.prompt ||
        "Create a personalized still image from the uploaded photo.",
    ).trim();

    let imageUrl: string;
    let predictionId = "";
    try {
      const generated = await generateWithReplicate(prompt, sourceUrl);
      imageUrl = generated.url;
      predictionId = generated.predictionId;
    } catch (genError) {
      const message = genError instanceof Error ? genError.message : String(genError);
      await service
        .from("generations")
        .update({ status: "failed", error: message, updated_at: new Date().toISOString() })
        .eq("id", generationId);
      // Order stays paid/fulfilling. The job queue retries until dead.
      return jsonResponse({ error: message, recoverable: true, ok: false }, 502);
    }

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error("Failed to download generated image");
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    const objectPath = resultObjectPath(orderId, generationId);
    const { error: upErr } = await service.storage
      .from(RESULT_BUCKET)
      .upload(objectPath, bytes, { contentType: "image/jpeg", upsert: true });
    if (upErr) throw upErr;

    const signed = await signedDownloadUrl(service, RESULT_BUCKET, objectPath);

    await service
      .from("generations")
      .update({
        status: "completed",
        result_bucket: RESULT_BUCKET,
        result_path: objectPath,
        result_image_url: signed,
        final_image_url: signed,
        preview_image_url: signed,
        replicate_prediction_id: predictionId || null,
        completed_at: new Date().toISOString(),
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", generationId);

    await service
      .from("mvp_orders")
      .update({
        status: "completed",
        fulfilled_at: new Date().toISOString(),
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    const orderAccessToken = await signAccessToken(
      {
        typ: "order",
        id: orderId,
        exp: Math.floor(Date.now() / 1000) + mvpProduct.resultRetentionDays * 24 * 3600,
      },
      accessTokenSecret(),
    );

    const emailResult = await sendResultEmail({
      email: String(order.email),
      orderId,
      accessToken: orderAccessToken,
    });
    if (!emailResult.skipped) {
      await service
        .from("mvp_orders")
        .update({ result_emailed_at: new Date().toISOString() })
        .eq("id", orderId);
    }

    return jsonResponse({
      ok: true,
      status: "completed",
      order_id: orderId,
      generation_id: generationId,
      email_skipped: Boolean(emailResult.skipped),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message, ok: false }, 500);
  }
});
