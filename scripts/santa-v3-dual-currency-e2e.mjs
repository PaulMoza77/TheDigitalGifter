#!/usr/bin/env node
/**
 * Santa Funnel V3 — dual-currency Stripe TEST session proof (RO RON + US USD).
 * Requires Contabo edge with santaCallPricing market map deployed.
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

async function stripeApi(key, method, apiPath) {
  const res = await fetch(`https://api.stripe.com/v1${apiPath}`, {
    method,
    headers: { Authorization: `Bearer ${key}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `stripe ${res.status}`);
  return data;
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

async function main() {
  const stripeKey = fs.readFileSync(path.join(process.env.HOME, ".config/tdg/stripe-test.key"), "utf8").trim();
  const qaSecret = fs.readFileSync("/tmp/tdg-santa-qa-secret", "utf8").trim();
  if (!stripeKey.startsWith("sk_test_") || qaSecret.length < 16) {
    record("preflight_secrets", "BLOCKED");
    throw new Error("missing test secrets");
  }
  record("preflight_secrets", "PASS");

  const anon = await anonKey();
  const cases = [
    { market: "ro", currency: "ron", amountCents: 5900, language: "ro" },
    { market: "us", currency: "usd", amountCents: 1299, language: "en" },
  ];

  for (const c of cases) {
    const { res, data } = await santaApi(
      anon,
      {
        action: "create_qa_checkout",
        market: c.market,
        currency: c.currency,
        amount_cents: c.amountCents,
        language: c.language,
        child_first_name: "Andrei",
        email: `santa-v3-${c.market}@thedigitalgifter.invalid`,
      },
      { "X-Santa-QA-Secret": qaSecret },
    );
    if (!res.ok || data?.ok !== true) {
      record(`qa_checkout_${c.market}`, "FAIL", { http: res.status, code: data?.code, data });
      continue;
    }
    const sessionIdMatch = String(data.checkoutUrl || "").match(/cs_test_[A-Za-z0-9]+/);
    let session = null;
    if (data.clientSecret) {
      // custom mode — retrieve by expanding from order via Stripe list is harder; use checkoutUrl if hosted
    }
    if (sessionIdMatch) {
      session = await stripeApi(stripeKey, "GET", `/checkout/sessions/${sessionIdMatch[0]}`);
    } else if (data.orderId) {
      // Hosted may return url; custom may only return client_secret — verify response body amounts.
    }
    const amountOk = Number(data.amountCents) === c.amountCents;
    const currencyOk = String(data.currency || "").toLowerCase() === c.currency;
    const marketOk = !data.market || data.market === c.market;
    const stripeAmountOk = session
      ? Number(session.amount_total) === c.amountCents && String(session.currency).toLowerCase() === c.currency
      : null;
    record(`qa_checkout_${c.market}`, amountOk && currencyOk && marketOk ? "PASS" : "FAIL", {
      orderId: data.orderId,
      amountCents: data.amountCents,
      currency: data.currency,
      market: data.market,
      stripeAmountOk,
      livemode: data.livemode,
    });
  }

  const report = {
    sha: spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim(),
    at: new Date().toISOString(),
    checks,
    pass: checks.every((c) => c.status === "PASS"),
  };
  const out = path.join(outDir, "SANTA_V3_DUAL_CURRENCY_E2E.json");
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log("wrote", out, "pass=", report.pass);
  if (!report.pass) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
