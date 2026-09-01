#!/usr/bin/env node
/**
 * Verify Apple Pay domain association is live (required for Express Checkout wallets).
 * Usage:
 *   node scripts/verify-apple-pay-domain.mjs
 *   APPLE_PAY_DOMAIN_URL=https://staging.example.com/.well-known/... node scripts/verify-apple-pay-domain.mjs
 */
const url =
  process.env.APPLE_PAY_DOMAIN_URL ||
  "https://www.thedigitalgifter.com/.well-known/apple-developer-merchantid-domain-association";

const res = await fetch(url, { redirect: "follow" });
const body = (await res.text()).trim();

if (res.status !== 200) {
  console.error(`::error::Apple Pay domain association returned HTTP ${res.status}.`);
  console.error(`URL: ${url}`);
  console.error(`Body preview: ${body.slice(0, 200)}`);
  console.error("");
  console.error("Fix: Stripe Dashboard → Settings → Payment methods → Apple Pay → add domain");
  console.error("thedigitalgifter.com, download the verification file, then set Vercel Production env:");
  console.error("  STRIPE_APPLE_PAY_DOMAIN_ASSOCIATION=<exact file contents>");
  process.exit(2);
}

if (
  !body ||
  body.includes("PLACEHOLDER_CONFIGURE") ||
  /<\/?html[\s>]/i.test(body) ||
  /<!doctype\s+html/i.test(body) ||
  /not configured/i.test(body)
) {
  console.error("::error::Apple Pay domain association body is invalid or placeholder HTML.");
  console.error(`URL: ${url}`);
  console.error(`Body preview: ${body.slice(0, 200)}`);
  process.exit(2);
}

console.log(`Apple Pay domain association OK (${body.length} bytes) from ${url}`);
