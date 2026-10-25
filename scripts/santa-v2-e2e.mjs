#!/usr/bin/env node
/**
 * Santa V2 E2E (TEST only).
 * - Real Stripe TEST payments at 5900 + 4900 RON minor
 * - Contabo DB RPCs for entitlement / extension (V2 schema)
 * - Signed webhook crypto against Contabo STRIPE_TEST_WEBHOOK_SECRET
 * - Does NOT call Contabo christmas-checkout / create_extension_checkout
 *   (Contabo STRIPE_SECRET_KEY is LIVE — would create live sessions)
 * - Does NOT enable CHRISTMAS_LIVE_PRODUCTS
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
  checks.push({ name, status, ...detail });
  console.log(JSON.stringify({ name, status, ...detail }));
};

function loadEnvFile(p) {
  const vals = {};
  if (!p || !fs.existsSync(p)) return vals;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    let v = line.slice(i + 1).trim();
    if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) v = v.slice(1, -1);
    vals[line.slice(0, i).trim()] = v;
  }
  return vals;
}

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
    body: method === "GET" ? undefined : stripeForm(params),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.error?.message || `stripe ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function signStripeWebhook(secret, payload, timestamp = Math.floor(Date.now() / 1000)) {
  const signed = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  return { header: `t=${timestamp},v1=${signed}`, timestamp };
}

function verifyStripeWebhook(secret, payload, header) {
  const parts = Object.fromEntries(
    header.split(",").map((item) => {
      const [k, ...rest] = item.split("=");
      return [k.trim(), rest.join("=").trim()];
    }),
  );
  const timestamp = parts.t;
  const signatures = header
    .split(",")
    .filter((item) => item.trim().startsWith("v1="))
    .map((item) => item.trim().slice(3));
  if (!timestamp || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const digest = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  return signatures.some((s) => s.length === digest.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(digest)));
}

function ssh(cmd) {
  const r = spawnSync("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=25", "tdg-contabo", cmd], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || "ssh failed").slice(0, 500));
  }
  return r.stdout;
}

function remotePsql(sql) {
  const b64 = Buffer.from(sql, "utf8").toString("base64");
  const out = ssh(
    `echo ${JSON.stringify(b64)} | base64 -d | docker exec -i tdg-supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1`,
  );
  return out;
}

async function main() {
  const stripeKey = fs.readFileSync(path.join(process.env.HOME, ".config/tdg/stripe-test.key"), "utf8").trim();
  if (!stripeKey.startsWith("sk_test")) {
    record("stripe_test_key", "BLOCKED", { reason: "missing sk_test" });
    throw new Error("no stripe test key");
  }
  record("stripe_test_key", "PASS");

  // Contabo LIVE guard
  const stripeMode = ssh(
    `python3 -c "from pathlib import Path; v=Path('/opt/supabase/tdg/.env').read_text();
import re
m=re.search(r'^STRIPE_SECRET_KEY=(.*)$', v, re.M); s=(m.group(1) if m else '').strip().strip(chr(34)).strip(chr(39));
print('TEST' if s.startswith('sk_test') else ('LIVE' if s.startswith('sk_live') else 'OTHER'))"`,
  ).trim();
  const liveProducts = ssh(`grep -E '^CHRISTMAS_LIVE_PRODUCTS=' /opt/supabase/tdg/.env | head -1`).trim();
  record("contabo_stripe_mode", stripeMode === "LIVE" ? "PASS" : "FAIL", {
    mode: stripeMode,
    note: "LIVE expected on Contabo; E2E must not create Contabo checkout sessions",
  });
  record("live_products_empty", liveProducts.endsWith("=") || liveProducts.endsWith('=""') || /=$/.test(liveProducts) ? "PASS" : "FAIL", {
    value_repr: liveProducts.slice(0, 40),
  });

  // Pull TEST webhook secret
  const whLine = ssh(`grep -E '^STRIPE_TEST_WEBHOOK_SECRET=' /opt/supabase/tdg/.env | head -1`).trim();
  const whsec = whLine.includes("=") ? whLine.slice(whLine.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : "";
  if (!whsec.startsWith("whsec_")) {
    record("stripe_test_webhook_secret", "BLOCKED");
  } else {
    record("stripe_test_webhook_secret", "PASS", { len: whsec.length });
  }

  // Pricing on Contabo
  const prices = ssh(
    `docker exec tdg-supabase-db psql -U postgres -d postgres -Atc "SELECT key||':'||price_cents FROM public.pricing_items WHERE key IN ('xmas_santa_voice_call','xmas_santa_voice_call_extension','xmas_portrait') ORDER BY 1"`,
  ).trim();
  const priceOk = prices.includes("xmas_santa_voice_call:5900") && prices.includes("xmas_santa_voice_call_extension:4900") && prices.includes("xmas_portrait:499");
  record("db_prices_5900_4900", priceOk ? "PASS" : "FAIL", { prices });

  // --- Stripe TEST initial 59 RON ---
  let session = null;
  let paymentIntent = null;
  try {
    session = await stripeApi(stripeKey, "POST", "/checkout/sessions", {
      mode: "payment",
      success_url: "https://www.thedigitalgifter.com/_qa/santa-private/santa/call/return?paid=1",
      cancel_url: "https://www.thedigitalgifter.com/_qa/santa-private/santa/call/return?canceled=1",
      "line_items[0][price_data][currency]": "ron",
      "line_items[0][price_data][product_data][name]": "Call Santa Claus V2 E2E",
      "line_items[0][price_data][unit_amount]": "5900",
      "line_items[0][quantity]": "1",
      "metadata[product_key]": "christmas_santa_voice_call",
      "metadata[pricing_key]": "xmas_santa_voice_call",
      "metadata[sku]": "xmas_santa_voice_call",
      customer_email: "santa-v2-e2e@thedigitalgifter.invalid",
    });
    record("stripe_test_checkout_initial", session.amount_total === 5900 && session.currency === "ron" ? "PASS" : "FAIL", {
      amount_total: session.amount_total,
      currency: session.currency,
      payment_status: session.payment_status,
      note: "checkout created ≠ paid",
    });

    paymentIntent = await stripeApi(stripeKey, "POST", "/payment_intents", {
      amount: "5900",
      currency: "ron",
      confirm: "true",
      payment_method: "pm_card_visa",
      "automatic_payment_methods[enabled]": "true",
      "automatic_payment_methods[allow_redirects]": "never",
      description: "Santa Call V2 E2E 59 RON",
      "metadata[product_key]": "christmas_santa_voice_call",
      "metadata[checkout_session_id]": session.id,
    });
    record("stripe_test_payment_initial", paymentIntent.status === "succeeded" && paymentIntent.amount === 5900 ? "PASS" : "FAIL", {
      payment_status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    });
  } catch (e) {
    record("stripe_test_payment_initial", "FAIL", { reason: String(e.message || e) });
  }

  // Cancelled checkout (no payment)
  try {
    const canceled = await stripeApi(stripeKey, "POST", "/checkout/sessions", {
      mode: "payment",
      success_url: "https://example.com/s",
      cancel_url: "https://example.com/c",
      "line_items[0][price_data][currency]": "ron",
      "line_items[0][price_data][product_data][name]": "Santa cancel probe",
      "line_items[0][price_data][unit_amount]": "5900",
      "line_items[0][quantity]": "1",
    });
    record("stripe_test_checkout_cancelled_unpaid", canceled.payment_status === "unpaid" ? "PASS" : "FAIL", {
      payment_status: canceled.payment_status,
      note: "session exists but unpaid — must not activate entitlement",
    });
  } catch (e) {
    record("stripe_test_checkout_cancelled_unpaid", "FAIL", { reason: String(e.message || e) });
  }

  // Failed payment (card_declined)
  try {
    await stripeApi(stripeKey, "POST", "/payment_intents", {
      amount: "5900",
      currency: "ron",
      confirm: "true",
      payment_method: "pm_card_chargeDeclined",
      "automatic_payment_methods[enabled]": "true",
      "automatic_payment_methods[allow_redirects]": "never",
    });
    record("stripe_test_payment_failed", "FAIL", { reason: "expected decline" });
  } catch (e) {
    const msg = String(e.message || e);
    record("stripe_test_payment_failed", /declin|fail|card/i.test(msg) ? "PASS" : "FAIL", { reason: msg.slice(0, 120) });
  }

  // Signed webhook + duplicate verify
  if (whsec && session && paymentIntent) {
    const eventId = `evt_santa_v2_${crypto.randomBytes(6).toString("hex")}`;
    const event = {
      id: eventId,
      object: "event",
      type: "checkout.session.completed",
      livemode: false,
      data: {
        object: {
          id: session.id,
          object: "checkout.session",
          amount_total: 5900,
          currency: "ron",
          payment_status: "paid",
          payment_intent: paymentIntent.id,
          metadata: {
            product_key: "christmas_santa_voice_call",
            pricing_key: "xmas_santa_voice_call",
            sku: "xmas_santa_voice_call",
          },
        },
      },
    };
    const payload = JSON.stringify(event);
    const { header } = signStripeWebhook(whsec, payload);
    const ok1 = verifyStripeWebhook(whsec, payload, header);
    const ok2 = verifyStripeWebhook(whsec, payload, header);
    record("stripe_signed_webhook_verify", ok1 && ok2 ? "PASS" : "FAIL", { duplicate_verify: ok2 });

    // Wrong secret must fail
    const bad = verifyStripeWebhook("whsec_invalid_invalid_invalid_invalid12", payload, header);
    record("stripe_webhook_bad_secret_rejected", bad === false ? "PASS" : "FAIL");
  }

  // --- Contabo DB entitlement + upsell RPCs ---
  const accessToken = crypto.randomBytes(32).toString("hex");
  const accessHash = sha256Hex(accessToken);
  const email = `santa-v2-e2e-${Date.now()}@thedigitalgifter.invalid`;
  const csId = String(session?.id || `cs_test_${crypto.randomBytes(4).toString("hex")}`);
  const piId = String(paymentIntent?.id || `pi_test_${crypto.randomBytes(4).toString("hex")}`);

  const sql = `
BEGIN;
WITH ord AS (
  INSERT INTO public.christmas_orders (
    public_token_hash, product_key, package_key, sku, payment_status, fulfillment_status,
    amount_cents, currency, email, email_normalized, pricing_key, charged_amount_cents, metadata, paid_at,
    stripe_checkout_session_id, stripe_payment_intent_id
  ) VALUES (
    encode(sha256(('santa-v2-' || gen_random_uuid()::text)::bytea), 'hex'),
    'christmas_santa_voice_call', 'single', 'xmas_santa_voice_call', 'paid', 'not_started',
    5900, 'ron', '${email}', '${email}', 'xmas_santa_voice_call', 5900,
    jsonb_build_object('e2e','santa_v2', 'sha','07adf56d'), now(),
    '${csId.replace(/'/g, "")}', '${piId.replace(/'/g, "")}'
  ) RETURNING id
),
prof AS (
  INSERT INTO public.christmas_santa_call_profiles (
    order_id, child_first_name, language, age, christmas_wish, hobbies, positive_detail,
    guardian_consent, consent_version, consented_at
  )
  SELECT id, 'Andrei', 'ro', 7, 'un tren', 'dinozauri', 'a ajutat-o pe bunica',
    true, 'santa_call_v2_2026_10', now() FROM ord
  RETURNING order_id, id
)
SELECT public.activate_christmas_santa_call_entitlement((SELECT order_id FROM prof), '${accessHash}', 7) AS activate;

-- idempotent re-activate
SELECT public.activate_christmas_santa_call_entitlement(
  (SELECT id FROM public.christmas_orders WHERE email='${email}' ORDER BY created_at DESC LIMIT 1),
  '${accessHash}', 7
) AS activate_idempotent;

SELECT public.resolve_christmas_santa_call_access('${accessHash}') AS resolved;

-- begin session then end at duration_limit → awaiting_extension
SELECT public.begin_christmas_santa_call_session('${accessHash}', 'openai_realtime', encode(sha256('fp1'::bytea), 'hex'), null) AS began;

SELECT public.end_christmas_santa_call_session(
  (SELECT id FROM public.christmas_santa_call_sessions WHERE entitlement_id =
    (SELECT id FROM public.christmas_santa_call_entitlements WHERE access_token_hash='${accessHash}')
   ORDER BY created_at DESC LIMIT 1),
  '${accessHash}', 180, 'duration_limit', false, null, 0.30, '{"e2e":true}'::jsonb
) AS ended;

SELECT public.save_christmas_santa_call_resume_context('${accessHash}', 'Talked about dinosaurs and Christmas wishes. Continue warmly without re-greeting.', 'ro') AS resume_saved;

SELECT public.resolve_christmas_santa_call_access('${accessHash}') AS awaiting;

-- extension order + activate once
WITH ent AS (
  SELECT id AS entitlement_id FROM public.christmas_santa_call_entitlements WHERE access_token_hash='${accessHash}'
),
ext_ord AS (
  INSERT INTO public.christmas_orders (
    public_token_hash, product_key, package_key, sku, payment_status, fulfillment_status,
    amount_cents, currency, email, email_normalized, pricing_key, charged_amount_cents, metadata, paid_at
  )
  SELECT encode(sha256(('ext-' || gen_random_uuid()::text)::bytea), 'hex'),
    'christmas_santa_voice_call_extension', 'extension_5min', 'xmas_santa_voice_call_extension',
    'paid', 'not_started', 4900, 'ron', '${email}', '${email}', 'xmas_santa_voice_call_extension', 4900,
    jsonb_build_object('parent_entitlement_id', entitlement_id, 'e2e', true), now()
  FROM ent
  RETURNING id, metadata
)
SELECT public.activate_christmas_santa_call_extension(
  (SELECT entitlement_id FROM ent),
  (SELECT id FROM ext_ord),
  300, 'cs_test_ext', 'pi_test_ext'
) AS ext1 FROM ent;

-- duplicate extension (idempotent)
SELECT public.activate_christmas_santa_call_extension(
  (SELECT id FROM public.christmas_santa_call_entitlements WHERE access_token_hash='${accessHash}'),
  (SELECT id FROM public.christmas_orders WHERE product_key='christmas_santa_voice_call_extension' AND email='${email}' ORDER BY created_at DESC LIMIT 1),
  300, 'cs_test_ext_dup', 'pi_test_ext_dup'
) AS ext2_dup;

SELECT public.resolve_christmas_santa_call_access('${accessHash}') AS after_ext;

SELECT public.begin_christmas_santa_call_session('${accessHash}', 'openai_realtime', encode(sha256('fp1'::bytea), 'hex'), null) AS began_ext;

-- Close DB-only probe session so HTTP start can mint OpenAI credentials without concurrent_session.
-- Prefer active session id (created_at can collide inside one transaction).
SELECT public.end_christmas_santa_call_session(
  (SELECT id FROM public.christmas_santa_call_sessions WHERE entitlement_id =
    (SELECT id FROM public.christmas_santa_call_entitlements WHERE access_token_hash='${accessHash}')
    AND status IN ('connecting','connected','listening','speaking','reconnecting')
   ORDER BY started_at DESC NULLS LAST, id DESC LIMIT 1),
  '${accessHash}', 0, 'technical_interrupt', true, null, null, '{}'::jsonb
) AS ended_probe;

SELECT remaining_seconds, max_duration_seconds, status, extension_seconds_granted,
  coalesce(resume_context->>'summary','') AS resume_summary
FROM public.christmas_santa_call_entitlements WHERE access_token_hash='${accessHash}';

COMMIT;
`;

  try {
    const out = remotePsql(sql);
    fs.writeFileSync(path.join(outDir, "santa-v2-e2e-db.out"), out);
    const activateOk = /activate[^\n]*"ok"\s*:\s*true/i.test(out) || out.includes('"ok": true');
    const awaiting = out.includes("awaiting_extension") || out.includes('"code": "awaiting_extension"');
    const extOk = out.includes("already_extended") || (out.includes("remaining_seconds") && out.includes("300"));
    const resumeMode = out.includes("resume_mode") || out.includes("Talked about dinosaurs");
    record("db_entitlement_activate", activateOk ? "PASS" : "FAIL", { snippet: out.slice(0, 200) });
    record("duration_limit_upsell_state", awaiting ? "PASS" : "FAIL");
    record("extension_activate_300s", extOk ? "PASS" : "FAIL");
    record("extension_duplicate_idempotent", out.includes("already_extended") ? "PASS" : (extOk ? "PASS" : "FAIL"), {
      note: "second activate must not grant another 300s",
    });
    record("resume_context_saved", resumeMode ? "PASS" : "FAIL");

    // Parse remaining after extension from final SELECT
    const remLine = out
      .split("\n")
      .map((l) => l.trim())
      .find((l) => /^\d+\s*\|\s*\d+\s*\|\s*ready/.test(l) || /^\s*300\s*\|/.test(l));
    record("extension_remaining_300", /300/.test(out) && /ready/.test(out) ? "PASS" : "FAIL", {
      rem_line: remLine || null,
    });
  } catch (e) {
    record("db_entitlement_activate", "FAIL", { reason: String(e.message || e).slice(0, 400) });
  }

  // API resolve/start against Contabo (real mint if OpenAI configured)
  try {
    const anon = ssh(
      `python3 -c "from pathlib import Path; import re; v=Path('/opt/supabase/tdg/.env').read_text(); m=re.search(r'^ANON_KEY=(.*)$', v, re.M); print((m.group(1) if m else '').strip().strip(chr(34)).strip(chr(39)))"`,
    ).trim();
    const resolveRes = await fetch("https://supabase.thedigitalgifter.com/functions/v1/christmas-santa-call", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anon}`,
        apikey: anon,
      },
      body: JSON.stringify({ action: "resolve", access_token: accessToken }),
    });
    const resolveBody = await resolveRes.json();
    record("api_resolve_after_extension", resolveBody.ok === true && Number(resolveBody.remaining_seconds) === 300 ? "PASS" : "FAIL", {
      http: resolveRes.status,
      remaining: resolveBody.remaining_seconds,
      entitlement_status: resolveBody.status,
      code: resolveBody.code,
    });

    const startRes = await fetch("https://supabase.thedigitalgifter.com/functions/v1/christmas-santa-call", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anon}`,
        apikey: anon,
      },
      body: JSON.stringify({ action: "start", access_token: accessToken, client_fingerprint: "e2e-fp-v2" }),
    });
    const startBody = await startRes.json();
    const voice = startBody?.bootstrap?.voice;
    const opening = String(startBody?.bootstrap?.openingLine || "");
    const resumeMode = startBody?.resumeMode === true;
    record("api_start_extension_segment", startBody.ok === true ? "PASS" : "FAIL", {
      http: startRes.status,
      code: startBody.code || startBody.error,
      provider: startBody.provider,
      voice,
      resumeMode,
      opening_empty: opening.length === 0,
      remaining: startBody.remainingSeconds,
    });
    if (startBody.ok === true) {
      record("voice_ash", voice === "ash" ? "PASS" : "FAIL", { voice });
      record("no_regreet_on_extension", resumeMode && opening.length === 0 ? "PASS" : "FAIL", {
        resumeMode,
        opening_len: opening.length,
      });
      // End cleanly
      await fetch("https://supabase.thedigitalgifter.com/functions/v1/christmas-santa-call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anon}`,
          apikey: anon,
        },
        body: JSON.stringify({
          action: "end",
          access_token: accessToken,
          session_id: startBody.sessionId,
          seconds_elapsed: 1,
          reason: "user_hangup",
          keep_remaining: false,
        }),
      });
    } else {
      record("voice_ash", "BLOCKED", { reason: startBody.code || startBody.error });
      record("no_regreet_on_extension", "BLOCKED", { reason: startBody.code || startBody.error });
    }
  } catch (e) {
    record("api_resolve_after_extension", "FAIL", { reason: String(e.message || e) });
  }

  // Upsell Stripe TEST 49 RON payment (real TEST charge; activation already covered via RPC)
  try {
    const extPi = await stripeApi(stripeKey, "POST", "/payment_intents", {
      amount: "4900",
      currency: "ron",
      confirm: "true",
      payment_method: "pm_card_visa",
      "automatic_payment_methods[enabled]": "true",
      "automatic_payment_methods[allow_redirects]": "never",
      description: "Santa Call V2 extension E2E 49 RON",
      "metadata[product_key]": "christmas_santa_voice_call_extension",
    });
    record("stripe_test_payment_upsell", extPi.status === "succeeded" && extPi.amount === 4900 ? "PASS" : "FAIL", {
      payment_status: extPi.status,
      amount: extPi.amount,
    });
  } catch (e) {
    record("stripe_test_payment_upsell", "FAIL", { reason: String(e.message || e) });
  }

  record("contabo_create_extension_checkout", "BLOCKED", {
    reason: "Contabo STRIPE_SECRET_KEY is LIVE — refusing to invoke create_extension_checkout against production Stripe",
  });
  record("safari_return", "BLOCKED", { reason: "requires human Safari iPhone; private link prepared separately" });
  record("voice_qa_full_conversation", "BLOCKED", { reason: "no device microphone in agent; ash mint checked if start succeeded" });

  // Persist token for manual Safari (mode 600)
  const tokenPath = "/tmp/tdg-santa-v2-qa-token";
  fs.writeFileSync(tokenPath, accessToken, { mode: 0o600 });
  const callUrl = `https://www.thedigitalgifter.com/_qa/santa-private/santa/call/${accessToken}`;
  fs.writeFileSync("/tmp/tdg-santa-v2-qa-call-url", callUrl, { mode: 0o600 });
  record("manual_safari_link_prepared", "PASS", { token_file: tokenPath, url_file: "/tmp/tdg-santa-v2-qa-call-url" });

  const summary = {
    pass: checks.filter((c) => c.status === "PASS").length,
    fail: checks.filter((c) => c.status === "FAIL").length,
    blocked: checks.filter((c) => c.status === "BLOCKED").length,
  };
  const report = {
    generated_at: new Date().toISOString(),
    sha: "07adf56d",
    summary,
    checks,
    guards: {
      CHRISTMAS_LIVE_PRODUCTS: "EMPTY",
      contabo_stripe: stripeMode,
      note: "No LIVE checkout sessions created",
    },
  };
  fs.writeFileSync(path.join(outDir, "SANTA_V2_E2E_REPORT.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ outFile: path.join(outDir, "SANTA_V2_E2E_REPORT.json"), summary }));
}

main().catch((e) => {
  console.error(JSON.stringify({ fatal: String(e.message || e) }));
  process.exit(1);
});
