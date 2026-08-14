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

const fulfill = read("supabase/functions/fulfill-paid-order/index.ts");
assert(fulfill.includes("release_mvp_generation_claim"), "fulfillment releases processing on error");
assert(fulfill.includes("replicate_prediction_id"), "fulfillment persists the Replicate prediction id");
assert(!fulfill.includes('Prefer: "wait"'), "fulfillment does not block on Prefer: wait");
assert(fulfill.includes("detectStillImageMime"), "fulfillment detects result MIME");
assert(fulfill.includes("resultEmailHref"), "result email uses the fragment helper");
assert(!fulfill.includes("&access_token="), "result email does not put access_token in the query");

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
assert(!checkout.includes("access_token: orderAccessToken"), "checkout does not return an HMAC token");

const preview = read("supabase/functions/get-upload-preview/index.ts");
assert(preview.includes("createSignedUrl"), "preview uses a signed URL");
assert(preview.includes("authorizeUploadAccess"), "preview requires token or exact ownership");

const purge = read("supabase/functions/purge-expired-media/index.ts");
assert(purge.includes("cleanupOneRow"), "cleanup deletes one object then clears that row");
assert(purge.includes("requireSchedulerAuth"), "cleanup requires scheduler auth");
assert(purge.includes("abandoned"), "cleanup removes abandoned uploads");

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

const envExample = read(".env.example");
assert(envExample.includes("ACCESS_TOKEN_SECRET="), ".env.example documents ACCESS_TOKEN_SECRET");
assert(envExample.includes("FULFILLMENT_SECRET="), ".env.example documents FULFILLMENT_SECRET");
assert(envExample.includes("CHECKOUT_ENABLED=false"), ".env.example keeps checkout off");

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
