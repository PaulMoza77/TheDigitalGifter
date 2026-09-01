#!/usr/bin/env node
/**
 * Verify TDG VPS origin + external Supabase auth/generation/checkout edges.
 * Never prints secrets, tokens, or response bodies that may contain them.
 */
import { execFileSync } from "node:child_process";

const verifyHost = process.env.TDG_VERIFY_HOST || "tdg-verify.mozas-prod-01";
const ip = process.env.MOZAS_SSH_HOST || process.env.MOZAS_ORIGIN_IP || "";
if (!ip) {
  console.error("BLOCKED: set MOZAS_SSH_HOST");
  process.exit(2);
}

const supabaseUrl = String(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
const anon = String(process.env.VITE_SUPABASE_ANON_KEY || "").trim();
if (!supabaseUrl || !anon) {
  console.error("BLOCKED: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY required for flow checks");
  process.exit(2);
}

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function originCurl(path, extra = []) {
  const args = [
    "-sS",
    "-D",
    "-",
    "-o",
    "/tmp/tdg-flow-body",
    "--max-time",
    "25",
    "--resolve",
    `${verifyHost}:80:${ip}`,
    ...extra,
    `http://${verifyHost}${path}`,
  ];
  const headers = execFileSync("curl", args, { encoding: "utf8", maxBuffer: 4_000_000 });
  let status = 0;
  let contentType = "";
  for (const line of headers.split(/\r?\n/)) {
    if (line.startsWith("HTTP/")) {
      const parts = line.split(/\s+/);
      if (parts[1] && /^\d+$/.test(parts[1])) status = Number(parts[1]);
    }
    if (line.toLowerCase().startsWith("content-type:")) {
      contentType = line.split(":").slice(1).join(":").trim();
    }
  }
  const body = execFileSync("cat", ["/tmp/tdg-flow-body"]);
  const text = body.toString("utf8");
  const html = /^\s*<(!doctype html|html)/i.test(text);
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status, contentType, html, json, bytes: body.length };
}

async function edge(path, { method = "POST", body } = {}) {
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
  const html = /^\s*<(!doctype html|html)/i.test(text);
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, html, json, bytes: text.length };
}

const home = originCurl("/");
record("pages_home", home.status === 200 && home.html, `http=${home.status}`);

const pet = originCurl("/pet/dog");
record("pages_pet_dog", pet.status === 200 && pet.html, `http=${pet.status}`);

const authCb = originCurl("/auth/callback");
record("auth_callback_spa", authCb.status === 200 && authCb.html, `http=${authCb.status}`);

const apiMiss = originCurl("/api/does-not-exist");
record("vercel_dep_api_miss_json", apiMiss.status === 404 && !apiMiss.html && apiMiss.json?.error === "not_found", `http=${apiMiss.status}`);

const provider = originCurl("/api/pet-provider-status");
record(
  "vercel_dep_provider_status",
  provider.status === 200 && provider.json?.available === true,
  `http=${provider.status} available=${provider.json?.available === true}`,
);

const ingest = originCurl("/api/pet/funnel-event", ["-X", "POST", "-H", "Content-Type: application/json", "-d", "{}"]);
record("vercel_dep_pet_v1_ingest", ingest.status === 400 && !ingest.html, `http=${ingest.status}`);

const xmasVercel = originCurl("/api/christmas-funnel", [
  "-X",
  "POST",
  "-H",
  "Content-Type: application/json",
  "-d",
  '{"action":"__probe__"}',
]);
record(
  "vercel_dep_christmas_funnel_not_html",
  xmasVercel.status >= 400 && xmasVercel.status < 600 && !xmasVercel.html,
  `http=${xmasVercel.status}`,
);

const settings = await fetch(`${supabaseUrl}/auth/v1/settings`, {
  headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  signal: AbortSignal.timeout(15000),
});
let settingsJson = null;
try {
  settingsJson = await settings.json();
} catch {
  settingsJson = null;
}
const providers = settingsJson && typeof settingsJson === "object" ? Object.keys(settingsJson.external || {}) : [];
const googleOn = Boolean(settingsJson?.external?.google);
record(
  "auth_supabase_settings",
  settings.ok && settingsJson != null,
  `http=${settings.status} google=${googleOn ? "on" : "off"}`,
);
void providers;

const offer = await edge("/functions/v1/pet-funnel", { body: { action: "getPublicOffer" } });
const offerCents = Number(offer.json?.amountCents || 0);
record(
  "checkout_public_offer",
  offer.status === 200 && !offer.html && offerCents > 0,
  `http=${offer.status} amount_set=${offerCents > 0}`,
);

