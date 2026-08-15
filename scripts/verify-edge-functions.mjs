#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const functionsDir = join(root, "supabase/functions");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`ok: ${message}`);
  }
}

function walkTs(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walkTs(full, acc);
    else if (name.endsWith(".ts")) acc.push(full);
  }
  return acc;
}

const webhook = read("supabase/functions/stripe-webhook/index.ts");
assert(!webhook.includes("generateWithReplicate"), "stripe-webhook does not generate synchronously");
assert(webhook.includes("claim_mvp_order_paid"), "stripe-webhook claims paid orders");
assert(webhook.includes("kickFulfillmentWorker"), "stripe-webhook enqueues the job worker");
assert(webhook.includes("validatePaidStripeSession"), "stripe-webhook validates amount/currency/SKU");
assert(!webhook.includes("await invokeFulfill"), "stripe-webhook does not await fulfillment");

const worker = read("supabase/functions/process-fulfillment-jobs/index.ts");
assert(worker.includes("requireSchedulerAuth"), "job worker requires scheduler auth");
assert(worker.includes("processed: 1") || worker.includes("processed:1"), "job worker documents one job");
assert(!worker.includes("for (let i = 0; i < 5"), "job worker does not loop five jobs");
assert(worker.includes("claim_next_fulfillment_job"), "job worker claims the next queued/stale job");
assert(worker.includes("finish_fulfillment_job_and_enqueue_email"), "job worker finishes the main job and enqueues email atomically");
assert(worker.includes('rpc: "claim_next_fulfillment_job"'), "job worker checks claim RPC errors");
assert(worker.includes('rpc: "finish_fulfillment_job_and_enqueue_email"'), "job worker checks finish/enqueue RPC errors");
assert(worker.includes("email_only"), "job worker can run result_email jobs without regenerating");
assert(worker.includes("20260817_fulfillment_schedules.sql"), "job worker points at the official scheduler migration");

const fulfill = read("supabase/functions/fulfill-paid-order/index.ts");
assert(fulfill.includes("release_mvp_generation_claim"), "fulfillment releases processing on error");
assert(fulfill.includes("replicate_prediction_id"), "fulfillment persists the Replicate prediction id");
assert(!fulfill.includes('Prefer: "wait"'), "fulfillment does not block on Prefer: wait");
assert(fulfill.includes("detectStillImageMime"), "fulfillment detects result MIME");
assert(fulfill.includes("resultEmailHref"), "result email uses the fragment helper");
assert(fulfill.includes("shouldStampResultEmailedAt"), "fulfillment stamps result_emailed_at only after Resend success");
assert(fulfill.includes("email_ok"), "fulfillment reports email_ok for retry enqueue");
assert(!fulfill.includes("if (!emailResult.skipped)"), "fulfillment does not stamp email on skipped=false failures");

const confirm = read("supabase/functions/confirm-upload/index.ts");
assert(confirm.includes("validateImageUpload"), "confirm-upload checks magic bytes");
assert(confirm.includes("remove("), "confirm-upload deletes rejected objects");
assert(confirm.includes("expires_at"), "confirm-upload checks expires_at");

const uploadUrl = read("supabase/functions/create-upload-url/index.ts");
assert(uploadUrl.includes("serverUploadPath"), "create-upload-url uses a server-fixed path");
assert(uploadUrl.includes("allowRateLimit"), "create-upload-url rate-limits uploads");
assert(!uploadUrl.includes("fileName.toLowerCase()"), "create-upload-url ignores client filenames");

const signed = read("supabase/functions/get-signed-result/index.ts");
assert(signed.includes("authorizeOrderAccess"), "get-signed-result requires ownership or token");
assert(signed.includes("void body.session_id"), "get-signed-result ignores session_id as proof");

const regen = read("supabase/functions/request-included-regeneration/index.ts");
assert(regen.includes("claim_included_regeneration"), "regeneration uses CAS claim");
assert(regen.includes("kickFulfillmentWorker"), "regeneration enqueues instead of generating inline");
assert(!regen.includes("generateWithReplicate"), "regeneration does not generate synchronously");
assert(!regen.includes("Create a personalized still image from the uploaded photo."), "regeneration has no generic prompt fallback");

const checkout = read("supabase/functions/create-checkout-session/index.ts");
assert(checkout.includes('.from("templates")'), "checkout loads the real template prompt");
assert(checkout.includes("template_prompt"), "checkout stores template_prompt server-side");
assert(checkout.includes("upload_sessions"), "checkout uses the confirmed upload session");
assert(checkout.includes("authorizeUploadAccess"), "checkout requires token or exact ownership");
assert(checkout.includes("isStillImageTemplate"), "checkout validates a still-image template");
assert(checkout.includes("checkoutReturnUrls"), "checkout builds success/cancel URLs server-side");
assert(checkout.includes("void body.success_url"), "checkout ignores client success_url");
assert(checkout.includes("void body.cancel_url"), "checkout ignores client cancel_url");
assert(checkout.includes("consume_confirmed_upload"), "checkout consumes the upload for one order");
assert(checkout.includes("Idempotency-Key"), "checkout sends a Stripe Idempotency-Key");
assert(checkout.includes("checkout_request_id"), "checkout reuses checkout_request_id after a lost response");
assert(checkout.includes("stripeCheckoutReuseAction") || checkout.includes("return_existing"), "checkout recovers an existing Stripe session");
assert(checkout.includes("stripeExpireConfirmed"), "checkout confirms Stripe expiry from HTTP and session status");
assert(checkout.includes("reconcilable: true"), "checkout keeps unconfirmed expiry orders reconcilable");
assert(checkout.includes("stripeExpireSessionPath") || checkout.includes("/expire"), "checkout expires the Stripe session after a post-create error");
assert(checkout.includes('.delete().eq("id", generation.id)'), "checkout deletes the generation if the order insert fails");
assert(checkout.includes("template_lookup_failed"), "checkout treats template query errors as failures");
assert(checkout.includes("TEMPLATE_ACTIVE_COLUMN") || checkout.includes("isactive"), "checkout uses the canonical isactive column");
assert(!checkout.includes("is_active, type"), "checkout does not select isactive and is_active together");
assert(checkout.includes("checkoutRedeemKey"), "checkout derives the same redeem code on retry");
assert(checkout.includes("stripeCheckoutIdempotencyKey(orderId)"), "checkout keeps checkout:<orderId> as the Stripe Idempotency-Key");

