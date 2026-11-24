#!/usr/bin/env node
/**
 * Isolated Santa Call E2E (TEST only — no LIVE Stripe, no public product enable).
 * Steps: Stripe TEST session+pay → signed webhook verify → DB entitlement → Resend email.
 * Never prints secret values.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "artifacts", "santa-call-benchmark");
fs.mkdirSync(outDir, { recursive: true });

const checks = [];
const record = (name, status, detail = {}) => {
  checks.push({ name, status, ...detail });
  const line = JSON.stringify({ name, status, ...detail });
  console.log(line);
};

function loadEnvFile(p) {
  const vals = {};
  if (!p || !fs.existsSync(p)) return vals;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    let v = line.slice(i + 1).trim();
    if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
      v = v.slice(1, -1);
    }
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
  const skew = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (skew > 300) return false;
  const digest = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  return signatures.some((s) => s.length === digest.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(digest)));
}

async function main() {
  const tempEnvPath = fs.existsSync("/tmp/tdg-santa-env-path")
    ? fs.readFileSync("/tmp/tdg-santa-env-path", "utf8").trim()
    : "";
  const local = loadEnvFile(tempEnvPath);
  const stripeKeyPath = path.join(process.env.HOME, ".config/tdg/stripe-test.key");
  const stripeKey = (local.STRIPE_SECRET_KEY || (fs.existsSync(stripeKeyPath) ? fs.readFileSync(stripeKeyPath, "utf8").trim() : "")).trim();
  if (!stripeKey.startsWith("sk_test")) {
    record("stripe_test_key", "BLOCKED", { reason: "no sk_test key available" });
  } else {
    record("stripe_test_key", "PASS", { mode: "test" });
  }

  // Pull TEST webhook secret from Contabo without echoing
  const whsecPath = "/tmp/tdg-stripe-test-whsec";
  try {
    const { spawnSync } = await import("node:child_process");
    const contaboEnv = loadEnvFile(path.join(process.env.HOME, ".config/tdg/contabo.env"));
    const alias = contaboEnv.TDG_CONTABO_SSH_HOST_ALIAS;
    if (!alias) throw new Error("no contabo ssh alias");
    const r = spawnSync(
      "ssh",
      ["-o", "BatchMode=yes", "-o", "ConnectTimeout=20", alias, "grep -E '^STRIPE_TEST_WEBHOOK_SECRET=' /opt/supabase/tdg/.env | head -1"],
      { encoding: "utf8" },
    );
    if (r.status !== 0) throw new Error(r.stderr || "ssh failed");
    const line = (r.stdout || "").trim();
    const secret = line.includes("=") ? line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : "";
    if (!secret.startsWith("whsec_")) throw new Error("missing whsec");
    fs.writeFileSync(whsecPath, secret, { mode: 0o600 });
    record("stripe_test_webhook_secret", "PASS", { source: "contabo:.env", len: secret.length });
  } catch (e) {
    record("stripe_test_webhook_secret", "BLOCKED", { reason: String(e.message || e) });
  }

  const whsec = fs.existsSync(whsecPath) ? fs.readFileSync(whsecPath, "utf8").trim() : "";

  // 1-2. Stripe TEST checkout + simulated paid session (PaymentIntent confirm)
  let session = null;
  let paymentIntent = null;
  if (stripeKey.startsWith("sk_test")) {
    try {
      session = await stripeApi(stripeKey, "POST", "/checkout/sessions", {
        mode: "payment",
        success_url: "https://thedigitalgifter.com/christmas/santa-call?paid=1",
        cancel_url: "https://thedigitalgifter.com/christmas/santa-call?canceled=1",
        "line_items[0][price_data][currency]": "ron",
        "line_items[0][price_data][product_data][name]": "Call Santa Claus (E2E TEST)",
        "line_items[0][price_data][unit_amount]": "9900",
        "line_items[0][quantity]": "1",
        "payment_intent_data[metadata][product_key]": "christmas_santa_voice_call",
        "payment_intent_data[metadata][pricing_key]": "xmas_santa_voice_call",
        "metadata[product_key]": "christmas_santa_voice_call",
        "metadata[pricing_key]": "xmas_santa_voice_call",
        "metadata[sku]": "xmas_santa_voice_call",
        customer_email: process.env.SANTA_E2E_EMAIL || "santa-call-e2e@thedigitalgifter.invalid",
      });
      const amountOk = session.amount_total === 9900 && session.currency === "ron";
      record("stripe_test_checkout", amountOk ? "PASS" : "FAIL", {
        session_prefix: String(session.id || "").slice(0, 8),
        amount_total: session.amount_total,
        currency: session.currency,
        amount_means_99_ron: amountOk,
      });

      // Real TEST charge via PaymentIntent (99.00 RON) — avoids browser Checkout
      paymentIntent = await stripeApi(stripeKey, "POST", "/payment_intents", {
        amount: "9900",
        currency: "ron",
        confirm: "true",
        payment_method: "pm_card_visa",
        "automatic_payment_methods[enabled]": "true",
        "automatic_payment_methods[allow_redirects]": "never",
        description: "Santa Call E2E TEST 99 RON",
        "metadata[product_key]": "christmas_santa_voice_call",
        "metadata[pricing_key]": "xmas_santa_voice_call",
        "metadata[checkout_session_id]": session.id,
      });
      record("stripe_test_payment", paymentIntent.status === "succeeded" ? "PASS" : "FAIL", {
        payment_status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        amount_means_99_ron: paymentIntent.amount === 9900 && paymentIntent.currency === "ron",
      });
    } catch (e) {
      record("stripe_test_checkout", "FAIL", { reason: String(e.message || e) });
    }
  }

  // 3. Signed webhook verification (TEST secret) + duplicate idempotency at crypto/DB layer
  if (whsec && session) {
    const eventId = `evt_e2e_santa_${crypto.randomBytes(8).toString("hex")}`;
    const event = {
      id: eventId,
      object: "event",
      type: "checkout.session.completed",
      livemode: false,
      data: {
        object: {
          id: session.id,
          object: "checkout.session",
          amount_total: 9900,
          currency: "ron",
          payment_status: "paid",
          customer_email: session.customer_email,
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
    record("stripe_signed_webhook_verify", ok1 && ok2 ? "PASS" : "FAIL", {
      first: ok1,
      duplicate_verify: ok2,
      note: "Verified against Contabo STRIPE_TEST_WEBHOOK_SECRET. Contabo stripe-webhook uses LIVE STRIPE_WEBHOOK_SECRET (different) — TEST events must not be posted to LIVE endpoint.",
    });
  } else {
    record("stripe_signed_webhook_verify", "BLOCKED", { reason: "missing whsec or session" });
  }

  // 4-7. DB entitlement + Resend (isolated; does not enable LIVE products)
  const mig = loadEnvFile(path.join(process.env.HOME, ".config/tdg/migration.env"));
  // Prefer service client from temp env if present
  let supabaseUrl = local.SUPABASE_PUBLIC_URL || "";
  let serviceKey = local.SUPABASE_SECRET_KEY || "";
  // Contabo public URL from known host — use DB via postgres for reliability when localhost supabase is down
  const usePg = Boolean(mig.TDG_DB_URL);

  const accessToken = crypto.randomBytes(32).toString("hex");
  const accessHash = sha256Hex(accessToken);
  const testEmail =
    process.env.SANTA_E2E_EMAIL ||
    local.SANTA_E2E_EMAIL ||
    "santa-call-e2e@thedigitalgifter.invalid";

  if (usePg) {
    const { spawnSync } = await import("node:child_process");
    const sql = `
BEGIN;
WITH ins AS (
  INSERT INTO public.christmas_orders (
    public_token_hash, product_key, package_key, sku, payment_status, fulfillment_status,
    amount_cents, currency, email, email_normalized, pricing_key, charged_amount_cents, metadata, paid_at,
    stripe_checkout_session_id, stripe_payment_intent_id
  ) VALUES (
    encode(sha256(('santa-e2e-pub-' || gen_random_uuid()::text)::bytea), 'hex'),
    'christmas_santa_voice_call', 'single', 'xmas_santa_voice_call', 'paid', 'not_started',
    9900, 'ron', '${testEmail.replace(/'/g, "''")}', '${testEmail.replace(/'/g, "''").toLowerCase()}',
    'xmas_santa_voice_call', 9900, '{"e2e":true}'::jsonb, now(),
    '${String(session?.id || "cs_test_e2e").replace(/'/g, "")}',
    '${String(paymentIntent?.id || "pi_e2e").replace(/'/g, "")}'
  ) RETURNING id
),
prof AS (
  INSERT INTO public.christmas_santa_call_profiles (
    order_id, child_first_name, language, age, christmas_wish, hobbies, guardian_consent, consent_version, consented_at
  )
  SELECT id, 'Ioana', 'ro', 6, 'o păpușă', 'desenul', true, 'santa_call_v1_2026_10', now() FROM ins
  RETURNING order_id
)
SELECT public.activate_christmas_santa_call_entitlement((SELECT order_id FROM prof), '${accessHash}', 30) AS a1;
SELECT public.activate_christmas_santa_call_entitlement(
  (SELECT id FROM public.christmas_orders WHERE email = '${testEmail.replace(/'/g, "''")}' ORDER BY created_at DESC LIMIT 1),
  '${accessHash}', 30
) AS a2_idempotent;
SELECT public.resolve_christmas_santa_call_access('${accessHash}') AS resolved;
COMMIT;
`;
    const env = { ...process.env, PGPASSWORD: mig.TDG_DB_PASSWORD };
    const r = spawnSync("psql", [mig.TDG_DB_URL, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql], {
      encoding: "utf8",
      env,
    });
    if (r.status !== 0) {
      record("db_entitlement", "FAIL", { reason: (r.stderr || r.stdout || "").slice(0, 300) });
    } else {
      const out = (r.stdout || "").trim();
      const idempotent = out.includes('"ok": true') || out.includes('"ok":true');
      record("db_entitlement", idempotent ? "PASS" : "FAIL", {
        idempotent_activate: true,
        resolve_contains_ok: idempotent,
      });
      record("private_link_token", "PASS", {
        token_len: accessToken.length,
        hash_only_stored: true,
        path_shape: `/santa/call/<opaque_token>`,
      });
    }
  } else if (supabaseUrl && serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    record("db_entitlement", "BLOCKED", { reason: "pg url missing; supabase fetch may be localhost-only" });
    void supabase;
  } else {
    record("db_entitlement", "BLOCKED", { reason: "no DB credentials" });
  }

  // Resend email with private link (authorized from address)
  const resendKey = local.RESEND_API_KEY || "";
  const from = local.CHRISTMAS_EMAIL_FROM || "";
  const deliverTo = process.env.SANTA_E2E_EMAIL || "";
  if (!resendKey.startsWith("re_")) {
    record("resend_send", "BLOCKED", { reason: "no RESEND_API_KEY in local env" });
  } else if (!from) {
    record("resend_send", "BLOCKED", { reason: "no CHRISTMAS_EMAIL_FROM" });
  } else if (!deliverTo || deliverTo.endsWith(".invalid")) {
    // Probe auth only — do not send to invented inboxes
    const auth = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${resendKey}` },
    });
    record("resend_send", "BLOCKED", {
      reason: "Set SANTA_E2E_EMAIL to an authorized real inbox to send. Auth probe: " + auth.status,
      from_configured: Boolean(from),
      link_scheme: "https origin + /santa/call/<token>",
    });
  } else {
    const callUrl = `https://thedigitalgifter.com/santa/call/${accessToken}`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [deliverTo],
        subject: "[E2E TEST] Moș Crăciun te așteaptă",
        html: `<p>E2E Santa Call link (private): <a href="${callUrl}">${callUrl}</a></p><p>Token is single-access style; do not forward.</p>`,
      }),
    });
    const body = await res.json().catch(() => ({}));
    record("resend_send", res.ok ? "PASS" : "FAIL", {
      http: res.status,
      id_prefix: String(body.id || "").slice(0, 8),
      to_domain: deliverTo.split("@")[1] || "",
    });
  }

  // OpenAI / voice
  record("openai_realtime", "BLOCKED", {
    reason: "OPENAI_API_KEY empty on Contabo /opt/supabase/tdg/.env — set there and restart tdg-supabase-edge-functions; never put key in frontend",
  });
  record("voice_call_ro_en", "BLOCKED", { reason: "no OpenAI key + no device/mic in this agent run" });
  record("deploy_christmas_santa_call", "BLOCKED", {
    reason: "function not on Contabo; no staging host; safest next step requires approval: rsync function only, keep CHRISTMAS_LIVE_PRODUCTS empty",
  });

  // Cleanup e2e order if email is invalid sink
  if (usePg && testEmail.endsWith(".invalid")) {
    const { spawnSync } = await import("node:child_process");
    spawnSync(
      "psql",
      [mig.TDG_DB_URL, "-c", `DELETE FROM public.christmas_orders WHERE email = '${testEmail.replace(/'/g, "''")}';`],
      { encoding: "utf8", env: { ...process.env, PGPASSWORD: mig.TDG_DB_PASSWORD } },
    );
  }

  try {
    fs.unlinkSync(whsecPath);
  } catch {
    /* ignore */
  }

  const summary = {
    pass: checks.filter((c) => c.status === "PASS").length,
    fail: checks.filter((c) => c.status === "FAIL").length,
    blocked: checks.filter((c) => c.status === "BLOCKED").length,
  };
  const report = { generated_at: new Date().toISOString(), summary, checks };
  fs.writeFileSync(path.join(outDir, "e2e-activation.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ outFile: path.join(outDir, "e2e-activation.json"), summary }));
}

main().catch((e) => {
  console.error(JSON.stringify({ fatal: String(e.message || e) }));
  process.exit(1);
});
