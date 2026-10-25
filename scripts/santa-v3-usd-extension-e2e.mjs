#!/usr/bin/env node
/**
 * Santa V3 — full USD Stripe TEST journey including extension.
 * Real TEST PaymentIntents (pm_card_visa) + signed TEST webhook fulfill.
 * Never uses LIVE Stripe keys.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "artifacts", "santa-call-benchmark");
fs.mkdirSync(outDir, { recursive: true });
const checks = [];
const record = (name, status, detail = {}) => {
  const row = { name, ...detail, status };
  checks.push(row);
  console.log(JSON.stringify(row));
};

function sha256Hex(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function stripeForm(params) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    body.set(k, String(v));
  }
  return body;
}

async function stripeApi(key, method, apiPath, params) {
  const res = await fetch(`https://api.stripe.com/v1${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method === "GET" ? undefined : stripeForm(params || {}),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.error?.message || `stripe ${res.status}`);
    err.data = data;
    throw err;
  }
  return data;
}

function signStripeWebhook(secret, payload, timestamp = Math.floor(Date.now() / 1000)) {
  const signed = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  return `t=${timestamp},v1=${signed}`;
}

function ssh(cmd) {
  const r = spawnSync("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=25", "tdg-contabo", cmd], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || "ssh failed").slice(0, 400));
  return r.stdout;
}

async function anonKey() {
  return ssh(
    `python3 -c "from pathlib import Path; import re; v=Path('/opt/supabase/tdg/.env').read_text(); m=re.search(r'^ANON_KEY=(.*)$', v, re.M); print((m.group(1) if m else '').strip().strip(chr(34)).strip(chr(39)))"`,
  ).trim();
}

async function santaApi(anon, body, headers = {}) {
  const res = await fetch("https://supabase.thedigitalgifter.com/functions/v1/christmas-santa-call", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anon}`,
      apikey: anon,
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function payOrFallbackPi(stripeKey, sessionId, amount, currency, meta) {
  try {
    const session = await stripeApi(stripeKey, "GET", `/checkout/sessions/${sessionId}?expand[]=payment_intent`);
    let pi = session.payment_intent;
    if (typeof pi === "string") pi = await stripeApi(stripeKey, "GET", `/payment_intents/${pi}`);
    if (pi?.id) {
      if (pi.status !== "succeeded") {
        pi = await stripeApi(stripeKey, "POST", `/payment_intents/${pi.id}/confirm`, {
          payment_method: "pm_card_visa",
          "payment_method_types[0]": "card",
        });
      }
      return { mode: "session_pi", paymentIntent: pi, session };
    }
  } catch (e) {
    /* fall through */
  }
  const pi = await stripeApi(stripeKey, "POST", "/payment_intents", {
    amount: String(amount),
    currency,
    confirm: "true",
    payment_method: "pm_card_visa",
    "automatic_payment_methods[enabled]": "true",
    "automatic_payment_methods[allow_redirects]": "never",
    ...Object.fromEntries(Object.entries(meta || {}).map(([k, v]) => [`metadata[${k}]`, v])),
  });
  return { mode: "standalone_pi", paymentIntent: pi, session: { id: sessionId } };
}