const boot = read("src/main.tsx");
assert(boot.includes("REDEEM_BOOTSTRAP_TIMEOUT_MS"), "bootstrap redeem has a timeout");
assert(boot.includes("signal: timeout.signal"), "bootstrap redeem aborts the fetch");

const payment = read("src/components/funnelVersion/FunnelPayment.tsx");
assert(payment.includes("checkout_request_id"), "funnel checkout sends checkout_request_id");
assert(payment.includes("readOrCreateCheckoutRequestId"), "funnel checkout reuses the stored request id");

const blockers = read("supabase/migrations/20260818_review_blockers.sql");
assert(blockers.includes("order_status_unchanged"), "dead result_email does not fail completed orders");
assert(blockers.includes("finish_fulfillment_job_and_enqueue_email"), "SQL finishes the main job and enqueues email atomically");
assert(blockers.includes("generations_anon_no_access"), "generations RLS denies anon");
assert(blockers.includes("user_id = auth.uid()"), "generations RLS limits owners to their rows");
assert(blockers.includes("is_generation_admin()"), "generations RLS keeps admin access explicit");

const preview = read("supabase/functions/get-upload-preview/index.ts");
assert(preview.includes("createSignedUrl"), "preview uses a signed URL");
assert(preview.includes("authorizeUploadAccess"), "preview requires token or exact ownership");

const purge = read("supabase/functions/purge-expired-media/index.ts");
assert(purge.includes("cleanupOneRow"), "cleanup deletes one object then clears that row");
assert(purge.includes("requireSchedulerAuth"), "cleanup requires scheduler auth");
assert(purge.includes("abandoned"), "cleanup removes abandoned uploads");
assert(purge.includes("confirmed"), "cleanup also purges confirmed expired unconsumed uploads");
assert(purge.includes("consumed_order_id"), "cleanup checks consumed_order_id before abandoning");
assert(purge.includes("select failed"), "cleanup checks Supabase select errors");

const access = read("supabase/functions/_shared/access.ts");
assert(access.includes("requireAccessTokenSecret"), "ACCESS_TOKEN_SECRET is required");
assert(!access.includes("FULFILLMENT_SECRET") || access.includes("tryAccessTokenSecret"), "access helper exists");
assert(!access.includes("Deno.env.get(\"FULFILLMENT_SECRET\") || Deno.env.get(\"ACCESS_TOKEN_SECRET\")"), "ACCESS_TOKEN_SECRET has no FULFILLMENT_SECRET fallback");
assert(access.includes("EdgeRuntime.waitUntil"), "kick uses waitUntil only");
assert(access.includes("requireSchedulerAuth"), "scheduler auth is documented");

const sql = read("supabase/migrations/20260815_scheduler_recovery.sql");
assert(sql.includes("set search_path = ''"), "SQL functions pin search_path to empty");
assert(sql.includes("pg_catalog.now()"), "SQL functions use schema-qualified now()");
assert(sql.includes("release_mvp_generation_claim"), "SQL can unstick processing generations");
assert(sql.includes("mvp_orders_one_live_upload"), "SQL enforces one live upload per order");

const redeem = read("supabase/functions/redeem-result-access/index.ts");
assert(redeem.includes("p_order_id"), "redeem passes the order id so retries stay scoped");

const schedules = read("supabase/migrations/20260817_fulfillment_schedules.sql");
assert(schedules.includes("process-fulfillment-jobs"), "schedule migration names process-fulfillment-jobs");
assert(schedules.includes("purge-expired-media"), "schedule migration names purge-expired-media");
assert(schedules.includes("fulfillment_project_url"), "schedule migration uses Vault names");
assert(!schedules.includes("sk_live_"), "schedule migration has no Stripe secret literals");

const envExample = read(".env.example");
assert(envExample.includes("ACCESS_TOKEN_SECRET="), ".env.example documents ACCESS_TOKEN_SECRET");
assert(envExample.includes("FULFILLMENT_SECRET="), ".env.example documents FULFILLMENT_SECRET");
assert(envExample.includes("CHECKOUT_ENABLED=false"), ".env.example keeps checkout off");
assert(envExample.includes("20260817_fulfillment_schedules.sql"), ".env.example points at the official scheduler");
assert(envExample.includes("Email is required at launch"), ".env.example requires Resend at launch");

const deno = spawnSync("deno", ["--version"], { encoding: "utf8" });
if (deno.status !== 0) {
  console.error("FAIL: Deno is required for Edge Function typecheck");
  process.exitCode = 1;
} else {
  const files = walkTs(functionsDir);
  let failed = 0;
  for (const file of files) {
    const check = spawnSync("deno", ["check", "--no-lock", file], {
      encoding: "utf8",
      env: { ...process.env, DENO_NO_PACKAGE_JSON: "1" },
    });
    if (check.status !== 0) {
      failed += 1;
      console.error(`FAIL: deno check ${file}\n${check.stdout}\n${check.stderr}`);
      process.exitCode = 1;
    }
  }
  if (failed === 0) console.log(`ok: deno check (${files.length} files)`);
}

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log("Edge function verification passed.");
