import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import {
  getAuthUser,
  getServiceClient,
  readJson,
  requiredEnv,
} from "../_shared/supabase.ts";

type CreateBody = {
  action?: string;
  job_type?: string;
  product_key?: string;
  pricing_key?: string;
  credit_cost?: number;
  idempotency_key?: string;
  payload?: Record<string, unknown>;
  job_id?: string;
};

async function resolveCreditCost(
  service: ReturnType<typeof getServiceClient>,
  pricingKey: string,
): Promise<{ credits: number; enabled: boolean; code?: string }> {
  const mapped =
    pricingKey === "xmas_photo" ||
    pricingKey === "xmas_family_photo" ||
    pricingKey === "xmas_couple_photo" ||
    pricingKey === "xmas_pet_photo"
      ? "xmas_portrait"
      : pricingKey;
  const { data } = await service
    .from("pricing_items")
    .select("credits, active, is_active, metadata")
    .eq("key", mapped)
    .maybeSingle();

  if (!data) {
    return { credits: 0, enabled: false, code: "config_missing" };
  }

  const meta = (data.metadata || {}) as Record<string, unknown>;
  const enabled =
    data.active !== false &&
    data.is_active !== false &&
    meta.enabled !== false;
  const fromMeta = Number(meta.app_credits_cost ?? meta.credit_cost);
  const fromCredits = Number(data.credits);
  const credits =
    Number.isFinite(fromMeta) && fromMeta > 0
      ? Math.floor(fromMeta)
      : Number.isFinite(fromCredits) && fromCredits > 0
        ? Math.floor(fromCredits)
        : 0;
  if (credits <= 0) return { credits: 0, enabled: false, code: "invalid_credits" };
  return { credits, enabled };
}

function clientError(code: string, status = 400, extra: Record<string, unknown> = {}) {
  const messages: Record<string, string> = {
    unauthorized: "Sign in to continue.",
    invalid_payload: "Invalid request.",
    insufficient_credits: "Not enough credits",
    product_disabled: "This experience isn’t available right now",
    not_found: "We couldn't find that creation.",
    provider_failed: "Generation failed · credits restored",
    config_missing: "Christmas pricing is not configured",
    pricing_changed: "Credit cost changed. Confirm the new amount.",
  };
  return jsonResponse(
    { ok: false, error: messages[code] || messages.invalid_payload, code, ...extra },
    status,
  );
}

