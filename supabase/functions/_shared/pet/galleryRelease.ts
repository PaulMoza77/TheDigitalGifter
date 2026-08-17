import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { asString, decryptPublicToken } from "./crypto.ts";
import { sendPetDeliveryEmail } from "./email.ts";
import { videoGenerationEnabled, videoGenerationMock } from "./constants.ts";

function waitUntil(promise: Promise<unknown>) {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (value: Promise<unknown>) => void } }).EdgeRuntime;
  if (runtime && typeof runtime.waitUntil === "function") {
    runtime.waitUntil(promise);
    return;
  }
  void promise;
}

export function enqueuePetGenerateVideo(orderId: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  waitUntil(
    fetch(`${url.replace(/\/$/, "")}/functions/v1/pet-generate-video`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ order_id: orderId }),
    }).catch((err) => console.error("pet-generate-video enqueue failed", err)),
  );
}

export async function maybeReleaseGeneratedGallery(service: SupabaseClient, orderId: string) {
  const { data: order } = await service
    .from("pet_orders")
    .select("id, status, email, pet_name, public_token_ciphertext")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return;
  await releaseGeneratedGallery(service, order);
}

export async function releaseGeneratedGallery(
  service: SupabaseClient,
  order: {
    id: string;
    status?: string;
    email?: string;
    pet_name?: string;
    public_token_ciphertext?: string | null;
  },
) {
  const status = String(order.status || "");
  if (!["complete", "awaiting_qc", "partial_failure"].includes(status)) return;

  const token = await decryptPublicToken(asString(order.public_token_ciphertext));
  if (token && status !== "partial_failure") {
    await sendPetDeliveryEmail({
      service,
      orderId: order.id,
      petName: asString(order.pet_name) || "your pet",
      email: asString(order.email),
      publicToken: token,
      kind: "gallery_ready",
    });
  }

  await autoStartVideos(service, order.id);
}

async function autoStartVideos(service: SupabaseClient, orderId: string) {
  if (!videoGenerationEnabled() && !videoGenerationMock()) return;

  const { count } = await service
    .from("pet_order_scenes")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .in("status", ["succeeded", "ready"]);
  if ((count ?? 0) < 12) return;

  const { data: existing } = await service
    .from("pet_order_video_clips")
    .select("id, status")
    .eq("pet_order_id", orderId);
  const active = (existing ?? []).filter((clip) =>
    ["queued", "generating", "succeeded", "ready", "rate_limited"].includes(String(clip.status)),
  );
  if (active.length >= 2) {
    enqueuePetGenerateVideo(orderId);
    return;
  }

  const { data: scenes } = await service
    .from("pet_order_scenes")
    .select("id")
    .eq("order_id", orderId)
    .in("status", ["succeeded", "ready"])
    .order("scene_number", { ascending: true })
    .limit(2);
  if ((scenes ?? []).length < 2) return;

  await service.from("pet_order_video_clips").delete().eq("pet_order_id", orderId).in("status", ["queued", "failed"]);
  for (const [index, scene] of (scenes ?? []).entries()) {
    await service.from("pet_order_video_clips").insert({
      pet_order_id: orderId,
      source_scene_id: scene.id,
      slot: index + 1,
      status: "queued",
    });
  }
  enqueuePetGenerateVideo(orderId);
}
