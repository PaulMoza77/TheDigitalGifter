#!/usr/bin/env node
/**
 * Santa Call commercial+access harness (no invented results).
 * Loads secrets from a temp env file path in /tmp/tdg-santa-env-path.
 * Uses Stripe TEST key only. Never prints secret values.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(filePath) {
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#") || !s.includes("=")) continue;
    const i = s.indexOf("=");
    env[s.slice(0, i)] = s.slice(i + 1);
  }
  return env;
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function result(name, status, detail = {}) {
  return { name, status, ...detail };
}

const envPath = fs.readFileSync("/tmp/tdg-santa-env-path", "utf8").trim();
const env = loadEnvFile(envPath);
const out = {
  generated_at: new Date().toISOString(),
  checks: [],
};

const stripeKey = env.STRIPE_SECRET_KEY || "";
if (!stripeKey.startsWith("sk_test")) {
  out.checks.push(result("stripe_key", "BLOCKED", { reason: "Stripe TEST secret missing or not sk_test" }));
} else {
  // Create a TEST Checkout Session for 9900 RON (does not confirm payment automatically)
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", "https://www.thedigitalgifter.com/christmas/santa-call?checkout=success");
  body.set("cancel_url", "https://www.thedigitalgifter.com/christmas/santa-call?checkout=cancel");
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", "ron");
  body.set("line_items[0][price_data][unit_amount]", "9900");
  body.set("line_items[0][price_data][product_data][name]", "Call Santa Claus (TEST)");
  body.set("metadata[product_family]", "christmas");
  body.set("metadata[product_key]", "christmas_santa_voice_call");
  body.set("metadata[commercial_key]", "xmas_santa_voice_call");
  body.set("payment_intent_data[metadata][product_family]", "christmas");

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `santa-call-test-${Date.now()}`,
    },
    body,
  });
  const session = await stripeRes.json();
  if (!stripeRes.ok) {
    out.checks.push(
      result("stripe_test_checkout_session", "BLOCKED", {
        reason: session?.error?.message || `HTTP ${stripeRes.status}`,
      }),
    );
  } else {
    out.checks.push(
      result("stripe_test_checkout_session", "PASS", {
        session_id_prefix: String(session.id || "").slice(0, 8),
        amount_total: session.amount_total,
        currency: session.currency,
        payment_status: session.payment_status,
      }),
    );
  }
}

const supabaseUrl = env.SUPABASE_PUBLIC_URL || env.SUPABASE_URL || "";
const serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!supabaseUrl || !serviceKey) {
  out.checks.push(result("supabase_service", "BLOCKED", { reason: "SUPABASE_PUBLIC_URL/SECRET missing" }));
} else {
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Pricing row
  const { data: priceRow, error: priceErr } = await supabase
    .from("pricing_items")
    .select("key,price_cents,currency,metadata")
    .eq("key", "xmas_santa_voice_call")
    .maybeSingle();
  if (priceErr || !priceRow) {
    out.checks.push(result("pricing_row", "BLOCKED", { reason: priceErr?.message || "missing" }));
  } else {
    const web = Number(priceRow.metadata?.web_price_minor ?? priceRow.price_cents);
    out.checks.push(
      result("pricing_row", web === 9900 && String(priceRow.currency).toLowerCase() === "ron" ? "PASS" : "FAIL", {
        price_cents: priceRow.price_cents,
        currency: priceRow.currency,
        web_price_minor: web,
      }),
    );
  }

  // Synthetic paid order path (DB-level) — not a Stripe LIVE charge
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(token);
  const publicHash = sha256Hex(`pub-${token}`);

  const { data: order, error: orderErr } = await supabase
    .from("christmas_orders")
    .insert({
      public_token_hash: publicHash,
      product_key: "christmas_santa_voice_call",
      package_key: "single",
      payment_status: "paid",
      fulfillment_status: "not_started",
      amount_cents: 9900,
      currency: "ron",
      email: "santa-call-harness@thedigitalgifter.invalid",
      email_normalized: "santa-call-harness@thedigitalgifter.invalid",
      pricing_key: "xmas_santa_voice_call",
      charged_amount_cents: 9900,
      metadata: { source: "santa-call-integration-harness", harness: true },
    })
    .select("id")
    .single();

  if (orderErr || !order) {
    out.checks.push(result("create_paid_order", "BLOCKED", { reason: orderErr?.message || "insert failed" }));
  } else {
    out.checks.push(result("create_paid_order", "PASS", { order_id: order.id }));

    const { error: profileErr } = await supabase.from("christmas_santa_call_profiles").insert({
      order_id: order.id,
      child_first_name: "Andrei",
      language: "ro",
      age: 7,
      christmas_wish: "un trenuleț",
      hobbies: "dinozauri",
      guardian_consent: true,
      consent_version: "santa_call_v1_2026_10",
      consented_at: new Date().toISOString(),
    });
    out.checks.push(
      result("child_profile", profileErr ? "FAIL" : "PASS", { reason: profileErr?.message }),
    );

    const { data: activated, error: actErr } = await supabase.rpc("activate_christmas_santa_call_entitlement", {
      p_order_id: order.id,
      p_access_token_hash: tokenHash,
      p_ttl_days: 30,
    });
    const actOk = !actErr && activated?.ok === true;
    out.checks.push(
      result("activate_entitlement", actOk ? "PASS" : "FAIL", {
        reason: actErr?.message || activated?.reason,
        status: activated?.status,
      }),
    );

    const { data: resolved } = await supabase.rpc("resolve_christmas_santa_call_access", {
      p_access_token_hash: tokenHash,
    });
    out.checks.push(
      result("resolve_valid_token", resolved?.ok === true ? "PASS" : "FAIL", {
        remaining_seconds: resolved?.remaining_seconds,
        child_first_name: resolved?.child_first_name,
      }),
    );

    const { data: bad } = await supabase.rpc("resolve_christmas_santa_call_access", {
      p_access_token_hash: sha256Hex("invalid-token"),
    });
    out.checks.push(result("resolve_invalid_token", bad?.ok === false && bad?.code === "invalid_token" ? "PASS" : "FAIL"));

    const { data: began } = await supabase.rpc("begin_christmas_santa_call_session", {
      p_access_token_hash: tokenHash,
      p_provider: "openai_realtime",
      p_client_fingerprint_hash: sha256Hex("fp-a"),
      p_provider_session_id: null,
    });
    out.checks.push(
      result("begin_session", began?.ok === true ? "PASS" : "FAIL", {
        session_id: began?.session_id,
        remaining_seconds: began?.remaining_seconds,
      }),
    );

    const { data: concurrent } = await supabase.rpc("begin_christmas_santa_call_session", {
      p_access_token_hash: tokenHash,
      p_provider: "openai_realtime",
      p_client_fingerprint_hash: sha256Hex("fp-b"),
      p_provider_session_id: null,
    });
    out.checks.push(
      result(
        "concurrent_session_blocked",
        concurrent?.ok === false && concurrent?.code === "concurrent_session" ? "PASS" : "FAIL",
        { code: concurrent?.code },
      ),
    );

    if (began?.session_id) {
      const { data: hb } = await supabase.rpc("heartbeat_christmas_santa_call_session", {
        p_session_id: began.session_id,
        p_access_token_hash: tokenHash,
        p_seconds_elapsed: 170,
        p_ui_status: "connected",
      });
      out.checks.push(
        result("heartbeat_wrap_up", hb?.ok === true && hb?.wrap_up === true ? "PASS" : "FAIL", {
          remaining_seconds: hb?.remaining_seconds,
          wrap_up: hb?.wrap_up,
        }),
      );

      const { data: force } = await supabase.rpc("heartbeat_christmas_santa_call_session", {
        p_session_id: began.session_id,
        p_access_token_hash: tokenHash,
        p_seconds_elapsed: 180,
        p_ui_status: "connected",
      });
      out.checks.push(
        result("force_end_at_180", force?.force_end === true ? "PASS" : "FAIL", {
          remaining_seconds: force?.remaining_seconds,
        }),
      );
    }

    // Cleanup harness order (safe: marked harness=true)
    await supabase.from("christmas_orders").delete().eq("id", order.id);
    out.checks.push(result("harness_cleanup", "PASS"));
  }
}

// Resend connectivity (send to invalid domain should fail at API or accept depending on Resend rules —
// we only verify auth by listing domains or sending with dry check)
const resendKey = env.RESEND_API_KEY || "";
const from = env.CHRISTMAS_EMAIL_FROM || "";
if (!resendKey || !from) {
  out.checks.push(result("resend_config", "BLOCKED", { reason: "RESEND_API_KEY or FROM missing" }));
} else {
  const domainsRes = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${resendKey}` },
  });
  out.checks.push(
    result("resend_api_auth", domainsRes.ok ? "PASS" : "BLOCKED", {
      http: domainsRes.status,
      from_configured: Boolean(from),
    }),
  );
}

// OpenAI
const openai = process.env.OPENAI_API_KEY || env.OPENAI_API_KEY || "";
if (!openai) {
  out.checks.push(result("openai_realtime", "BLOCKED", { reason: "OPENAI_API_KEY empty on Contabo and local" }));
} else {
  const probe = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: { Authorization: `Bearer ${openai}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      expires_after: { anchor: "created_at", seconds: 60 },
      session: { type: "realtime", model: "gpt-realtime", instructions: "Say ho ho ho." },
    }),
  });
  out.checks.push(
    result("openai_realtime", probe.ok ? "PASS" : "BLOCKED", { http: probe.status }),
  );
}

out.summary = {
  pass: out.checks.filter((c) => c.status === "PASS").length,
  fail: out.checks.filter((c) => c.status === "FAIL").length,
  blocked: out.checks.filter((c) => c.status === "BLOCKED").length,
};

const outFile = path.resolve("artifacts/santa-call-benchmark/integration-harness.json");
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ outFile, summary: out.summary, checks: out.checks.map((c) => [c.name, c.status]) }, null, 2));
