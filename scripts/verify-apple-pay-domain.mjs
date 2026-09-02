#!/usr/bin/env node
/**
 * Verify Apple Pay domain association on both public TDG hosts.
 * Does not follow redirects (a 3xx onto HTML would be a failure).
 * Does not print file contents. Does not instruct Vercel deploys.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const hosts = ["thedigitalgifter.com", "www.thedigitalgifter.com"];
const path = "/.well-known/apple-developer-merchantid-domain-association";
const local = readFileSync(resolve("public/.well-known/apple-developer-merchantid-domain-association"));
const localHash = createHash("sha256").update(local).digest("hex");
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

record("local_association_not_placeholder", local.length > 1000 && !local.includes("PLACEHOLDER_CONFIGURE"), `bytes=${local.length}`);

for (const host of hosts) {
  const url = `https://${host}${path}`;
  const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20000) });
  const loc = res.headers.get("location") || "";
  const type = res.headers.get("content-type") || "";
  const body = Buffer.from(await res.arrayBuffer());
  const html = /^\s*<(!doctype html|html)/i.test(body.toString("utf8")) || /<\/?html[\s>]/i.test(body.toString("utf8"));
  const hash = createHash("sha256").update(body).digest("hex");
  record(
    `https_${host}_status`,
    res.status === 200,
    `http=${res.status} redirect=${loc ? "yes" : "no"}`,
  );
  record(`https_${host}_no_auth_redirect`, res.status !== 401 && res.status !== 403 && !/^https?:\/\/.+\/(login|auth)/i.test(loc), "");
  record(`https_${host}_content_type`, /octet-stream|text\/plain/i.test(type) && !/text\/html/i.test(type), type || "none");
  record(`https_${host}_not_html`, !html && body.length === local.length, `bytes=${body.length}`);
  record(`https_${host}_matches_repo`, hash === localHash, hash === localHash ? "sha256_match" : "sha256_mismatch");
}

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`APPLE_PAY_FILE_FAILED ${failed.length}/${results.length}`);
  console.error("Register both domains in Stripe Dashboard → Settings → Payment methods → Apple Pay (live).");
  process.exit(1);
}
console.log(`APPLE_PAY_FILE_OK ${results.length}/${results.length}`);
console.log("NOTE: file OK is not Stripe dashboard registration. See payment_method_domains probe.");
