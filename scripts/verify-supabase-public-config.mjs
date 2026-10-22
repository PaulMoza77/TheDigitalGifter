#!/usr/bin/env node
/**
 * Diagnose public Supabase client config used by the browser build.
 *
 * Usage:
 *   node scripts/verify-supabase-public-config.mjs
 *   TDG_ORIGIN=https://www.thedigitalgifter.com node scripts/verify-supabase-public-config.mjs
 *
 * Does not print full API keys. Exit 0 only when URL TLS works, anon JWT has
 * project ref, and REST /occasions returns a non-auth/non-quota success.
 */
import { Buffer } from "node:buffer";

const ORIGIN = String(process.env.TDG_ORIGIN || "https://www.thedigitalgifter.com").replace(
  /\/$/,
  "",
);
const EXPECTED_REF = "kjlsocejpmnzhhduyumy";

function decodeJwt(token) {
  const part = String(token || "").split(".")[1];
  if (!part) return null;
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function redactKey(key) {
  const s = String(key || "");
  if (s.length < 16) return "(short)";
  return `${s.slice(0, 12)}…${s.slice(-8)} (len=${s.length})`;
}

async function main() {
  const html = await fetch(`${ORIGIN}/`).then((r) => r.text());
  const assetMatch = html.match(/\/assets\/index-[^"]+\.js/);
  if (!assetMatch) {
    console.error("BLOCKED: could not find /assets/index-*.js on", ORIGIN);
    process.exit(2);
  }

  const assetUrl = `${ORIGIN}${assetMatch[0]}`;
  const js = await fetch(assetUrl).then((r) => r.text());
  const urlMatch = js.match(/VITE_SUPABASE_URL:"([^"]+)"/);
  const anonMatch = js.match(/VITE_SUPABASE_ANON_KEY:"([^"]+)"/);

  const url = urlMatch?.[1] || "";
  const anon = anonMatch?.[1] || "";
  const payload = decodeJwt(anon);

  console.log("origin", ORIGIN);
  console.log("asset", assetMatch[0]);
  console.log("VITE_SUPABASE_URL", url || "(missing)");
  console.log("VITE_SUPABASE_ANON_KEY", redactKey(anon));
  console.log("anon.payload", payload);

  const failures = [];

  if (!url) failures.push("missing VITE_SUPABASE_URL in bundle");
  if (!anon) failures.push("missing VITE_SUPABASE_ANON_KEY in bundle");
  if (!payload || payload.role !== "anon" || !payload.ref) {
    failures.push("anon JWT missing role/ref (not a hosted Supabase anon key)");
  } else if (payload.ref !== EXPECTED_REF) {
    failures.push(`anon ref ${payload.ref} != expected ${EXPECTED_REF}`);
  }

  if (url) {
    try {
      const host = new URL(url).hostname;
      if (host === "supabase.thedigitalgifter.com") {
        failures.push(
          "custom supabase host in bundle — verify TLS/DNS points at Supabase, not the web app",
        );
      }
      const probe = await fetch(url.replace(/\/$/, "") + "/auth/v1/health", {
        headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      }).catch((error) => ({ ok: false, status: 0, error }));
      if (probe.error) {
        failures.push(`URL TLS/network failure: ${probe.error.message || probe.error}`);
      } else {
        console.log("auth.health.status", probe.status);
      }
    } catch (error) {
      failures.push(`URL parse/probe failed: ${error.message || error}`);
    }
  }

  if (url && anon) {
    const rest = await fetch(
      `${url.replace(/\/$/, "")}/rest/v1/occasions?select=slug&limit=1`,
      {
        headers: {
          apikey: anon,
          Authorization: `Bearer ${anon}`,
          Accept: "application/json",
        },
      },
    ).catch((error) => ({ ok: false, status: 0, error, text: async () => String(error) }));

    if (rest.error) {
      failures.push(`REST network failure: ${rest.error.message || rest.error}`);
    } else {
      const body = await rest.text();
      console.log("rest.occasions.status", rest.status);
      console.log("rest.occasions.body", body.slice(0, 180));
      if (rest.status === 401) failures.push("REST 401 Invalid API key");
      if (rest.status === 402) failures.push("REST 402 project restricted (quota/billing)");
      if (rest.status >= 500) failures.push(`REST ${rest.status}`);
      if (!(rest.status >= 200 && rest.status < 300)) {
        failures.push(`REST occasions not OK (${rest.status})`);
      }
    }
  }

  // Also probe native project URL with the same anon key for comparison.
  if (anon) {
    const native = `https://${EXPECTED_REF}.supabase.co/rest/v1/occasions?select=slug&limit=1`;
    const nativeRes = await fetch(native, {
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        Accept: "application/json",
      },
    }).catch((error) => ({ status: 0, error, text: async () => String(error) }));
    if (!nativeRes.error) {
      const body = await nativeRes.text();
      console.log("native.rest.status", nativeRes.status);
      console.log("native.rest.body", body.slice(0, 180));
      if (nativeRes.status === 402) {
        failures.push("native project REST 402 exceed_storage_size_quota (or billing restriction)");
      }
    }
  }

  if (failures.length) {
    console.error("FAIL");
    for (const item of failures) console.error("-", item);
    process.exit(1);
  }

  console.log("PASS");
}

main().catch((error) => {
  console.error("BLOCKED", error);
  process.exit(2);
});
