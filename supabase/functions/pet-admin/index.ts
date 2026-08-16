import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { assertAdmin, getAuthUser, getServiceClient, readJson } from "../_shared/supabase.ts";
import {
  PET_RESULT_BUCKET,
  PET_SIGNED_DOWNLOAD_SECONDS,
  PET_SOURCE_BUCKET,
} from "../_shared/pet/constants.ts";
import { asString, decryptPublicToken, sha256Hex } from "../_shared/pet/crypto.ts";
import { canReleaseDelivery, canStartGeneration, retryTargets } from "../_shared/pet/guards.ts";
import { sendPetDeliveryEmail } from "../_shared/pet/email.ts";

type Body = Record<string, unknown>;

function apiError(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

async function invokeGenerate(orderId: string, sceneKeys?: string[]) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing Supabase service credentials");
  const res = await fetch(`${url.replace(/\/$/, "")}/functions/v1/pet-generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ order_id: orderId, scene_keys: sceneKeys }),
  });
  return res.json();
}

async function signed(service: ReturnType<typeof getServiceClient>, bucket: string, path: string | null) {
  if (!path) return null;
  const { data } = await service.storage.from(bucket).createSignedUrl(path, PET_SIGNED_DOWNLOAD_SECONDS);
  return data?.signedUrl ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { user } = await getAuthUser(req);
    await assertAdmin(user?.email);
    const body = await readJson<Body>(req);
    const action = asString(body.action) || "list";
    const service = getServiceClient();

    if (action === "list") {
      const q = asString(body.q).toLowerCase().replace(/[,()%]/g, "").slice(0, 80);
      const status = asString(body.status);
      const page = Math.max(1, Number(body.page || 1));
      const pageSize = Math.min(50, Math.max(10, Number(body.pageSize || 20)));
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let query = service
        .from("pet_orders")
        .select(
          "id, email, pet_name, species, personality, status, amount_cents, currency, sku, stripe_checkout_session_id, paid_at, created_at, qc_status, last_error, model_name, model_version",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(from, to);
      if (status) query = query.eq("status", status);
      if (q) {
        query = query.or(
          `email.ilike.%${q}%,pet_name.ilike.%${q}%,stripe_checkout_session_id.ilike.%${q}%,status.eq.${q}`,
        );
      }
      const { data, error, count } = await query;
      if (error) throw error;
      return jsonResponse({ items: data ?? [], total: count ?? 0, page, pageSize });
    }

    const orderId = asString(body.orderId || body.order_id);
    if (!orderId) return apiError("orderId is required");

    const { data: order, error } = await service.from("pet_orders").select("*").eq("id", orderId).maybeSingle();
    if (error) throw error;
    if (!order) return apiError("Order not found", 404);

    if (action === "get") {
      const [{ data: scenes }, { data: events }, { data: job }] = await Promise.all([
        service.from("pet_order_scenes").select("*").eq("order_id", orderId).order("scene_number"),
        service.from("pet_order_events").select("*").eq("order_id", orderId).order("created_at", { ascending: false }).limit(100),
        service.from("pet_generation_jobs").select("*").eq("order_id", orderId).maybeSingle(),
      ]);
      const sourcePreviewUrl = await signed(service, PET_SOURCE_BUCKET, order.photo_path);
      const sceneViews = [];
      for (const scene of scenes ?? []) {
        sceneViews.push({
          ...scene,
          previewUrl: await signed(service, PET_RESULT_BUCKET, scene.result_path),
        });
      }
      return jsonResponse({
        order,
        job,
        scenes: sceneViews,
        events: events ?? [],
        sourcePreviewUrl,
      });
    }

    if (action === "retryFailed" || action === "retryScene" || action === "regenerateScene") {
      const paid = canStartGeneration({ paidAt: order.paid_at, status: order.status });
      if (!paid.ok) return jsonResponse({ error: paid.message, code: paid.code }, 402);
      const { data: scenes } = await service.from("pet_order_scenes").select("*").eq("order_id", orderId);
      const selected = asString(body.sceneKey);
      const targets =
        action === "retryFailed"
          ? retryTargets(scenes ?? [], undefined)
          : retryTargets(
              (scenes ?? []).map((scene) =>
                action === "regenerateScene" && scene.scene_key === selected
                  ? { ...scene, status: "failed" }
                  : scene,
              ),
              selected,
            );
      if (action === "regenerateScene" && selected) {
        await service
          .from("pet_order_scenes")
          .update({ status: "queued", last_error: null, replicate_prediction_id: null, result_path: null, progress_percent: 0 })
          .eq("order_id", orderId)
          .eq("scene_key", selected);
      } else {
        await service
          .from("pet_order_scenes")
          .update({ status: "queued", last_error: null, replicate_prediction_id: null, progress_percent: 0 })
          .eq("order_id", orderId)
          .in("scene_key", targets.map((scene) => scene.scene_key).filter(Boolean));
      }
      await service.from("pet_generation_jobs").update({ status: "queued", last_error: null }).eq("order_id", orderId);
      await service.rpc("pet_log_event", {
        p_order_id: orderId,
        p_action: action,
        p_actor_type: "admin",
        p_actor_email: user?.email || null,
        p_scene_key: selected || null,
      });
      const result = await invokeGenerate(
        orderId,
        action === "retryFailed" ? undefined : selected ? [selected] : undefined,
      );
      return jsonResponse({ ok: true, result });
    }

    if (action === "qcReject") {
      await service
        .from("pet_orders")
        .update({
          qc_status: "rejected",
          qc_notes: asString(body.notes).slice(0, 2000),
          qc_actor_email: user?.email || null,
          qc_at: new Date().toISOString(),
          status: order.status === "complete" ? "awaiting_qc" : order.status,
        })
        .eq("id", orderId);
      await service.rpc("pet_log_event", {
        p_order_id: orderId,
        p_action: "qc_rejected",
        p_actor_type: "admin",
        p_actor_email: user?.email || null,
        p_payload: { notes_present: Boolean(asString(body.notes)) },
      });
      return jsonResponse({ ok: true });
    }

    if (action === "qcApprove" || action === "markComplete") {
      const { data: sceneRows } = await service
        .from("pet_order_scenes")
        .select("status")
        .eq("order_id", orderId);
      const releaseCheck = canReleaseDelivery({
        paidAt: order.paid_at,
        orderStatus: String(order.status),
        scenes: sceneRows ?? [],
      });
      if (!releaseCheck.ok) return apiError(releaseCheck.message);
      const released = await service.rpc("pet_release_delivery", {
        p_order_id: orderId,
        p_actor_email: user?.email || null,
        p_notes: asString(body.notes) || null,
      });
      if (released.error) throw released.error;
      const providedToken = asString(body.publicToken);
      let emailToken = providedToken;
      if (providedToken) {
        const hash = await sha256Hex(providedToken);
        if (hash !== order.public_token_hash) return apiError("publicToken does not match this order");
      } else {
        emailToken = (await decryptPublicToken(asString(order.public_token_ciphertext))) || "";
      }
      let emailSent = false;
      if (emailToken) {
        const sent = await sendPetDeliveryEmail({
          service,
          orderId,
          petName: order.pet_name,
          email: order.email,
          publicToken: emailToken,
          kind: "gallery_ready",
        });
        emailSent = Boolean(sent.sent);
      } else {
        await service.rpc("pet_log_event", {
          p_order_id: orderId,
          p_action: "delivery_email_needs_existing_link",
          p_actor_type: "admin",
          p_actor_email: user?.email || null,
        });
      }
      return jsonResponse({ ok: true, result: released.data, emailSent });
    }

    if (action === "resendEmail") {
      let publicToken = asString(body.publicToken);
      if (publicToken) {
        const hash = await sha256Hex(publicToken);
        if (hash !== order.public_token_hash) return apiError("publicToken does not match this order");
      } else {
        publicToken = (await decryptPublicToken(asString(order.public_token_ciphertext))) || "";
      }
      if (!publicToken) return apiError("Secure order token could not be recovered for email");
      if (order.status !== "complete") return apiError("QC approval is required before delivery email");
      const sent = await sendPetDeliveryEmail({
        service,
        orderId,
        petName: order.pet_name,
        email: order.email,
        publicToken,
        kind: "gallery_ready",
      });
      await service.rpc("pet_log_event", {
        p_order_id: orderId,
        p_action: "delivery_email_resent",
        p_actor_type: "admin",
        p_actor_email: user?.email || null,
      });
      return jsonResponse({ ok: true, sent });
    }

    return apiError("Unknown admin action");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.toLowerCase().includes("forbidden") || message.toLowerCase().includes("admin") ? 403 : 500;
    return jsonResponse({ error: message }, status);
  }
});