const checkout = await edge("/functions/v1/pet-funnel", { body: { action: "createStripeCheckout" } });
record(
  "checkout_create_fail_closed",
  checkout.status >= 400 && checkout.status < 500 && !checkout.html && !checkout.json?.clientSecret && !checkout.json?.url,
  `http=${checkout.status}`,
);

const credits = await edge("/functions/v1/create-checkout-session", { body: { pack: "invalid-probe" } });
record(
  "checkout_credits_fail_closed",
  credits.status >= 400 && credits.status < 600 && !credits.html && !String(credits.json?.url || "").includes("checkout.stripe.com"),
  `http=${credits.status}`,
);

const xmasEdge = await edge("/functions/v1/christmas-funnel", { body: { action: "__probe__" } });
record(
  "checkout_christmas_edge_not_html",
  xmasEdge.status >= 400 && xmasEdge.status < 600 && !xmasEdge.html,
  `http=${xmasEdge.status}`,
);

const preview = await edge("/functions/v1/pet-v2-preview", { body: {} });
record(
  "generation_preview_fail_closed",
  preview.status >= 400 && preview.status < 600 && !preview.html && preview.json?.ok !== true,
  `http=${preview.status}`,
);

const generate = await edge("/functions/v1/generate-nano-banana", { body: {} });
record(
  "generation_nano_banana_not_html",
  generate.status >= 400 && generate.status < 600 && !generate.html,
  `http=${generate.status}`,
);

const edgeProvider = await edge("/functions/v1/pet-provider-status", { method: "GET" });
record(
  "generation_edge_provider",
  (edgeProvider.status === 200 || edgeProvider.status === 404) && !edgeProvider.html,
  `http=${edgeProvider.status}`,
);

const apexCode = execFileSync(
  "curl",
  [
    "-sS",
    "-o",
    "/tmp/tdg-apex-host",
    "-w",
    "%{http_code}",
    "--max-time",
    "15",
    "--resolve",
    `thedigitalgifter.com:80:${ip}`,
    "http://thedigitalgifter.com/healthz",
  ],
  { encoding: "utf8" },
);
const apexBody = execFileSync("cat", ["/tmp/tdg-apex-host"], { encoding: "utf8" }).trim();
record("caddy_apex_host_healthz", apexCode === "200" && apexBody === "ok", `http=${apexCode}`);

const wwwCode = execFileSync(
  "curl",
  [
    "-sS",
    "-o",
    "/tmp/tdg-www-host",
    "-w",
    "%{http_code}",
    "--max-time",
    "15",
    "--resolve",
    `www.thedigitalgifter.com:80:${ip}`,
    "http://www.thedigitalgifter.com/",
  ],
  { encoding: "utf8" },
);
const wwwBody = execFileSync("cat", ["/tmp/tdg-www-host"], { encoding: "utf8" });
record(
  "caddy_www_host_home",
  wwwCode === "200" && /^\s*<(!doctype html|html)/i.test(wwwBody),
  `http=${wwwCode}`,
);

const serviceRole = originCurl("/api/pet-v3/internal-test-status", [
  "-X",
  "POST",
  "-H",
  "Content-Type: application/json",
  "-d",
  '{"funnel_session_id":"00000000-0000-4000-8000-000000000001"}',
]);
record(
  "service_role_internal_status",
  serviceRole.status === 200 && !serviceRole.html,
  `http=${serviceRole.status}`,
);

const themozas = execFileSync(
  "curl",
  ["-sS", "-o", "/tmp/themozas-home", "-w", "%{http_code}", "--max-time", "15", `http://${ip}/`],
  { encoding: "utf8" },
);
const tmBody = execFileSync("cat", ["/tmp/themozas-home"], { encoding: "utf8" }).toLowerCase();
record(
  "themozas_still_default_80",
  themozas === "200" && tmBody.includes("mozas") && !tmBody.includes("thedigitalgifter"),
  `http=${themozas}`,
);

let vercel = "000";
let vercelHtml = "";
try {
  vercel = execFileSync(
    "curl",
    ["-sS", "-o", "/tmp/tdg-vercel-home", "-w", "%{http_code}", "--max-time", "20", "https://www.thedigitalgifter.com/"],
    { encoding: "utf8" },
  );
  vercelHtml = execFileSync("cat", ["/tmp/tdg-vercel-home"], { encoding: "utf8" });
} catch (err) {
  vercel = String(err?.stdout || "000");
  vercelHtml = "";
}
record("rollback_vercel_live", vercel === "200" && /^\s*<!doctype html/i.test(vercelHtml), `http=${vercel}`);

const failed = results.filter((row) => !row.ok);
if (failed.length) {
  console.error(`FLOW_VERIFY_FAILED ${failed.length}/${results.length}`);
  process.exit(1);
}
console.log(`FLOW_VERIFY_OK ${results.length}/${results.length}`);