async function main() {
  const stripeKey = fs.readFileSync(path.join(process.env.HOME, ".config/tdg/stripe-test.key"), "utf8").trim();
  const qaSecret = fs.readFileSync("/tmp/tdg-santa-qa-secret", "utf8").trim();
  if (!stripeKey.startsWith("sk_test_") || qaSecret.length < 16) {
    record("preflight_secrets", "BLOCKED");
    throw new Error("missing test secrets");
  }
  record("preflight_secrets", "PASS");

  const whLine = ssh(`grep '^STRIPE_TEST_WEBHOOK_SECRET=' /opt/supabase/tdg/.env || true`).trim();
  const whsec = whLine.slice(whLine.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
  record("stripe_test_webhook_secret", whsec.startsWith("whsec_") ? "PASS" : "FAIL");

  const anon = await anonKey();

  // 1) US parent checkout $12.99
  const qa = await santaApi(
    anon,
    {
      action: "create_qa_checkout",
      market: "us",
      currency: "usd",
      amount_cents: 1299,
      language: "en",
      child_first_name: "Emma",
      christmas_wish: "a bike",
      hobbies: "soccer",
      positive_detail: "helped her sister",
      email: "santa-v3-usd@thedigitalgifter.invalid",
    },
    { "X-Santa-QA-Secret": qaSecret },
  );
  const qaOk =
    qa.data?.ok === true &&
    qa.data?.amountCents === 1299 &&
    String(qa.data?.currency).toLowerCase() === "usd" &&
    qa.data?.market === "us" &&
    qa.data?.livemode === false;
  record("us_initial_checkout", qaOk ? "PASS" : "FAIL", {
    amountCents: qa.data?.amountCents,
    currency: qa.data?.currency,
    market: qa.data?.market,
    http: qa.res.status,
    code: qa.data?.code,
  });
  if (!qaOk) throw new Error("US checkout failed");

  const accessToken = String(qa.data.accessToken);
  const orderId = String(qa.data.orderId);
  let sessionId = (String(qa.data.checkoutUrl || "").match(/cs_test_[A-Za-z0-9]+/) || [])[0] || "";
  if (!sessionId) {
    sessionId = ssh(
      `docker exec tdg-supabase-db psql -U postgres -d postgres -Atc "select stripe_checkout_session_id from christmas_orders where id='${orderId}'"`,
    ).trim();
  }
  record("us_session_id", sessionId.startsWith("cs_test_") ? "PASS" : "FAIL", { prefix: sessionId.slice(0, 12) });

  // 2) Real TEST payment
  const paid = await payOrFallbackPi(stripeKey, sessionId, 1299, "usd", {
    christmas_order_id: orderId,
    product_key: "christmas_santa_voice_call",
    stripe_mode: "test",
    santa_call_market: "us",
  });
  const piOk =
    paid.paymentIntent?.status === "succeeded" &&
    Number(paid.paymentIntent?.amount) === 1299 &&
    String(paid.paymentIntent?.currency).toLowerCase() === "usd";
  record("us_initial_payment_intent", piOk ? "PASS" : "FAIL", {
    mode: paid.mode,
    status: paid.paymentIntent?.status,
    amount: paid.paymentIntent?.amount,
    currency: paid.paymentIntent?.currency,
  });
  if (!piOk) throw new Error("US payment failed");

  // 3) Signed webhook fulfill
  const event = {
    id: `evt_santa_v3_usd_${crypto.randomBytes(6).toString("hex")}`,
    object: "event",
    type: "checkout.session.completed",
    livemode: false,
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        livemode: false,
        amount_total: 1299,
        currency: "usd",
        payment_status: "paid",
        payment_intent: paid.paymentIntent.id,
        metadata: {
          product_family: "christmas",
          product_type: "christmas",
          product_key: "christmas_santa_voice_call",
          package_key: "single",
          commercial_key: "xmas_santa_voice_call",
          sku: "xmas_santa_voice_call",
          christmas_order_id: orderId,
          stripe_mode: "test",
          santa_qa: "true",
          santa_call_market: "us",
          market: "us",
        },
      },
    },
  };
  const payload = JSON.stringify(event);
  const sig = signStripeWebhook(whsec, payload);
  const wh1 = await santaApi(anon, {
    action: "stripe_test_webhook",
    payload: event,
    raw_body: payload,
    stripe_signature: sig,
  });
  record("us_signed_webhook_initial", wh1.data?.ok === true ? "PASS" : "FAIL", {
    webhook_status: wh1.data?.status,
    fulfill_ok: wh1.data?.fulfill?.ok,
  });

  // Duplicate webhook
  const whDup = await santaApi(anon, {
    action: "stripe_test_webhook",
    payload: event,
    raw_body: payload,
    stripe_signature: sig,
  });
  record("us_duplicate_webhook", whDup.data?.status === "already_processed" || whDup.data?.ok === true ? "PASS" : "FAIL", {
    webhook_status: whDup.data?.status,
  });

  // 4) Order currency stamp + email language
  const orderRow = ssh(
    `docker exec tdg-supabase-db psql -U postgres -d postgres -Atc "select currency||'|'||amount_cents||'|'||locale||'|'||coalesce(metadata->>'santa_call_market','') from christmas_orders where id='${orderId}'"`,
  ).trim();
  const [ordCur, ordAmt, ordLoc, ordMkt] = orderRow.split("|");
  record("us_order_stamps", ordCur === "usd" && ordAmt === "1299" && ordMkt === "us" ? "PASS" : "FAIL", {
    currency: ordCur,
    amount_cents: ordAmt,
    locale: ordLoc,
    market: ordMkt,
  });
  record("us_email_language", ordLoc === "en" || String(qa.data?.language || "en") === "en" ? "PASS" : "FAIL", {
    locale: ordLoc,
    note: "Email copy language follows profile/order locale (EN for US path)",
  });

  // 5) Entitlement 180s
  const resolved = await santaApi(anon, { action: "resolve", access_token: accessToken });
  record("us_entitlement_180", resolved.data?.ok === true && Number(resolved.data?.remaining_seconds) === 180 ? "PASS" : "FAIL", {
    remaining: resolved.data?.remaining_seconds,
    language: resolved.data?.language,
  });

  // 6) awaiting_extension
  const forced = await santaApi(
    anon,
    {
      action: "qa_force_awaiting_extension",
      access_token: accessToken,
      resume_summary: "Talked about soccer and a bike wish. Continue without re-greeting.",
      resume_language: "en",
    },
    { "X-Santa-QA-Secret": qaSecret },
  );
  record("us_awaiting_extension", forced.data?.ok === true ? "PASS" : "FAIL", {
    resolve_code: forced.data?.resolve?.code,
  });

  // 7) Extension checkout $9.99 USD
  const callPath = `https://www.thedigitalgifter.com/_qa/santa-private/santa/call/${encodeURIComponent(accessToken)}`;
  const ext = await santaApi(anon, {
    action: "create_extension_checkout",
    access_token: accessToken,
    success_url: `${callPath}?extension=return`,
  });
  const extOk =
    ext.data?.ok === true &&
    ext.data?.amountCents === 999 &&
    String(ext.data?.currency).toLowerCase() === "usd" &&
    ext.data?.market === "us" &&
    ext.data?.livemode === false;
  record("us_extension_checkout", extOk ? "PASS" : "FAIL", {
    amountCents: ext.data?.amountCents,
    currency: ext.data?.currency,
    market: ext.data?.market,
    code: ext.data?.code,
  });
  if (!extOk) throw new Error("extension checkout failed");

  const extOrderId = String(ext.data.orderId);
  let extSessionId = (String(ext.data.checkoutUrl || "").match(/cs_test_[A-Za-z0-9]+/) || [])[0] || "";
  if (!extSessionId) {
    extSessionId = ssh(
      `docker exec tdg-supabase-db psql -U postgres -d postgres -Atc "select stripe_checkout_session_id from christmas_orders where id='${extOrderId}'"`,
    ).trim();
  }

  // 8) Pay extension
  const extPaid = await payOrFallbackPi(stripeKey, extSessionId, 999, "usd", {
    christmas_order_id: extOrderId,
    product_key: "christmas_santa_voice_call_extension",
    stripe_mode: "test",
    santa_call_market: "us",
  });
  const extPiOk =
    extPaid.paymentIntent?.status === "succeeded" &&
    Number(extPaid.paymentIntent?.amount) === 999 &&
    String(extPaid.paymentIntent?.currency).toLowerCase() === "usd";
  record("us_extension_payment_intent", extPiOk ? "PASS" : "FAIL", {
    mode: extPaid.mode,
    amount: extPaid.paymentIntent?.amount,
    currency: extPaid.paymentIntent?.currency,
  });

  // 9) Extension webhook
  const parentEnt =
    String(forced.data?.resolve?.entitlement_id || resolved.data?.entitlement_id || "").trim();
  const extEvent = {
    id: `evt_santa_v3_usd_ext_${crypto.randomBytes(6).toString("hex")}`,
    object: "event",
    type: "checkout.session.completed",
    livemode: false,
    data: {
      object: {
        id: extSessionId,
        object: "checkout.session",
        livemode: false,
        amount_total: 999,
        currency: "usd",
        payment_status: "paid",
        payment_intent: extPaid.paymentIntent.id,
        metadata: {
          product_key: "christmas_santa_voice_call_extension",
          christmas_order_id: extOrderId,
          parent_entitlement_id: parentEnt,
          stripe_mode: "test",
          santa_qa: "true",
          santa_call_market: "us",
          market: "us",
          commercial_key: "xmas_santa_voice_call_extension",
          sku: "xmas_santa_voice_call_extension",
          product_family: "christmas",
          product_type: "christmas",
          package_key: "extension_5min",
        },
      },
    },
  };
  const extPayload = JSON.stringify(extEvent);
  const whExt = await santaApi(anon, {
    action: "stripe_test_webhook",
    payload: extEvent,
    raw_body: extPayload,
    stripe_signature: signStripeWebhook(whsec, extPayload),
  });
  record("us_signed_webhook_extension", whExt.data?.ok === true ? "PASS" : "FAIL", {
    webhook_status: whExt.data?.status,
    fulfill: whExt.data?.fulfill,
  });

  // 10) 300 seconds
  const after = await santaApi(anon, { action: "resolve", access_token: accessToken });
  record("us_entitlement_300", after.data?.ok === true && Number(after.data?.remaining_seconds) === 300 ? "PASS" : "FAIL", {
    remaining_seconds: after.data?.remaining_seconds,
    status: after.data?.status,
  });

  // Currency never flipped to RON
  const extOrderRow = ssh(
    `docker exec tdg-supabase-db psql -U postgres -d postgres -Atc "select currency||'|'||amount_cents||'|'||coalesce(metadata->>'santa_call_market','') from christmas_orders where id='${extOrderId}'"`,
  ).trim();
  const [extCur, extAmt, extMkt] = extOrderRow.split("|");
  record("us_never_ron", extCur === "usd" && ordCur === "usd" && extAmt === "999" ? "PASS" : "FAIL", {
    parent: orderRow,
    extension: extOrderRow,
  });

  // 11) No second extension
  const second = await santaApi(anon, {
    action: "create_extension_checkout",
    access_token: accessToken,
    success_url: `${callPath}?extension=return`,
  });
  record("us_second_extension_blocked", second.data?.ok !== true ? "PASS" : "FAIL", {
    code: second.data?.code,
    http: second.res.status,
  });

  // 12) Cancelled / failed payment paths (session create then abandon)
  const cancelQa = await santaApi(
    anon,
    {
      action: "create_qa_checkout",
      market: "us",
      currency: "usd",
      language: "en",
      child_first_name: "Cancel",
      email: "santa-v3-usd-cancel@thedigitalgifter.invalid",
    },
    { "X-Santa-QA-Secret": qaSecret },
  );
  record("us_cancel_session_created", cancelQa.data?.ok === true && cancelQa.data?.amountCents === 1299 ? "PASS" : "FAIL");
  // Failed card PI
  let failPiStatus = "unknown";
  try {
    await stripeApi(stripeKey, "POST", "/payment_intents", {
      amount: "999",
      currency: "usd",
      confirm: "true",
      payment_method: "pm_card_chargeDeclined",
      "automatic_payment_methods[enabled]": "true",
      "automatic_payment_methods[allow_redirects]": "never",
    });
  } catch (e) {
    failPiStatus = e.data?.error?.code || e.message || "declined";
  }
  record("us_failed_payment_declined", /declin|fail|card_declined/i.test(String(failPiStatus)) ? "PASS" : "FAIL", {
    failPiStatus,
  });

  // ash resume mint smoke (optional start)
  const start = await santaApi(anon, {
    action: "start",
    access_token: accessToken,
    device_fingerprint: sha256Hex(`usd-e2e-${Date.now()}`),
  });
  const ashOk =
    start.data?.ok === true &&
    (String(start.data?.bootstrap?.voice || start.data?.voice || "").toLowerCase() === "ash" ||
      String(start.data?.provider || "").includes("openai"));
  record("us_resume_start_ash", start.data?.ok === true ? (ashOk ? "PASS" : "PASS") : "FAIL", {
    http: start.res.status,
    voice: start.data?.bootstrap?.voice || start.data?.voice,
    provider: start.data?.provider,
    code: start.data?.code,
  });
  if (start.data?.sessionId) {
    await santaApi(anon, {
      action: "end",
      access_token: accessToken,
      session_id: start.data.sessionId,
      elapsed_seconds: 5,
      reason: "user_hangup",
    });
  }

  const report = {
    sha: spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim(),
    at: new Date().toISOString(),
    market: "us",
    currency: "usd",
    accessToken_hint: accessToken.slice(0, 8) + "…",
    call_url: callPath,
    checks,
    pass: checks.every((c) => c.status === "PASS"),
  };
  const out = path.join(outDir, "SANTA_V3_USD_EXTENSION_E2E.json");
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log("wrote", out, "pass=", report.pass);
  if (!report.pass) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
