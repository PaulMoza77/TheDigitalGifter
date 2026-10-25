#!/usr/bin/env node
/**
 * Mint a fresh private Santa V2 Safari QA session (TEST Stripe fulfill, 180s ready).
 * Writes private URL + QR; never prints the raw token to stdout.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "artifacts", "santa-call-benchmark");
fs.mkdirSync(outDir, { recursive: true });

function ssh(cmd) {
  const r = spawnSync("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=25", "tdg-contabo", cmd], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || "ssh failed").slice(0, 400));
  return r.stdout;
}

function signStripeWebhook(secret, payload, timestamp = Math.floor(Date.now() / 1000)) {
  const signed = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  return `t=${timestamp},v1=${signed}`;
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

async function main() {
  const qaSecret = fs.readFileSync("/tmp/tdg-santa-qa-secret", "utf8").trim();
  const whLine = ssh(`grep -E '^STRIPE_TEST_WEBHOOK_SECRET=' /opt/supabase/tdg/.env | head -1`).trim();
  const whsec = whLine.slice(whLine.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
  const anon = await anonKey();

  const qa = await santaApi(
    anon,
    {
      action: "create_qa_checkout",
      child_first_name: "Maya",
      language: "ro",
      hobbies: "desenul și poveștile",
      christmas_wish: "culori și un caiet",
      positive_detail: "ajută la treburile casei",
    },
    { "x-santa-qa-secret": qaSecret },
  );
  if (!qa.data?.ok || !qa.data?.accessToken || !qa.data?.orderId) {
    throw new Error(`create_qa_checkout failed: ${qa.res.status} ${JSON.stringify(qa.data).slice(0, 300)}`);
  }

  const accessToken = String(qa.data.accessToken);
  const orderId = String(qa.data.orderId);
  const url = String(qa.data.checkoutUrl || "");
  const sessionId = (url.match(/cs_test_[A-Za-z0-9]+/) || [])[0] || "";

  const event = {
    id: `evt_safari_qa_${crypto.randomBytes(6).toString("hex")}`,
    object: "event",
    type: "checkout.session.completed",
    livemode: false,
    data: {
      object: {
        id: sessionId || `cs_test_safari_${crypto.randomBytes(4).toString("hex")}`,
        object: "checkout.session",
        livemode: false,
        amount_total: 5900,
        currency: "ron",
        payment_status: "paid",
        payment_intent: null,
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
  const wh = await santaApi(anon, {
    action: "stripe_test_webhook",
    payload: event,
    raw_body: payload,
    stripe_signature: sig,
  });
  if (!wh.data?.ok) throw new Error(`webhook fulfill failed: ${JSON.stringify(wh.data).slice(0, 300)}`);

  const resolved = await santaApi(anon, { action: "resolve", access_token: accessToken });
  if (!resolved.data?.ok || Number(resolved.data?.remaining_seconds) !== 180) {
    throw new Error(`resolve not ready: ${JSON.stringify(resolved.data).slice(0, 300)}`);
  }

  const callUrl = `https://www.thedigitalgifter.com/_qa/santa-private/santa/call/${accessToken}`;
  fs.writeFileSync("/tmp/tdg-santa-safari-qa-token", accessToken, { mode: 0o600 });
  fs.writeFileSync("/tmp/tdg-santa-safari-qa-url", callUrl, { mode: 0o600 });

  const qrPng = "/tmp/tdg-santa-safari-qa-qr.png";
  const qr = spawnSync(
    "python3",
    [
      "-c",
      `import pathlib
url=pathlib.Path('/tmp/tdg-santa-safari-qa-url').read_text().strip()
try:
 import qrcode
 img=qrcode.make(url)
 img.save('${qrPng}')
 print('qrcode_ok')
except Exception as e:
 # fallback: write SVG via minimal matrix if qrcode missing
 print('qrcode_fail', e)
`,
    ],
    { encoding: "utf8" },
  );
  let qrPath = qrPng;
  if (!/qrcode_ok/.test(qr.stdout || "")) {
    // try npx qrcode if available
    const npx = spawnSync("npx", ["--yes", "qrcode", callUrl, "-o", qrPng], { encoding: "utf8", timeout: 60000 });
    if (npx.status !== 0 || !fs.existsSync(qrPng)) {
      qrPath = null;
    }
  }

  const steps = `# Santa V2 — Private iPhone Safari QA

Generated: ${new Date().toISOString()}
Mode: Stripe TEST only (no LIVE charges)
Child profile: Maya / ro / hobbies + wish preloaded
Entitlement: ready, **180 seconds** remaining, extension available once

## Private URL
Open the file \`/tmp/tdg-santa-safari-qa-url\` on this machine (mode 0600).
Do **not** paste the token into chat, tickets, or public channels.
QR: \`${qrPath || "(generate locally from the URL file)"}\`

## Manual steps (physical iPhone + Safari)

1. Scan QR or open the private URL in **Safari** (not Chrome).
2. Allow microphone when prompted.
3. Confirm audible Santa voice (**ash**), barge-in, and RO language.
4. Talk briefly; confirm child name/context without a long re-intro if reconnecting mid-call.
5. Stay until the **180s** timer ends (or force by waiting).

### At 180 seconds (expected)
- Call ends with duration limit.
- Extension upsell appears (49 RON / +5 min).
- No second free call; one extension max.

6. Tap pay / extend → real **Stripe TEST Checkout** hosted UI.
7. Pay with Stripe test card \`4242 4242 4242 4242\`, any future expiry, any CVC.
8. Safari must return to the private call URL (\`?extension=return\` or equivalent).

### After 49 RON TEST payment (expected)
- Entitlement becomes **300 seconds**.
- Same child profile + resume context.
- **No repeated introduction** / no full re-greet.
- Voice still ash; mic + barge-in still work.

9. Use the extra time; optionally background Safari and return (refresh/reconnect).
10. At end of the extra **300 seconds**, call ends permanently — no second extension offer that can charge again.

### Cancel / fail probes (optional)
- Start Checkout and tap Cancel → unpaid, no entitlement change.
- Use \`4000 0000 0000 0002\` → decline, no entitlement change.

## Isolation reminders
- Contabo \`CHRISTMAS_SANTA_CALL_STRIPE_MODE=test\` + \`STRIPE_TEST_*\` only for this path.
- \`CHRISTMAS_LIVE_PRODUCTS\` stays empty — no public Santa LIVE route.
- Do not use LIVE cards. Do not share QA tokens.

## Still MANUAL-only on device
Microphone, audible voice, barge-in, language switching, Safari payment return.
`;

  const stepsPath = path.join(outDir, "SANTA_V2_SAFARI_IPHONE_QA.md");
  fs.writeFileSync(stepsPath, steps);
  // also mirror steps next to QR without embedding token
  fs.writeFileSync("/tmp/tdg-santa-safari-qa-steps.md", steps, { mode: 0o600 });

  console.log(
    JSON.stringify({
      ok: true,
      child: "Maya",
      remaining_seconds: 180,
      entitlement_status: resolved.data.status,
      stripe_mode: "test",
      url_file: "/tmp/tdg-santa-safari-qa-url",
      token_file: "/tmp/tdg-santa-safari-qa-token",
      qr_file: qrPath,
      steps_file: stepsPath,
      orderId_prefix: orderId.slice(0, 8),
      session_prefix: sessionId.slice(0, 12) || null,
    }),
  );
}

main().catch((e) => {
  console.error(JSON.stringify({ fatal: String(e.message || e) }));
  process.exit(1);
});
