#!/usr/bin/env node
/**
 * Create a real unpaid Pet checkout (V2 dog) via the same Edge path the browser uses.
 * Does not confirm payment, capture, or start paid generation.
 * Never prints tokens, client_secret, or Stripe secrets.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const supabaseUrl = String(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
const anon = String(process.env.VITE_SUPABASE_ANON_KEY || "").trim();
if (!supabaseUrl || !anon) {
  console.error("BLOCKED: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY required");
  process.exit(2);
}

const photoPath = resolve("public/pet/dog/source.webp");
const photo = readFileSync(photoPath);
const email = `tdg-agent-probe-${Date.now()}@checkout.thedigitalgifter.com`;

async function edge(action, body) {
  const res = await fetch(`${supabaseUrl}/functions/v1/pet-funnel`, {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...body }),
    signal: AbortSignal.timeout(40000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, html: /^\s*</.test(text) };
}

const results = [];
function rec(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const order = await edge("createOrder", {
  email,
  petName: "CutoverProbe",
  species: "dog",
  personality: "cute",
  funnelVariant: "v2",
  amountCents: 299,
  currency: "usd",
  sku: "pet-secret-life-12",
  photo: {
    contentType: "image/webp",
    fileName: "source.webp",
    byteSize: photo.length,
    width: 512,
    height: 512,
  },
});
rec(
  "create_order_v2",
  order.status === 200 && Boolean(order.json?.orderId) && order.json?.amountCents === 299 && !order.html,
  `http=${order.status} amount=${order.json?.amountCents ?? "n/a"} variant=${order.json?.funnelVariant || "n/a"}`,
);
if (!order.json?.orderId || !order.json?.publicToken) {
  console.error("CHECKOUT_SMOKE_FAILED: no order");
  process.exit(1);
}

const upload = await edge("getSignedUploadUrl", {
  orderId: order.json.orderId,
  publicToken: order.json.publicToken,
  contentType: "image/webp",
  fileName: "source.webp",
  byteSize: photo.length,
});
rec("signed_upload_url", upload.status === 200 && Boolean(upload.json?.uploadUrl) && !String(upload.json?.uploadUrl || "").includes("vercel"), `http=${upload.status}`);

if (!upload.json?.uploadUrl) {
  console.error("CHECKOUT_SMOKE_FAILED: no upload url");
  process.exit(1);
}

const put = await fetch(upload.json.uploadUrl, {
  method: upload.json.method || "PUT",
  headers: upload.json.headers || { "content-type": "image/webp" },
  body: photo,
  signal: AbortSignal.timeout(40000),
});
rec("photo_put", put.ok, `http=${put.status}`);

const confirm = await edge("confirmUpload", {
  orderId: order.json.orderId,
  publicToken: order.json.publicToken,
  objectPath: upload.json.objectPath,
});
rec("confirm_upload", confirm.status === 200 && confirm.json?.status === "awaiting_payment", `http=${confirm.status} status=${confirm.json?.status || "n/a"}`);

const checkout = await edge("createStripeCheckout", {
  orderId: order.json.orderId,
  publicToken: order.json.publicToken,
  uiMode: "elements",
  funnelSessionId: "00000000-0000-4000-8000-000000000077",
  cancelUrl: "https://www.thedigitalgifter.com/pet/dog-v2?checkout=canceled",
});
const amount = Number(checkout.json?.amountCents ?? checkout.json?.chargedAmountCents ?? 0);
const sessionId = String(checkout.json?.sessionId || "");
const pk = String(checkout.json?.publishableKey || "");
const secret = String(checkout.json?.clientSecret || "");
const diag = checkout.json?.checkoutDiag || {};
const livePk = pk.startsWith("pk_live_");
const liveCs = sessionId.startsWith("cs_live_") || secret.startsWith("cs_live_");
rec(
  "create_checkout_unpaid",
  checkout.status === 200 &&
    checkout.json?.status === "open" &&
    amount === 299 &&
    Boolean(sessionId) &&
    Boolean(secret) &&
    livePk &&
    !checkout.html,
  `http=${checkout.status} status=${checkout.json?.status || "n/a"} amount=${amount} session_live=${liveCs} pk_live=${livePk} keys_paired=${diag.keysPaired === true}`,
);
rec(
  "checkout_keys_same_live_account",
  diag.keysPaired === true && livePk,
  `paired=${diag.keysPaired === true} init=${diag.initFailureCode || "none"}`,
);
rec(
  "checkout_not_paid",
  checkout.json?.status === "open" && checkout.json?.status !== "payment_processing",
  `status=${checkout.json?.status || "n/a"}`,
);

const failed = results.filter((r) => !r.ok);
console.log(
  `CHECKOUT_SMOKE ${failed.length ? "FAILED" : "OK"} ${results.length - failed.length}/${results.length} order_id_prefix=${String(order.json.orderId).slice(0, 8)} session_prefix=${sessionId.slice(0, 8)}`,
);
console.log("NOTE: session is unpaid Elements checkout; expires in ~31 minutes. Not charged. No generation started.");
if (failed.length) process.exit(1);
