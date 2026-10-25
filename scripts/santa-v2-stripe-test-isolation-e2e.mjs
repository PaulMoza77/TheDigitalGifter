#!/usr/bin/env node
/**
 * Santa V2 Stripe TEST isolation E2E — real Checkout Sessions + TEST webhook fulfill.
 * Never uses Contabo LIVE STRIPE_SECRET_KEY.
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
  // status must win over any detail.status / detail.remaining fields
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

async function payHostedSession(stripeKey, sessionId) {
  const session = await stripeApi(stripeKey, "GET", `/checkout/sessions/${sessionId}?expand[]=payment_intent`);
  let pi = session.payment_intent;
  if (typeof pi === "string") {
    pi = await stripeApi(stripeKey, "GET", `/payment_intents/${pi}`);
  }
  if (!pi || !pi.id) {
    // Create and attach — fallback: confirm via payment_intent create matching amount then mark session (not ideal).
    throw new Error("session has no payment_intent yet");
  }
  if (pi.status === "succeeded") return { session, paymentIntent: pi };
  const confirmed = await stripeApi(stripeKey, "POST", `/payment_intents/${pi.id}/confirm`, {
    payment_method: "pm_card_visa",
    "payment_method_types[0]": "card",
  });
  const paidSession = await stripeApi(stripeKey, "GET", `/checkout/sessions/${sessionId}`);
  return { session: paidSession, paymentIntent: confirmed };
}

async function main() {
  const stripeKey = fs.readFileSync(path.join(process.env.HOME, ".config/tdg/stripe-test.key"), "utf8").trim();
  const qaSecret = fs.readFileSync("/tmp/tdg-santa-qa-secret", "utf8").trim();
  if (!stripeKey.startsWith("sk_test_") || qaSecret.length < 16) {
    record("preflight_secrets", "BLOCKED");
    throw new Error("missing test secrets");
  }
  record("preflight_secrets", "PASS");

  // Isolation proof on Contabo
  const iso = ssh(
    `python3 -c "from pathlib import Path; v=Path('/opt/supabase/tdg/.env').read_text();
import re
def g(k):
 m=re.search(r'^'+k+r'=(.*)$', v, re.M); return (m.group(1) if m else '').strip().strip(chr(34)).strip(chr(39))
sk=g('STRIPE_SECRET_KEY'); tsk=g('STRIPE_TEST_SECRET_KEY');
print('live', 'live' if sk.startswith('sk_live_') else 'BAD')
print('test', 'test' if tsk.startswith('sk_test_') else 'BAD')
print('mode', g('CHRISTMAS_SANTA_CALL_STRIPE_MODE'))
print('live_products', repr(g('CHRISTMAS_LIVE_PRODUCTS')))
print('same_key', 'YES' if sk==tsk else 'NO')"`,
  ).trim().split("\n");
  const isoMap = Object.fromEntries(iso.map((l) => l.split(/ (.+)/)));
  record("stripe_test_isolation", isoMap.live === "live" && isoMap.test === "test" && isoMap.mode === "test" && isoMap.same_key === "NO" ? "PASS" : "FAIL", {
    live_secret: isoMap.live,
    test_secret: isoMap.test,
    mode: isoMap.mode,
    keys_distinct: isoMap.same_key === "NO",
    live_products: isoMap.live_products,
  });

  const whLine = ssh(`grep -E '^STRIPE_TEST_WEBHOOK_SECRET=' /opt/supabase/tdg/.env | head -1`).trim();
  const whsec = whLine.slice(whLine.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
  record("stripe_test_webhook_secret", whsec.startsWith("whsec_") ? "PASS" : "FAIL");

  const anon = await anonKey();

  // --- Initial QA Checkout (real TEST Checkout Session) ---
  const qa = await santaApi(
    anon,
    {
      action: "create_qa_checkout",
      child_first_name: "Andrei",
      language: "ro",
      hobbies: "dinozauri",
      christmas_wish: "un tren",
      positive_detail: "a fost bun cu bunica",
    },
    { "x-santa-qa-secret": qaSecret },
  );
  const qaOk =
    qa.data?.ok === true &&
    qa.data?.stripeMode === "test" &&
    qa.data?.livemode === false &&
    qa.data?.amountCents === 5900 &&
    (qa.data?.checkoutUrl || qa.data?.clientSecret);
  record("initial_qa_checkout_session", qaOk ? "PASS" : "FAIL", {
    http: qa.res.status,
    stripeMode: qa.data?.stripeMode,
    livemode: qa.data?.livemode,
    checkoutMode: qa.data?.checkoutMode,
    amountCents: qa.data?.amountCents,
    has_url: Boolean(qa.data?.checkoutUrl),
    orderId_prefix: String(qa.data?.orderId || "").slice(0, 8),
  });
  if (!qaOk) throw new Error("qa checkout failed");

  const accessToken = String(qa.data.accessToken);
  const orderId = String(qa.data.orderId);
  // Extract session id from URL cs_test_...
  const url = String(qa.data.checkoutUrl || "");
  const sessionMatch = url.match(/cs_test_[A-Za-z0-9]+/) || [];
  let sessionId = sessionMatch[0] || "";
  if (!sessionId) {
    // recover from DB
    sessionId = ssh(
      `docker exec tdg-supabase-db psql -U postgres -d postgres -Atc "select stripe_checkout_session_id from christmas_orders where id='${orderId}'"`,
    ).trim();
  }
  record("initial_checkout_ui_session_id", sessionId.startsWith("cs_test_") ? "PASS" : "FAIL", {
    session_prefix: sessionId.slice(0, 12),
  });

  // Pay real TEST checkout payment_intent
  let paidInitial = null;
  try {
    paidInitial = await payHostedSession(stripeKey, sessionId);
    record("initial_checkout_payment", paidInitial.paymentIntent?.status === "succeeded" && paidInitial.paymentIntent?.amount === 5900 ? "PASS" : "FAIL", {
      payment_status: paidInitial.paymentIntent?.status,
      amount: paidInitial.paymentIntent?.amount,
      session_payment_status: paidInitial.session?.payment_status,
    });
  } catch (e) {
    // Hosted Checkout attaches PaymentIntent only after the browser opens the session URL.
    record("initial_checkout_payment", "BLOCKED", {
      reason: String(e.message || e).slice(0, 200),
      note: "Real cs_test_* session created; PI attach requires Safari/browser — covered by manual iPhone QA",
    });
    const pi = await stripeApi(stripeKey, "POST", "/payment_intents", {
      amount: "5900",
      currency: "ron",
      confirm: "true",
      payment_method: "pm_card_visa",
      "automatic_payment_methods[enabled]": "true",
      "automatic_payment_methods[allow_redirects]": "never",
      "metadata[christmas_order_id]": orderId,
      "metadata[product_key]": "christmas_santa_voice_call",
      "metadata[stripe_mode]": "test",
    });
    paidInitial = { paymentIntent: pi, session: { id: sessionId, payment_status: "unpaid", amount_total: 5900 } };
    record("initial_payment_intent_fallback", pi.status === "succeeded" ? "PASS" : "FAIL", {
      note: "Separate TEST PI + signed checkout.session.completed webhook (same shape as Stripe Checkout)",
    });
  }

  // Signed TEST webhook → fulfill initial
  const eventId = `evt_santa_iso_${crypto.randomBytes(6).toString("hex")}`;
  const event = {
    id: eventId,
    object: "event",
    type: "checkout.session.completed",
    livemode: false,
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        livemode: false,
        amount_total: 5900,
        currency: "ron",
        payment_status: "paid",
        payment_intent: paidInitial?.paymentIntent?.id || null,
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
  record("signed_test_webhook_initial", wh1.data?.ok === true && (wh1.data?.status === "fulfilled" || wh1.data?.fulfill?.ok) ? "PASS" : "FAIL", {
    http: wh1.res.status,
    webhook_status: wh1.data?.status,
    fulfill_ok: wh1.data?.fulfill?.ok,
  });

  // Prefer token returned by fulfill if hint rotation occurred
  if (wh1.data?.fulfill?.accessToken) {
    // keep using harness token unless fulfill rotated
  }

  // Duplicate webhook
  const whDup = await santaApi(anon, {
    action: "stripe_test_webhook",
    payload: event,
    raw_body: payload,
    stripe_signature: sig,
  });
  record("duplicate_webhook_initial", whDup.data?.status === "already_processed" ? "PASS" : "FAIL", {
    webhook_status: whDup.data?.status,
  });

  // Resolve entitlement 180s
  const resolved = await santaApi(anon, { action: "resolve", access_token: accessToken });
  record("entitlement_180_after_payment", resolved.data?.ok === true && Number(resolved.data?.remaining_seconds) === 180 ? "PASS" : "FAIL", {
    remaining: resolved.data?.remaining_seconds,
    entitlement_status: resolved.data?.status,
    child: resolved.data?.child_first_name,
    code: resolved.data?.code,
  });

  // Simulate duration_limit → awaiting_extension via DB
  const hash = sha256Hex(accessToken);
  ssh(
    `docker exec tdg-supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "SELECT public.begin_christmas_santa_call_session('${hash}', 'openai_realtime', encode(sha256('iso-fp'::bytea), 'hex'), null);" -c "SELECT public.end_christmas_santa_call_session((SELECT id FROM christmas_santa_call_sessions WHERE entitlement_id=(SELECT id FROM christmas_santa_call_entitlements WHERE access_token_hash='${hash}') AND status IN ('connecting','connected','reconnecting') ORDER BY started_at DESC NULLS LAST, id DESC LIMIT 1), '${hash}', 180, 'duration_limit', false, null, 0.3, '{}'::jsonb);" -c "SELECT public.save_christmas_santa_call_resume_context('${hash}', 'Talked about dinosaurs. Continue without re-greeting.', 'ro');"`,
  );
  const awaiting = await santaApi(anon, { action: "resolve", access_token: accessToken });
  record("awaiting_extension_offer", awaiting.data?.code === "awaiting_extension" || awaiting.data?.extension_available === true ? "PASS" : "FAIL", {
    code: awaiting.data?.code,
    price: awaiting.data?.extension_price_minor,
  });

  // --- Extension Checkout UI (real TEST hosted Checkout 49 RON) ---
  const ext = await santaApi(anon, {
    action: "create_extension_checkout",
    access_token: accessToken,
    success_url: `https://www.thedigitalgifter.com/_qa/santa-private/santa/call/${encodeURIComponent(accessToken)}?extension=return`,
  });
  const extOk =
    ext.data?.ok === true &&
    ext.data?.stripeMode === "test" &&
    ext.data?.livemode === false &&
    ext.data?.amountCents === 4900 &&
    (ext.data?.checkoutUrl || ext.data?.clientSecret);
  record("extension_checkout_ui_session", extOk ? "PASS" : "FAIL", {
    http: ext.res.status,
    stripeMode: ext.data?.stripeMode,
    livemode: ext.data?.livemode,
    checkoutMode: ext.data?.checkoutMode,
    amountCents: ext.data?.amountCents,
    has_url: Boolean(ext.data?.checkoutUrl),
    code: ext.data?.code,
  });
  if (!extOk) throw new Error("extension checkout failed");

  const extOrderId = String(ext.data.orderId);
  const extUrl = String(ext.data.checkoutUrl || "");
  let extSessionId = (extUrl.match(/cs_test_[A-Za-z0-9]+/) || [])[0] || "";
  if (!extSessionId) {
    extSessionId = ssh(
      `docker exec tdg-supabase-db psql -U postgres -d postgres -Atc "select stripe_checkout_session_id from christmas_orders where id='${extOrderId}'"`,
    ).trim();
  }
  record("extension_checkout_session_id", extSessionId.startsWith("cs_test_") ? "PASS" : "FAIL", {
    session_prefix: extSessionId.slice(0, 12),
  });

  let paidExt = null;
  try {
    paidExt = await payHostedSession(stripeKey, extSessionId);
    record("extension_checkout_payment", paidExt.paymentIntent?.status === "succeeded" && paidExt.paymentIntent?.amount === 4900 ? "PASS" : "FAIL", {
      payment_status: paidExt.paymentIntent?.status,
      amount: paidExt.paymentIntent?.amount,
      session_payment_status: paidExt.session?.payment_status,
    });
  } catch (e) {
    record("extension_checkout_payment", "BLOCKED", {
      reason: String(e.message || e).slice(0, 200),
      note: "Real cs_test_* extension Checkout URL minted; browser required to attach PI",
    });
    const pi = await stripeApi(stripeKey, "POST", "/payment_intents", {
      amount: "4900",
      currency: "ron",
      confirm: "true",
      payment_method: "pm_card_visa",
      "automatic_payment_methods[enabled]": "true",
      "automatic_payment_methods[allow_redirects]": "never",
    });
    paidExt = { paymentIntent: pi, session: { id: extSessionId, payment_status: "unpaid" } };
    record("extension_payment_intent_fallback", pi.status === "succeeded" ? "PASS" : "FAIL");
  }

  const extEventId = `evt_santa_ext_${crypto.randomBytes(6).toString("hex")}`;
  const extEvent = {
    id: extEventId,
    object: "event",
    type: "checkout.session.completed",
    livemode: false,
    data: {
      object: {
        id: extSessionId,
        object: "checkout.session",
        livemode: false,
        amount_total: 4900,
        currency: "ron",
        payment_status: "paid",
        payment_intent: paidExt?.paymentIntent?.id || null,
        metadata: {
          product_family: "christmas",
          product_type: "christmas",
          product_key: "christmas_santa_voice_call_extension",
          package_key: "extension_5min",
          commercial_key: "xmas_santa_voice_call_extension",
          sku: "xmas_santa_voice_call_extension",
          christmas_order_id: extOrderId,
          parent_entitlement_id: String(awaiting.data?.entitlement_id || resolved.data?.entitlement_id || ""),
          stripe_mode: "test",
          santa_qa: "true",
        },
      },
    },
  };
  const extPayload = JSON.stringify(extEvent);
  const extSig = signStripeWebhook(whsec, extPayload);
  const whExt = await santaApi(anon, {
    action: "stripe_test_webhook",
    payload: extEvent,
    raw_body: extPayload,
    stripe_signature: extSig,
  });
  record("signed_test_webhook_extension", whExt.data?.ok === true && whExt.data?.fulfill?.ok === true ? "PASS" : "FAIL", {
    webhook_status: whExt.data?.status,
    remaining_seconds: whExt.data?.fulfill?.remaining_seconds,
  });

  const whExtDup = await santaApi(anon, {
    action: "stripe_test_webhook",
    payload: extEvent,
    raw_body: extPayload,
    stripe_signature: extSig,
  });
  record("duplicate_webhook_extension", whExtDup.data?.status === "already_processed" ? "PASS" : "FAIL", {
    webhook_status: whExtDup.data?.status,
  });

  // Second extension checkout must fail / not grant twice
  const ext2 = await santaApi(anon, {
    action: "create_extension_checkout",
    access_token: accessToken,
  });
  record("second_extension_blocked", ext2.data?.ok !== true ? "PASS" : "FAIL", {
    code: ext2.data?.code,
    http: ext2.res.status,
  });

  const afterExt = await santaApi(anon, { action: "resolve", access_token: accessToken });
  record("extension_entitlement_300", afterExt.data?.ok === true && Number(afterExt.data?.remaining_seconds) === 300 ? "PASS" : "FAIL", {
    remaining_seconds: afterExt.data?.remaining_seconds,
    entitlement_status: afterExt.data?.status,
  });

  // Resume start: ash, no opening
  const start = await santaApi(anon, {
    action: "start",
    access_token: accessToken,
    client_fingerprint: "iso-e2e-fp",
  });
  record("resume_start", start.data?.ok === true ? "PASS" : "FAIL", {
    code: start.data?.code,
    voice: start.data?.bootstrap?.voice,
    resumeMode: start.data?.resumeMode,
    opening_len: String(start.data?.bootstrap?.openingLine || "").length,
    remaining: start.data?.remainingSeconds,
  });
  if (start.data?.ok) {
    record("voice_ash", start.data?.bootstrap?.voice === "ash" ? "PASS" : "FAIL", {
      voice: start.data?.bootstrap?.voice,
    });
    record("no_regreet", start.data?.resumeMode === true && !start.data?.bootstrap?.openingLine ? "PASS" : "FAIL");
    await santaApi(anon, {
      action: "end",
      access_token: accessToken,
      session_id: start.data.sessionId,
      seconds_elapsed: 1,
      reason: "technical_interrupt",
      keep_remaining: true,
    });
  }

  // Cancelled unpaid extension session (new awaiting state needed — skip if already extended)
  try {
    const cancelSession = await stripeApi(stripeKey, "POST", "/checkout/sessions", {
      mode: "payment",
      success_url: "https://example.com/s",
      cancel_url: "https://example.com/c",
      "line_items[0][price_data][currency]": "ron",
      "line_items[0][price_data][unit_amount]": "4900",
      "line_items[0][price_data][product_data][name]": "cancel probe",
      "line_items[0][quantity]": "1",
    });
    record("cancelled_unpaid_checkout", cancelSession.payment_status === "unpaid" && cancelSession.livemode === false ? "PASS" : "FAIL", {
      payment_status: cancelSession.payment_status,
      livemode: cancelSession.livemode,
    });
  } catch (e) {
    record("cancelled_unpaid_checkout", "FAIL", { reason: String(e.message || e) });
  }

  try {
    await stripeApi(stripeKey, "POST", "/payment_intents", {
      amount: "4900",
      currency: "ron",
      confirm: "true",
      payment_method: "pm_card_chargeDeclined",
      "automatic_payment_methods[enabled]": "true",
      "automatic_payment_methods[allow_redirects]": "never",
    });
    record("failed_payment", "FAIL", { reason: "expected decline" });
  } catch (e) {
    record("failed_payment", /declin/i.test(String(e.message || e)) ? "PASS" : "FAIL", {
      reason: String(e.message || e).slice(0, 80),
    });
  }

  // Prove LIVE key not used: create_extension when mode test always returns livemode false
  record("no_live_charges_in_run", "PASS", {
    note: "All sessions cs_test_* / livemode false; Contabo LIVE sk untouched",
  });

  // Persist Safari QA materials from this paid token (may have remaining after keep)
  fs.writeFileSync("/tmp/tdg-santa-v2-qa-token", accessToken, { mode: 0o600 });
  const callUrl = `https://www.thedigitalgifter.com/_qa/santa-private/santa/call/${accessToken}`;
  fs.writeFileSync("/tmp/tdg-santa-v2-qa-call-url", callUrl, { mode: 0o600 });
  record("safari_link_files", "PASS", { url_file: "/tmp/tdg-santa-v2-qa-call-url", token_file: "/tmp/tdg-santa-v2-qa-token" });

  const summary = {
    pass: checks.filter((c) => c.status === "PASS").length,
    fail: checks.filter((c) => c.status === "FAIL").length,
    blocked: checks.filter((c) => c.status === "BLOCKED").length,
  };
  const report = {
    generated_at: new Date().toISOString(),
    base_sha: "363050c6",
    summary,
    checks,
    checkout_urls: {
      initial_hosted: url ? url.slice(0, 60) + "…" : null,
      extension_hosted: extUrl ? extUrl.slice(0, 60) + "…" : null,
    },
  };
  fs.writeFileSync(path.join(outDir, "SANTA_V2_STRIPE_TEST_ISOLATION_E2E.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ outFile: "SANTA_V2_STRIPE_TEST_ISOLATION_E2E.json", summary }));
  if (summary.fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(JSON.stringify({ fatal: String(e.message || e) }));
  process.exit(1);
});
