#!/usr/bin/env node
/**
 * HTTPS readiness / post-cutover verification for TDG on Mozas.
 *
 * Modes:
 *   TDG_HTTPS_PHASE=pre   (default) — cert storage, Caddyfile.https.ready, mode logic.
 *                           Public certs are not required.
 *   TDG_HTTPS_PHASE=post  — both domains, direct VPS (--resolve) AND public (no --resolve):
 *                           A/AAAA, HTTP→HTTPS redirect, valid cert, TDG pages, TheMozas.
 *
 * Never prints secrets or raw origin IPs.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { detectTdgCaddyMode, assertCaddyContentMatchesMode } from "../deploy/lib/caddy-mode.mjs";
import { dnsPointsAtVps, parseDnsRecords } from "../deploy/lib/tdg-https-fetch.mjs";
import { certLooksValid, fetchTdgNamedHost, readDirectCert, readPublicCert } from "../deploy/lib/tdg-origin-curl.mjs";

const phase = String(process.env.TDG_HTTPS_PHASE || "pre").toLowerCase();
const ip = process.env.MOZAS_SSH_HOST || process.env.MOZAS_ORIGIN_IP || "";
const results = [];
const HOSTS = ["thedigitalgifter.com", "www.thedigitalgifter.com"];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function sh(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 4_000_000, ...opts });
  } catch (err) {
    return err.stdout?.toString?.() || "";
  }
}

function digRecords(name) {
  const a = sh("dig", ["+short", name, "A"]).trim().split(/\s+/).filter(Boolean);
  const aaaa = sh("dig", ["+short", name, "AAAA"]).trim().split(/\s+/).filter(Boolean);
  const cname = sh("dig", ["+short", name, "CNAME"]).trim().split(/\s+/).filter(Boolean);
  return parseDnsRecords({ a, aaaa, cname });
}

const httpsReady = readFileSync(resolve("deploy/caddy/Caddyfile.https.ready"), "utf8");
const httpFile = readFileSync(resolve("deploy/caddy/Caddyfile.http"), "utf8");

try {
  assertCaddyContentMatchesMode(httpsReady, "https");
  record("https_ready_file_valid", true, "named site + HSTS + TheMozas");
} catch (e) {
  record("https_ready_file_valid", false, String(e.message || e));
}

try {
  assertCaddyContentMatchesMode(httpFile, "http");
  record("http_file_valid", true, "host matchers only");
} catch (e) {
  record("http_file_valid", false, String(e.message || e));
}

record(
  "mode_detect_https_ready",
  detectTdgCaddyMode(httpsReady, "") === "https",
  `mode=${detectTdgCaddyMode(httpsReady, "")}`,
);
record(
  "mode_detect_http_file",
  detectTdgCaddyMode(httpFile, "") === "http",
  `mode=${detectTdgCaddyMode(httpFile, "")}`,
);
record(
  "regression_https_not_downgraded_by_http_file",
  (() => {
    try {
      assertCaddyContentMatchesMode(httpFile, "https");
      return false;
    } catch {
      return true;
    }
  })(),
  "http file rejected as https candidate",
);

const apexDns = digRecords("thedigitalgifter.com");
const wwwDns = digRecords("www.thedigitalgifter.com");
const apexOnVps = dnsPointsAtVps({ ...apexDns, vpsIp: ip });
const wwwOnVps = dnsPointsAtVps({ ...wwwDns, vpsIp: ip });
record(
  "dns_apex_a",
  phase === "pre" ? true : apexOnVps.aOk,
  phase === "pre"
    ? apexOnVps.aOk
      ? "already_on_vps"
      : `still_off_vps count=${apexDns.a.length}`
    : apexOnVps.aOk
      ? "on_vps"
      : "not_on_vps",
);
record(
  "dns_www_a",
  phase === "pre" ? true : wwwOnVps.aOk,
  phase === "pre"
    ? wwwOnVps.aOk
      ? "already_on_vps"
      : wwwDns.cname.some((c) => /vercel/i.test(c))
        ? "still_vercel_cname"
        : `off_vps count=${wwwDns.a.length}`
    : wwwOnVps.aOk
      ? "on_vps"
      : wwwDns.cname.some((c) => /vercel/i.test(c))
        ? "still_vercel_cname"
        : "not_on_vps",
);
record(
  "dns_apex_aaaa",
  phase === "pre" ? true : apexOnVps.aaaaOk,
  apexOnVps.aaaaAbsent ? "absent" : apexOnVps.aaaaOk ? "on_vps" : "points_elsewhere",
);
record(
  "dns_www_aaaa",
  phase === "pre" ? true : wwwOnVps.aaaaOk,
  wwwOnVps.aaaaAbsent ? "absent" : wwwOnVps.aaaaOk ? "on_vps" : "points_elsewhere",
);

if (phase === "pre") {
  record(
    "pre_public_https_not_required",
    true,
    "public cert/redirect checks deferred until DNS cutover + apply-tdg-https",
  );
  if (process.env.MOZAS_SSH_HOST) {
    try {
      const out = sh("bash", ["scripts/probe-tdg-https-pre.sh"]);
      record(
        "pre_cert_storage_volume",
        /caddy_data_mount=\S+/.test(out) || /cert_storage_present=yes/.test(out),
        out.match(/caddy_data_mount=.*/)?.[0] || out.match(/cert_storage_present=.*/)?.[0] || "missing",
      );
      record("pre_https_ready_on_vps", /https_ready_on_vps=yes/.test(out), "");
      record("pre_ensure_script_installed", /ensure_script=yes/.test(out), "");
      record("pre_renew_mechanism", /renew_mechanism=caddy_acme_automatic/.test(out), "Caddy ACME auto-renew when HTTPS mode active");
      record("pre_acme_email_config", /acme_email_set=yes/.test(out), "");
    } catch (e) {
      record("pre_remote_https_readiness", false, String(e.message || e));
    }
  }
}

