#!/usr/bin/env node
/**
 * Separates NEGATIVE (fail-closed) vs FUNCTIONAL checks for TDG production edges.
 * Keeps Supabase external. Does not replace live Stripe keys.
 * Never prints secrets, tokens, or order payloads.
 *
 * Isolated price check for Pet V2 $2.99 uses createOrder validation without
 * creating a paid session (bad email / amount mismatch).
 */
import { execFileSync } from "node:child_process";

const ip = process.env.MOZAS_SSH_HOST || "";
const verifyHost = process.env.TDG_VERIFY_HOST || "tdg-verify.mozas-prod-01";
const supabaseUrl = String(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
const anon = String(process.env.VITE_SUPABASE_ANON_KEY || "").trim();
if (!ip || !supabaseUrl || !anon) {
  console.error("BLOCKED: MOZAS_SSH_HOST, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY required");
  process.exit(2);
}

const negative = [];
const functional = [];
const blocked = [];

function rec(bucket, name, ok, detail) {
  bucket.push({ name, ok, detail });
  const label = bucket === negative ? "NEG" : bucket === functional ? "FUN" : "BLK";
  console.log(`${ok ? "PASS" : "FAIL"} [${label}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function edge(path, body, method = "POST") {
  const res = await fetch(`${supabaseUrl}${path}`, {
    method,
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "Content-Type": "application/json",
    },
    body: body == null ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  const html = /^\s*<(!doctype html|html)/i.test(text);
  return { status: res.status, json, html, bytes: text.length };
}

function origin(path, extra = []) {
  const args = [
    "-sS",
    "-D",
    "-",
    "-o",
    "/tmp/tdg-fun-body",
    "--max-time",
    "25",
    "--resolve",
    `${verifyHost}:80:${ip}`,
    ...extra,
    `http://${verifyHost}${path}`,
  ];
  const headers = execFileSync("curl", args, { encoding: "utf8" });
  let status = 0;
  let contentType = "";
  for (const line of headers.split(/\r?\n/)) {
    if (line.startsWith("HTTP/")) {
      const p = line.split(/\s+/);
      if (p[1] && /^\d+$/.test(p[1])) status = Number(p[1]);
    }
    if (line.toLowerCase().startsWith("content-type:")) contentType = line.split(":").slice(1).join(":").trim();
  }
  const text = execFileSync("cat", ["/tmp/tdg-fun-body"], { encoding: "utf8" });
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status, contentType, json, html: /^\s*<(!doctype html|html)/i.test(text), text };
}

// ---------- NEGATIVE (fail-closed) ----------
{
  const checkout = await edge("/functions/v1/pet-funnel", { action: "createStripeCheckout" });
  rec(
    negative,
    "checkout_without_order_fail_closed",
    checkout.status >= 400 && checkout.status < 500 && !checkout.html && !checkout.json?.url && !checkout.json?.clientSecret,
    `http=${checkout.status}`,
  );
}
{
  const gen = await edge("/functions/v1/generate-nano-banana", {});
  rec(negative, "generation_without_auth_fail_closed", gen.status >= 400 && !gen.html, `http=${gen.status}`);
}
{
  const preview = await edge("/functions/v1/pet-v2-preview", {});
  rec(
    negative,
    "preview_without_payload_fail_closed",
    preview.status >= 400 && !preview.html && preview.json?.ok !== true,
    `http=${preview.status}`,
  );
}
{
  const wh = await edge("/functions/v1/stripe-webhook", { type: "probe" });
  rec(
    negative,
    "stripe_webhook_boots",
    wh.status !== 503 && wh.json?.code !== "BOOT_ERROR" && !wh.html,
    `http=${wh.status} code=${wh.json?.code || ""}`,
  );
  rec(
    negative,
    "stripe_webhook_unsigned_rejected",
    wh.status >= 400 && wh.status < 500 && !wh.html,
    `http=${wh.status}`,
  );
}
{
  const price = await edge("/functions/v1/pet-funnel", {
    action: "createOrder",
    funnelVariant: "v2",
    amountCents: 2700,
    currency: "usd",
    sku: "pet-secret-life-12",
    email: "probe@example.com",
    petName: "Probe",
    species: "dog",
    personality: "cute",
    photo: { contentType: "image/jpeg", byteSize: 1000 },
  });
  rec(
    negative,
    "pet_v2_rejects_27_dollar_amount",
    price.status >= 400 && price.status < 500 && !price.html,
    `http=${price.status}`,
  );
}
{
  const ingest = origin("/api/pet/funnel-event", ["-X", "POST", "-H", "Content-Type: application/json", "-d", "{}"]);
  rec(negative, "origin_analytics_empty_body_rejected", ingest.status === 400 && !ingest.html, `http=${ingest.status}`);
}

