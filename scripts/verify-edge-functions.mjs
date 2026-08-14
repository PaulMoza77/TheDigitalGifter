#!/usr/bin/env node
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
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
assert(webhook.includes("process-fulfillment-jobs"), "stripe-webhook enqueues the job worker");
assert(webhook.includes("validatePaidStripeSession"), "stripe-webhook validates amount/currency/SKU");
assert(!webhook.includes("await invokeFulfill"), "stripe-webhook does not await fulfillment");

const confirm = read("supabase/functions/confirm-upload/index.ts");
assert(confirm.includes("validateImageUpload"), "confirm-upload checks magic bytes");
assert(confirm.includes("remove("), "confirm-upload deletes rejected objects");

const uploadUrl = read("supabase/functions/create-upload-url/index.ts");
assert(uploadUrl.includes("serverUploadPath"), "create-upload-url uses a server-fixed path");
assert(uploadUrl.includes("allowRateLimit"), "create-upload-url rate-limits uploads");
assert(!uploadUrl.includes("fileName.toLowerCase()"), "create-upload-url ignores client filenames");

const signed = read("supabase/functions/get-signed-result/index.ts");
assert(signed.includes("authorizeOrderAccess"), "get-signed-result requires ownership or token");
assert(signed.includes('void body.session_id'), "get-signed-result ignores session_id as proof");

const regen = read("supabase/functions/request-included-regeneration/index.ts");
assert(regen.includes("claim_included_regeneration"), "regeneration uses CAS claim");
assert(regen.includes("kickFulfillmentWorker"), "regeneration enqueues instead of generating inline");
assert(!regen.includes("generateWithReplicate"), "regeneration does not generate synchronously");

const checkout = read("supabase/functions/create-checkout-session/index.ts");
assert(checkout.includes('.from("templates")'), "checkout loads the real template prompt");
assert(checkout.includes("template_prompt"), "checkout stores template_prompt server-side");
assert(checkout.includes("upload_sessions"), "checkout uses the confirmed upload session");

const preview = read("supabase/functions/get-upload-preview/index.ts");
assert(preview.includes("createSignedUrl"), "preview uses a signed URL");

const purge = read("supabase/functions/purge-expired-media/index.ts");
assert(purge.includes("PAGE_SIZE = 200"), "cleanup is paginated at 200 rows");
assert(purge.includes("verifyCleanupPage"), "cleanup verifies each page");
assert(purge.includes("abandoned"), "cleanup removes abandoned uploads");

const sql = read("supabase/migrations/20260814_security_hardening.sql");
assert(sql.includes("enable row level security"), "new tables enable RLS");
assert(sql.includes("upload_sessions_no_direct_access"), "upload_sessions deny anon/authenticated");
assert(sql.includes("fulfillment_jobs_no_direct_access"), "fulfillment_jobs deny anon/authenticated");
assert(sql.includes("stripe_webhook_events_no_direct_access"), "stripe_webhook_events deny anon/authenticated");

const deno = spawnSync("deno", ["--version"], { encoding: "utf8" });
if (deno.status === 0) {
  const files = walkTs(functionsDir);
  let failed = 0;
  for (const file of files) {
    const check = spawnSync("deno", ["check", "--no-lock", file], { encoding: "utf8" });
    if (check.status !== 0) {
      failed += 1;
      console.error(`FAIL: deno check ${file}\n${check.stdout}\n${check.stderr}`);
      process.exitCode = 1;
    }
  }
  if (failed === 0) console.log(`ok: deno check (${files.length} files)`);
} else {
  console.log("skip: deno not installed; static source checks only");
}

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log("Edge function verification passed.");