function checkNamedHost({ host, ip: pin, label, requireHttps }) {
  const health = fetchTdgNamedHost({ host, path: "/healthz", ip: pin, requireHttps });
  record(
    `${label}_https_healthz_${host}`,
    health.accepted && health.final.body.trim() === "ok",
    `http=${health.http.status} https=${health.https.status} redirect=${health.redirected} scheme=${health.scheme}`,
  );
  const home = fetchTdgNamedHost({ host, path: "/", ip: pin, requireHttps });
  const homeBody = String(home.final.body || "").toLowerCase();
  record(
    `${label}_tdg_home_${host}`,
    home.accepted && homeBody.includes("digital") && !homeBody.includes("themozas."),
    `http=${home.http.status} https=${home.https.status} redirect=${home.redirected}`,
  );
  record(
    `${label}_http_to_https_${host}`,
    requireHttps
      ? health.redirected && health.http.status >= 301 && health.http.status < 400
      : health.redirected || health.http.status === 200,
    `status=${health.http.status} location_https=${health.redirected}`,
  );
}

if (phase === "post") {
  if (!ip) {
    record("post_origin_ip", false, "MOZAS_SSH_HOST missing");
  } else {
    for (const host of HOSTS) {
      checkNamedHost({ host, ip, label: "direct", requireHttps: true });
      const cert = readDirectCert(host, ip);
      record(`direct_cert_${host}`, certLooksValid(cert, host), cert.split("\n").filter(Boolean).slice(0, 2).join(" | ") || "no cert");
    }

    for (const host of HOSTS) {
      checkNamedHost({ host, ip: "", label: "public", requireHttps: true });
      const cert = readPublicCert(host);
      record(`public_cert_${host}`, certLooksValid(cert, host), cert.split("\n").filter(Boolean).slice(0, 2).join(" | ") || "no cert");
    }

    const themozas = sh("curl", ["-sS", "-o", "/tmp/tm-ip", "-w", "%{http_code}", "--max-time", "15", `http://${ip}/`]);
    const tmBody = sh("cat", ["/tmp/tm-ip"]).toLowerCase();
    record(
      "post_themozas_ip_http",
      themozas === "200" && tmBody.includes("mozas") && !tmBody.includes("thedigitalgifter"),
      `http=${themozas}`,
    );
  }
}

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`HTTPS_VERIFY_FAILED phase=${phase} ${failed.length}/${results.length}`);
  process.exit(1);
}
console.log(`HTTPS_VERIFY_OK phase=${phase} ${results.length}/${results.length}`);
if (phase === "pre") {
  console.log("CUTOVER_DNS apex=" + (apexOnVps.aOk ? "vps" : "not_vps") + " www=" + (wwwOnVps.aOk ? "vps" : "not_vps"));
  console.log("NEXT: after BOTH names point at MOZAS_SSH_HOST (A, no stray AAAA), confirm and run:");
  console.log("  TDG_HTTPS_APPLY=yes bash scripts/apply-tdg-https.sh");
  console.log("  TDG_HTTPS_PHASE=post node scripts/verify-tdg-https.mjs");
}