// ---------- FUNCTIONAL (success paths that do not charge) ----------
{
  const settings = await fetch(`${supabaseUrl}/auth/v1/settings`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    signal: AbortSignal.timeout(15000),
  });
  const j = await settings.json().catch(() => null);
  rec(
    functional,
    "auth_settings_google_enabled",
    settings.ok && Boolean(j?.external?.google),
    `http=${settings.status}`,
  );
}
{
  // Authorize URL generation (does not complete OAuth / no credentials).
  const authUrl = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent("http://tdg-verify.mozas-prod-01/auth/callback")}`;
  const res = await fetch(authUrl, { redirect: "manual", signal: AbortSignal.timeout(15000) });
  const loc = res.headers.get("location") || "";
  rec(
    functional,
    "auth_google_authorize_redirect",
    (res.status === 302 || res.status === 303 || res.status === 307) && /accounts\.google\.com|google/i.test(loc),
    `http=${res.status}`,
  );
}
{
  const offer = await edge("/functions/v1/pet-funnel", { action: "getPublicOffer" });
  rec(
    functional,
    "public_offer_available",
    offer.status === 200 && Number(offer.json?.amountCents) > 0,
    `http=${offer.status} list_cents_set=${Number(offer.json?.amountCents) > 0}`,
  );
}
{
  // Accepts $2.99 for V2 (price check passes) then fails on email — no order created.
  const v2 = await edge("/functions/v1/pet-funnel", {
    action: "createOrder",
    funnelVariant: "v2",
    amountCents: 299,
    currency: "usd",
    sku: "pet-secret-life-12",
    email: "not-an-email",
    petName: "Probe",
    species: "dog",
    personality: "cute",
    photo: { contentType: "image/jpeg", byteSize: 1000 },
  });
  const msg = String(v2.json?.message || v2.json?.error || "").toLowerCase();
  rec(
    functional,
    "pet_v2_accepts_299_cents_price_path",
    v2.status >= 400 && v2.status < 500 && !v2.html && /email|valid/.test(msg) && !/amount|price|offer/.test(msg),
    `http=${v2.status}`,
  );
}
{
  const v3 = await edge("/functions/v1/pet-funnel", {
    action: "createOrder",
    funnelVariant: "v3",
    amountCents: 299,
    currency: "usd",
    sku: "pet-secret-life-12",
    email: "not-an-email",
    petName: "Probe",
    species: "cat",
    personality: "cute",
    photo: { contentType: "image/jpeg", byteSize: 1000 },
  });
  const msg = String(v3.json?.message || v3.json?.error || "").toLowerCase();
  rec(
    functional,
    "pet_v3_accepts_299_cents_price_path",
    v3.status >= 400 && v3.status < 500 && !v3.html && /email|valid/.test(msg),
    `http=${v3.status}`,
  );
}
{
  const provider = origin("/api/pet-provider-status");
  rec(
    functional,
    "origin_provider_status_open",
    provider.status === 200 && provider.json?.available === true,
    `http=${provider.status}`,
  );
}
{
  const session = "00000000-0000-4000-8000-000000000099";
  const ingest = origin("/api/pet-v2/funnel-event", [
    "-X",
    "POST",
    "-H",
    "Content-Type: application/json",
    "-d",
    JSON.stringify({
      event_name: "v2_landing_view",
      funnel_session_id: session,
      event_id: "00000000-0000-4000-8000-000000000098",
      pathname: "/pet/dog-v2",
      species: "dog",
      device_type: "desktop",
    }),
  ]);
  rec(
    functional,
    "origin_v2_analytics_accepts_structured_event",
    ingest.status >= 200 && ingest.status < 300 && !ingest.html,
    `http=${ingest.status}`,
  );
}
{
  const status = origin("/api/pet-v3/internal-test-status", [
    "-X",
    "POST",
    "-H",
    "Content-Type: application/json",
    "-d",
    JSON.stringify({ funnel_session_id: "00000000-0000-4000-8000-000000000001" }),
  ]);
  rec(
    functional,
    "service_role_internal_status_reachable",
    status.status === 200 && !status.html,
    `http=${status.status}`,
  );
}

// Paid generation / real Stripe charge — blocked without isolated test keys
{
  const hasTestStripe = Boolean(process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_TEST_SECRET_KEY);
  if (!hasTestStripe) {
    rec(
      blocked,
      "paid_checkout_and_generation_isolated",
      false,
      "BLOCKED: no Stripe test secret in agent env (live keys must not be replaced)",
    );
  }
}

const negFail = negative.filter((r) => !r.ok);
const funFail = functional.filter((r) => !r.ok);
const blkNotes = blocked.filter((r) => !r.ok);
console.log(
  `SUMMARY negative=${negative.length - negFail.length}/${negative.length} functional=${functional.length - funFail.length}/${functional.length} blocked=${blkNotes.length}`,
);
if (negFail.length || funFail.length) {
  console.error("FUNCTIONAL_VERIFY_FAILED");
  process.exit(1);
}
console.log("FUNCTIONAL_VERIFY_OK");
if (blkNotes.length) {
  console.log("NOTE: paid end-to-end remains blocked until Stripe *test* keys are provided separately.");
}
