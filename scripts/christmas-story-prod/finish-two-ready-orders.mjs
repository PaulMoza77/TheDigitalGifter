#!/usr/bin/env node
/** Finish markSent + Resend for two orders with media ready (service role). */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadContaboEnv, requireSupabaseEnv } from "./loadEnv.mjs";

const ORDER_IDS = process.argv.slice(2);
if (ORDER_IDS.length < 2) {
  console.error("usage: finish-two-ready-orders.mjs <orderId1> <orderId2>");
  process.exit(2);
}

const root = resolve(process.cwd());
const SITE = (process.env.SITE_URL || "https://www.thedigitalgifter.com").replace(/\/$/, "");
const EMAIL = "thedigitalgifter@gmail.com";

loadContaboEnv();
const { url, key } = requireSupabaseEnv();
const service = createClient(url, key, { auth: { persistSession: false } });

function sha256(v) {
  return createHash("sha256").update(v, "utf8").digest("hex");
}

const results = [];

for (const orderId of ORDER_IDS.slice(0, 2)) {
  const { data: order } = await service.from("christmas_story_orders").select("*").eq("id", orderId).single();
  if (!order) throw new Error(`order_missing:${orderId}`);

  const recipientToken = randomBytes(32).toString("hex");
  await service
    .from("christmas_story_access_grants")
    .update({ token_hash: sha256(recipientToken), enabled: false, revoked_at: null })
    .eq("order_id", orderId)
    .eq("grant_kind", "recipient");

  const { data: buyerGrant } = await service
    .from("christmas_story_access_grants")
    .select("token_hash")
    .eq("order_id", orderId)
    .eq("grant_kind", "buyer")
    .maybeSingle();

  let buyerToken = process.env.STORY_BUYER_TOKEN_OVERRIDE || "";
  if (!buyerToken) {
    buyerToken = randomBytes(32).toString("hex");
    await service
      .from("christmas_story_orders")
      .update({ buyer_access_token_hash: sha256(buyerToken) })
      .eq("id", orderId);
    void buyerGrant;
  }

  for (const to of ["APPROVED", "READY_TO_SEND"]) {
    await service.rpc("christmas_story_transition_order", {
      p_order_id: orderId,
      p_to: to,
      p_actor: "contabo_finish",
      p_metadata: {},
    });
  }

  const markRes = await fetch(`${url.replace(/\/$/, "")}/functions/v1/christmas-story`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      apikey: key,
    },
    body: JSON.stringify({
      action: "markSent",
      order_id: orderId,
      buyer_access_token: buyerToken,
      recipient_token: recipientToken,
      delivery_email: EMAIL,
    }),
  });
  const markBody = await markRes.json();

  const recipientRes = await fetch(`${url.replace(/\/$/, "")}/functions/v1/christmas-story`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      apikey: key,
    },
    body: JSON.stringify({ action: "getRecipientGift", recipient_token: recipientToken }),
  });
  const recipientPayload = await recipientRes.json();

  const { data: jobs } = await service
    .from("christmas_story_jobs")
    .select("job_type,status,metadata")
    .eq("order_id", orderId);

  const filmJob = (jobs || []).find((j) => j.job_type === "film");
  const renderMs = filmJob?.metadata?.renderMs ?? null;

  results.push({
    order_id: orderId,
    recipient_gift_url: `${SITE}/gift/${recipientToken}`,
    recipient_api_ok: recipientPayload?.ok === true,
    delivery_email: markBody?.deliveryEmail ?? null,
    jobs_ready: {
      song: (jobs || []).some((j) => j.job_type === "song" && j.status === "ready"),
      film: (jobs || []).some((j) => j.job_type === "film" && j.status === "ready"),
    },
    cost_breakdown_usd: {
      stripe_charge: 0,
      ai_generation: 0,
      image_generation: 0,
      video_ffmpeg_compute_estimate: renderMs ? Number(((renderMs / 1000) * 0.00002).toFixed(5)) : 0,
      music_licensed_cc0: 0,
      storage_estimate: 0,
      retry: 0,
      render_ms: renderMs,
    },
  });
}

const out = join(root, "artifacts/christmas-story-prod/finish-report.json");
writeFileSync(out, JSON.stringify({ generated_at: new Date().toISOString(), results }, null, 2));
console.log(JSON.stringify({ ok: true, out, results }, null, 2));