async function fulfillPhoto(
  service: ReturnType<typeof getServiceClient>,
  user: { id: string; email: string },
  jobId: string,
  payload: Record<string, unknown>,
  creditCost: number,
) {
  const sourceImageUrl = String(payload.source_image_url || "");
  const prompt = String(payload.prompt || "Create a beautiful Christmas portrait.");
  const title = String(payload.title || "Christmas portrait");
  const templateId = payload.template_id ? String(payload.template_id) : null;
  const styleId = payload.style_id ? String(payload.style_id) : null;

  if (!sourceImageUrl) throw new Error("source_image_required");

  const { data: created, error } = await service
    .from("generations")
    .insert({
      user_id: user.id,
      email: user.email,
      occasion_slug: "christmas",
      style_slug: styleId,
      style_id: styleId,
      template_id: templateId,
      title,
      source_image_url: sourceImageUrl,
      preview_image_url: sourceImageUrl,
      prompt,
      status: "pending",
      credit_cost: creditCost,
      credits: creditCost,
      metadata: {
        // Client metadata first · server skip flags must win to avoid double debit.
        ...(payload.metadata && typeof payload.metadata === "object"
          ? (payload.metadata as Record<string, unknown>)
          : {}),
        source: "tdg_app_christmas",
        app_christmas_job_id: jobId,
        skip_ledger_debit: true,
      },
    })
    .select("id")
    .single();

  if (error || !created?.id) throw new Error(error?.message || "generation_create_failed");

  await service
    .from("app_christmas_jobs")
    .update({
      generation_id: created.id,
      status: "processing",
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${supabaseUrl}/functions/v1/generate-nano-banana`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ generation_id: created.id }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || body?.message || "provider_failed");
  }

  const imageUrl =
    body?.imageUrl ||
    body?.image_url ||
    body?.final_image_url ||
    null;

  // Re-read generation for authoritative status/url
  const { data: gen } = await service
    .from("generations")
    .select("id,status,final_image_url,result_image_url,preview_image_url,error")
    .eq("id", created.id)
    .maybeSingle();

  const status = String(gen?.status || "").toLowerCase();
  const url =
    imageUrl ||
    gen?.final_image_url ||
    gen?.result_image_url ||
    gen?.preview_image_url ||
    null;

  if (status === "failed" || (!url && status !== "completed" && status !== "succeeded")) {
    // Still processing is OK · client polls generation / job
    if (status === "pending" || status === "processing" || status === "queued") {
      return {
        status: "processing",
        generation_id: created.id,
        result_url: url,
      };
    }
    if (status === "failed") {
      throw new Error(gen?.error || "provider_failed");
    }
  }

  if (url && (status === "completed" || status === "succeeded" || imageUrl)) {
    await service
      .from("app_christmas_jobs")
      .update({
        status: "succeeded",
        result_url: url,
        result: { generation_id: created.id },
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    return { status: "succeeded", generation_id: created.id, result_url: url };
  }

  return { status: "processing", generation_id: created.id, result_url: url };
}

async function fulfillMessage(
  service: ReturnType<typeof getServiceClient>,
  jobId: string,
  payload: Record<string, unknown>,
  authHeader: string | null,
) {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const anon = requiredEnv("SUPABASE_ANON_KEY");
  const guestToken =
    String(payload.guest_token || "").trim() || crypto.randomUUID();
  const res = await fetch(
    `${supabaseUrl}/functions/v1/christmas-cards-messages-funnel`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: authHeader || `Bearer ${anon}`,
      },
      body: JSON.stringify({
        action: "runMessageGenerator",
        guest_token: guestToken,
        locale: payload.locale || "en",
        recipient_key: payload.recipient_key,
        tone_key: payload.tone_key,
        length_key: payload.length_key,
        custom_detail: payload.custom_detail,
        force_new: payload.force_new !== false,
        session_id: payload.force_new ? undefined : payload.session_id,
      }),
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || "provider_failed");

  const messages = body?.messages || [];
  const text = messages[0]?.text || null;
  await service
    .from("app_christmas_jobs")
    .update({
      status: "succeeded",
      result: body,
      result_text: text,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  return { status: "succeeded", result: body, result_text: text };
}

async function fulfillGiftFinder(
  service: ReturnType<typeof getServiceClient>,
  jobId: string,
  payload: Record<string, unknown>,
  authHeader: string | null,
) {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const anon = requiredEnv("SUPABASE_ANON_KEY");
  const guestToken =
    String(payload.guest_token || "").trim() || crypto.randomUUID();
  const res = await fetch(
    `${supabaseUrl}/functions/v1/christmas-wishlist-funnel`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: authHeader || `Bearer ${anon}`,
      },
      body: JSON.stringify({
        action: "runGiftFinder",
        guest_token: guestToken,
        locale: payload.locale || "en",
        recipient_key: payload.recipient_key,
        age_range_key: payload.age_range_key,
        interest_keys: payload.interest_keys,
        personality_keys: payload.personality_keys,
        budget_key: payload.budget_key,
        personal_detail: payload.personal_detail,
        gift_type_key: "either",
        force_new: payload.force_new !== false,
        session_id: payload.force_new ? undefined : payload.session_id,
      }),
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || "provider_failed");

  await service
    .from("app_christmas_jobs")
    .update({
      status: "succeeded",
      result: body,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  return { status: "succeeded", result: body };
}

async function fulfillCard(
  service: ReturnType<typeof getServiceClient>,
  jobId: string,
  payload: Record<string, unknown>,
  authHeader: string | null,
) {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const anon = requiredEnv("SUPABASE_ANON_KEY");
  const guestToken =
    String(payload.guest_token || "").trim() || crypto.randomUUID();
  const res = await fetch(
    `${supabaseUrl}/functions/v1/christmas-cards-messages-funnel`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: authHeader || `Bearer ${anon}`,
      },
      body: JSON.stringify({
        action: "createCardProject",
        style_key: payload.style_key,
        layout_key: payload.layout_key,
        message: payload.message,
        recipient_name: payload.recipient_name || "",
        from_name: payload.from_name || "",
        message_source: payload.message_source || "manual",
        message_result_id: payload.message_result_id,
        guest_token: guestToken,
        photo_url: payload.photo_url,
      }),
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || "provider_failed");

  await service
    .from("app_christmas_jobs")
    .update({
      status: "succeeded",
      result: body,
      result_url: payload.photo_url ? String(payload.photo_url) : null,
      result_text: payload.message ? String(payload.message) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  return { status: "succeeded", result: body };
}

async function fulfillSanta(
  service: ReturnType<typeof getServiceClient>,
  user: { id: string; email: string },
  jobId: string,
  payload: Record<string, unknown>,
) {
  // Persist santa request on the job; optional insert into christmas_santa_video_jobs if schema allows.
  const santaPayload = {
    child_first_name: payload.child_first_name,
    language: payload.language || "en",
    template_key: payload.template_key || "classic_santa",
    age: payload.age ?? null,
    hobby: payload.hobby ?? null,
    good_deed: payload.good_deed ?? null,
    christmas_wish: payload.christmas_wish ?? null,
    guardian_consent: !!payload.guardian_consent,
    photo_url: payload.photo_url ?? null,
    user_id: user.id,
    user_email: user.email,
    app_christmas_job_id: jobId,
    platform: "ios",
    payment: "credits",
  };

  // Require a provider job id so status polling can reconcile or refund.
  // If enqueue fails, throw · caller refunds credits atomically.
  const { data, error } = await service
    .from("christmas_santa_video_jobs")
    .insert({
      user_id: user.id,
      status: "queued",
      locale: santaPayload.language,
      template_key: santaPayload.template_key,
      child_first_name: santaPayload.child_first_name,
      metadata: santaPayload,
    })
    .select("id,status")
    .maybeSingle();

  if (error || !data?.id) {
    throw new Error(error?.message || "santa_enqueue_failed");
  }

  await service
    .from("app_christmas_jobs")
    .update({
      status: "processing",
      result: { santa_job_id: data.id, ...santaPayload },
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  return {
    status: "processing",
    result: { santa_job_id: data.id },
  };
}

async function refundJob(
  service: ReturnType<typeof getServiceClient>,
  jobId: string,
  userId: string,
  reason: string,
) {
  const { data } = await service.rpc("refund_christmas_job_credits", {
    p_job_id: jobId,
    p_user_id: userId,
    p_reason: reason,
  });
  return data as { status?: string; credits_restored?: boolean } | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { user, authHeader } = await getAuthUser(req);
    if (!user?.id || !user.email) return clientError("unauthorized", 401);

    const body = await readJson<CreateBody>(req);
    const action = String(body.action || "create");
    const service = getServiceClient();
    const email = String(user.email).trim().toLowerCase();

    if (action === "status") {
      const jobId = String(body.job_id || "").trim();
      if (!jobId) return clientError("invalid_payload");
      const { data: job, error } = await service
        .from("app_christmas_jobs")
        .select("*")
        .eq("id", jobId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error || !job) return clientError("not_found", 404);

      // If linked generation finished, mirror success.
      if (job.generation_id && job.status === "processing") {
        const { data: gen } = await service
          .from("generations")
          .select("status,final_image_url,result_image_url,preview_image_url,error")
          .eq("id", job.generation_id)
          .maybeSingle();
        const gStatus = String(gen?.status || "").toLowerCase();
        const url =
          gen?.final_image_url || gen?.result_image_url || gen?.preview_image_url || null;
        if (gStatus === "completed" || gStatus === "succeeded") {
          await service
            .from("app_christmas_jobs")
            .update({
              status: "succeeded",
              result_url: url,
              updated_at: new Date().toISOString(),
            })
            .eq("id", jobId);
          return jsonResponse({
            ok: true,
            status: "succeeded",
            job_id: jobId,
            generation_id: job.generation_id,
            result_url: url,
          });
        }
        if (gStatus === "failed") {
          const refund = await refundJob(service, jobId, user.id, gen?.error || "provider_failed");
          return jsonResponse({
            ok: true,
            status: "refunded",
            job_id: jobId,
            error: "Generation failed · credits restored",
            code: "refunded",
            credits_restored: !!refund?.credits_restored,
          });
        }
      }

      // Santa video provider reconciliation (when santa job id is stored on result).
      if (
        job.job_type === "santa_video" &&
        (job.status === "processing" || job.status === "queued")
      ) {
        const resultObj =
          job.result && typeof job.result === "object"
            ? (job.result as Record<string, unknown>)
            : {};
        const santaJobId = String(
          resultObj.santa_job_id || resultObj.santaJobId || "",
        ).trim();
        if (!santaJobId) {
          const refund = await refundJob(
            service,
            jobId,
            user.id,
            "santa_missing_provider_id",
          );
          return jsonResponse({
            ok: true,
            status: "refunded",
            job_id: jobId,
            error: "Generation failed · credits restored",
            code: "refunded",
            credits_restored: !!refund?.credits_restored,
          });
        }
        if (santaJobId) {
          const { data: santa } = await service
            .from("christmas_santa_video_jobs")
            .select("id,status,result_url,video_url,error,error_message")
            .eq("id", santaJobId)
            .maybeSingle();
          const sStatus = String(santa?.status || "").toLowerCase();
          const videoUrl =
            (santa as { result_url?: string; video_url?: string } | null)
              ?.result_url ||
            (santa as { video_url?: string } | null)?.video_url ||
            null;
          if (
            videoUrl &&
            (sStatus === "succeeded" ||
              sStatus === "completed" ||
              sStatus === "ready" ||
              sStatus === "done")
          ) {
            await service
              .from("app_christmas_jobs")
              .update({
                status: "succeeded",
                result_url: videoUrl,
                updated_at: new Date().toISOString(),
              })
              .eq("id", jobId);
            return jsonResponse({
              ok: true,
              status: "succeeded",
              job_id: jobId,
              result_url: videoUrl,
            });
          }
          if (
            sStatus === "failed" ||
            sStatus === "error" ||
            sStatus === "cancelled" ||
            sStatus === "canceled"
          ) {
            const reason =
              (santa as { error?: string; error_message?: string } | null)
                ?.error ||
              (santa as { error_message?: string } | null)?.error_message ||
              "santa_provider_failed";
            const refund = await refundJob(service, jobId, user.id, reason);
            return jsonResponse({
              ok: true,
              status: "refunded",
              job_id: jobId,
              error: "Generation failed · credits restored",
              code: "refunded",
              credits_restored: !!refund?.credits_restored,
            });
          }
        }
      }

      return jsonResponse({
        ok: true,
        status: job.status,
        job_id: job.id,
        generation_id: job.generation_id,
        result_url: job.result_url,
        result_text: job.result_text,
        result: job.result,
        error: job.error_message,
        credits_charged: job.credits_spent ? job.credit_cost : 0,
      });
    }

    if (action !== "create") return clientError("invalid_payload");

    const jobType = String(body.job_type || "").trim();
    const productKey = String(body.product_key || "").trim();
    const pricingKey = String(body.pricing_key || "").trim();
    const idempotencyKey = String(body.idempotency_key || "").trim();
    const payload = (body.payload || {}) as Record<string, unknown>;

    if (!jobType || !productKey || !pricingKey || !idempotencyKey) {
      return clientError("invalid_payload");
    }

    const priced = await resolveCreditCost(service, pricingKey);
    if (priced.code === "config_missing") return clientError("config_missing", 503);
    if (!priced.enabled) return clientError("product_disabled", 403);

    const displayed =
      body.credit_cost == null || body.credit_cost === ("" as unknown)
        ? priced.credits
        : Number(body.credit_cost);
    if (displayed !== priced.credits) {
      return jsonResponse(
        {
          ok: false,
          code: "pricing_changed",
          error: "Credit cost changed. Confirm the new amount.",
          server_credit_cost: priced.credits,
          displayed_credit_cost: displayed,
        },
        409,
      );
    }

    const { data: spend, error: spendError } = await service.rpc(
      "spend_credits_idempotent",
      {
        p_user_id: user.id,
        p_user_email: email,
        p_idempotency_key: idempotencyKey,
        p_job_type: jobType,
        p_product_key: productKey,
        p_pricing_key: pricingKey,
        p_credit_cost: priced.credits,
        p_payload: payload,
      },
    );

    if (spendError) {
      console.warn("[app-christmas-job] spend failed", spendError.message);
      return clientError("invalid_payload", 500);
    }

    const spendRow = spend as Record<string, unknown>;
    if (spendRow?.code === "insufficient_credits") {
      return clientError("insufficient_credits", 402, {
        balance: spendRow.balance,
        credits_required: spendRow.credits_required,
      });
    }

    const jobId = String(spendRow.job_id || "");
    if (!jobId) return clientError("invalid_payload", 500);

    // Idempotent replay · do not re-run provider if already terminal/succeeded.
    if (spendRow.already_processed) {
      return jsonResponse({
        ok: true,
        already_processed: true,
        status: spendRow.status,
        job_id: jobId,
        generation_id: spendRow.generation_id,
        result_url: spendRow.result_url,
        result_text: spendRow.result_text,
        result: spendRow.result,
        credits_charged: spendRow.credits_charged,
        balance: spendRow.balance,
      });
    }

    try {
      let fulfilled: Record<string, unknown> = { status: "processing" };
      if (jobType === "photo") {
        fulfilled = await fulfillPhoto(
          service,
          { id: user.id, email },
          jobId,
          payload,
          priced.credits,
        );
      } else if (jobType === "message") {
        fulfilled = await fulfillMessage(service, jobId, payload, authHeader);
      } else if (jobType === "gift_finder") {
        fulfilled = await fulfillGiftFinder(service, jobId, payload, authHeader);
      } else if (jobType === "card") {
        fulfilled = await fulfillCard(service, jobId, payload, authHeader);
      } else if (jobType === "santa_video") {
        fulfilled = await fulfillSanta(
          service,
          { id: user.id, email },
          jobId,
          payload,
        );
      } else {
        throw new Error("unknown_job_type");
      }

      return jsonResponse({
        ok: true,
        already_processed: false,
        job_id: jobId,
        credits_charged: priced.credits,
        balance: spendRow.balance,
        ...fulfilled,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "provider_failed";
      const refund = await refundJob(service, jobId, user.id, reason);
      return jsonResponse(
        {
          ok: false,
          status: "refunded",
          job_id: jobId,
          error: "Generation failed · credits restored",
          code: "refunded",
          credits_restored: !!refund?.credits_restored,
        },
        500,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "error";
    console.warn("[app-christmas-job] unexpected", message);
    return clientError("invalid_payload", 500);
  }
});
